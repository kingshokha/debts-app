import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { deletePhotos } from './photos';
import type { Contact, Group, Operation, SortSettings, ViewSettings } from './types';

const DATA_KEY = 'debts/contacts/v1';
const GROUPS_KEY = 'debts/groups/v1';
const SORT_KEY = 'debts/sort/v1';
const VIEW_KEY = 'debts/view/v1';

const DEFAULT_SORT: SortSettings = { key: 'date', desc: true, showZero: true };
const DEFAULT_VIEW: ViewSettings = { mode: 'all', groupId: null };

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const balanceOf = (c: Contact) => Math.round(c.operations.reduce((s, op) => s + op.amount, 0) * 100) / 100;

export const lastDateOf = (c: Contact) => c.operations.at(-1)?.date ?? c.createdAt;

export const lastCommentOf = (c: Contact) => c.operations.findLast((op) => op.comment)?.comment ?? '';

const insertOp = (ops: Operation[], op: Operation) => [...ops, op].sort((a, b) => a.date - b.date);

const newOp = (amount: number, date: number, comment: string, photos: string[] = []): Operation => ({
  id: newId(),
  amount,
  date,
  comment,
  ...(photos.length ? { photos } : {}),
});

const opPhotos = (ops: Operation[]) => ops.flatMap((op) => op.photos ?? []);

/** Все файлы фото контакта: его собственное и фото операций. */
export const photosOf = (c: Contact) => [c.photo, ...opPhotos(c.operations)];

export type Backup = { contacts: Contact[]; groups: Group[] };

/** Проверка импортируемых данных. Понимает и старый формат — просто массив контактов. */
export function parseBackup(text: string): Backup | null {
  try {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data?.contacts;
    if (!Array.isArray(list)) return null;
    const groups: Group[] = (Array.isArray(data?.groups) ? data.groups : []).map((g: any) => ({
      id: String(g.id ?? newId()),
      name: String(g.name ?? ''),
    }));
    const groupIds = new Set(groups.map((g) => g.id));
    const contacts = list.map((c: any) => ({
      id: String(c.id ?? newId()),
      name: String(c.name ?? ''),
      createdAt: Number(c.createdAt ?? Date.now()),
      groupId: c.groupId && groupIds.has(String(c.groupId)) ? String(c.groupId) : null,
      photo: typeof c.photo === 'string' ? c.photo : null,
      operations: (Array.isArray(c.operations) ? c.operations : [])
        .map((op: any) => ({
          id: String(op.id ?? newId()),
          amount: Number(op.amount) || 0,
          date: Number(op.date ?? Date.now()),
          comment: String(op.comment ?? ''),
          ...(Array.isArray(op.photos) && op.photos.length
            ? { photos: op.photos.filter((uri: unknown) => typeof uri === 'string') }
            : {}),
        }))
        .sort((a: Operation, b: Operation) => a.date - b.date),
    }));
    return { contacts, groups };
  } catch {
    return null;
  }
}

/** Сохраняет значение в AsyncStorage при каждом изменении (после первичной загрузки). */
function usePersist(key: string, value: unknown, loaded: boolean) {
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(key, JSON.stringify(value)).catch((e) => console.warn(e));
  }, [key, value, loaded]);
}

export function useDebts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sort, setSort] = useState<SortSettings>(DEFAULT_SORT);
  const [view, setView] = useState<ViewSettings>(DEFAULT_VIEW);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [data, groupsData, sortData, viewData] = await Promise.all(
          [DATA_KEY, GROUPS_KEY, SORT_KEY, VIEW_KEY].map((k) => AsyncStorage.getItem(k)),
        );
        if (data) setContacts(JSON.parse(data));
        if (groupsData) setGroups(JSON.parse(groupsData));
        if (sortData) setSort({ ...DEFAULT_SORT, ...JSON.parse(sortData) });
        if (viewData) setView({ ...DEFAULT_VIEW, ...JSON.parse(viewData) });
      } catch (e) {
        console.warn('Не удалось загрузить данные', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  usePersist(DATA_KEY, contacts, loaded);
  usePersist(GROUPS_KEY, groups, loaded);
  usePersist(SORT_KEY, sort, loaded);
  usePersist(VIEW_KEY, view, loaded);

  const update = useCallback((id: string, fn: (c: Contact) => Contact) => {
    setContacts((list) => list.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const addOperation = useCallback(
    (contactId: string, amount: number, date: number, comment: string, photos: string[]) =>
      update(contactId, (c) => ({ ...c, operations: insertOp(c.operations, newOp(amount, date, comment, photos)) })),
    [update],
  );

  /**
   * Новый контакт; если контакт с таким именем уже есть — операция добавляется к нему,
   * а группа проставляется, только если у него группы ещё не было.
   */
  const addContact = useCallback(
    (name: string, amount: number, date: number, comment: string, groupId: string | null, photos: string[]) => {
      const trimmed = name.trim();
      setContacts((list) => {
        const op = newOp(amount, date, comment, photos);
        const existing = list.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
        if (existing) {
          return list.map((c) =>
            c.id === existing.id
              ? { ...c, groupId: c.groupId ?? groupId, operations: insertOp(c.operations, op) }
              : c,
          );
        }
        return [...list, { id: newId(), name: trimmed, createdAt: Date.now(), groupId, operations: [op] }];
      });
    },
    [],
  );

  const payOff = useCallback(
    (id: string) =>
      update(id, (c) => {
        const balance = balanceOf(c);
        if (!balance) return c;
        return { ...c, operations: insertOp(c.operations, newOp(-balance, Date.now(), 'Погашение')) };
      }),
    [update],
  );

  /**
   * Схлопывает историю в одну операцию с текущим балансом; фото операций переходят в неё.
   * При нулевом балансе операций не остаётся, и фото удаляются.
   */
  const clearHistory = useCallback(
    (id: string) => {
      const contact = contacts.find((c) => c.id === id);
      if (contact && !balanceOf(contact)) deletePhotos(opPhotos(contact.operations));
      update(id, (c) => {
        const balance = balanceOf(c);
        const operations = balance ? [newOp(balance, Date.now(), lastCommentOf(c), opPhotos(c.operations))] : [];
        return { ...c, operations };
      });
    },
    [contacts, update],
  );

  const rename = useCallback((id: string, name: string) => update(id, (c) => ({ ...c, name: name.trim() })), [update]);

  const setContactGroup = useCallback(
    (id: string, groupId: string | null) => update(id, (c) => ({ ...c, groupId })),
    [update],
  );

  /** Ставит или убирает фото; старый файл удаляется. */
  const setPhoto = useCallback(
    (id: string, photo: string | null) => {
      const old = contacts.find((c) => c.id === id)?.photo;
      if (old !== photo) deletePhotos([old]);
      update(id, (c) => ({ ...c, photo }));
    },
    [contacts, update],
  );

  const removeContact = useCallback(
    (id: string) => {
      const contact = contacts.find((c) => c.id === id);
      if (contact) deletePhotos(photosOf(contact));
      setContacts((list) => list.filter((c) => c.id !== id));
    },
    [contacts],
  );

  const findOp = useCallback(
    (contactId: string, opId: string) => contacts.find((c) => c.id === contactId)?.operations.find((op) => op.id === opId),
    [contacts],
  );

  const removeOperation = useCallback(
    (contactId: string, opId: string) => {
      deletePhotos(findOp(contactId, opId)?.photos ?? []);
      update(contactId, (c) => ({ ...c, operations: c.operations.filter((op) => op.id !== opId) }));
    },
    [findOp, update],
  );

  /** Обновляет операцию; фото, убранные при редактировании, удаляются с устройства. */
  const updateOperation = useCallback(
    (contactId: string, opId: string, patch: Omit<Operation, 'id'>) => {
      const kept = new Set(patch.photos ?? []);
      deletePhotos((findOp(contactId, opId)?.photos ?? []).filter((uri) => !kept.has(uri)));
      update(contactId, (c) => ({
        ...c,
        operations: c.operations
          .map((op) => {
            if (op.id !== opId) return op;
            const { photos, ...rest } = { ...op, ...patch };
            return photos?.length ? { ...rest, photos } : rest;
          })
          .sort((a, b) => a.date - b.date),
      }));
    },
    [findOp, update],
  );

  /** Создаёт группу (или возвращает существующую с таким же именем) и отдаёт её id. */
  const addGroup = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      const existing = groups.find((g) => g.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing.id;
      const id = newId();
      setGroups((list) => [...list, { id, name: trimmed }]);
      return id;
    },
    [groups],
  );

  const renameGroup = useCallback(
    (id: string, name: string) => setGroups((list) => list.map((g) => (g.id === id ? { ...g, name: name.trim() } : g))),
    [],
  );

  /** Удаляет группу; её контакты остаются, но переходят в «Без группы». */
  const removeGroup = useCallback((id: string) => {
    setGroups((list) => list.filter((g) => g.id !== id));
    setContacts((list) => list.map((c) => (c.groupId === id ? { ...c, groupId: null } : c)));
    setView((v) => (v.groupId === id ? { ...v, groupId: null } : v));
  }, []);

  const importBackup = useCallback(
    (backup: Backup) => {
      // Фото, на которые копия больше не ссылается, удаляем, чтобы не копились файлы
      const kept = new Set(backup.contacts.flatMap(photosOf));
      deletePhotos(contacts.flatMap(photosOf).filter((uri) => !kept.has(uri)));
      setGroups(backup.groups);
      setContacts(backup.contacts);
      setView((v) => ({ ...v, groupId: null }));
    },
    [contacts],
  );

  return {
    loaded,
    contacts,
    groups,
    sort,
    setSort,
    view,
    setView,
    importBackup,
    addOperation,
    addContact,
    payOff,
    clearHistory,
    rename,
    setContactGroup,
    setPhoto,
    removeContact,
    removeOperation,
    updateOperation,
    addGroup,
    renameGroup,
    removeGroup,
  };
}
