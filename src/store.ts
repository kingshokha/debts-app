import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { deletePhoto } from './photos';
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
    (contactId: string, amount: number, date: number, comment: string) =>
      update(contactId, (c) => ({ ...c, operations: insertOp(c.operations, { id: newId(), amount, date, comment }) })),
    [update],
  );

  /**
   * Новый контакт; если контакт с таким именем уже есть — операция добавляется к нему,
   * а группа проставляется, только если у него группы ещё не было.
   */
  const addContact = useCallback(
    (name: string, amount: number, date: number, comment: string, groupId: string | null) => {
      const trimmed = name.trim();
      setContacts((list) => {
        const op: Operation = { id: newId(), amount, date, comment };
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
        return { ...c, operations: insertOp(c.operations, { id: newId(), amount: -balance, date: Date.now(), comment: 'Погашение' }) };
      }),
    [update],
  );

  /** Схлопывает историю в одну операцию с текущим балансом. */
  const clearHistory = useCallback(
    (id: string) =>
      update(id, (c) => {
        const balance = balanceOf(c);
        const operations = balance ? [{ id: newId(), amount: balance, date: Date.now(), comment: lastCommentOf(c) }] : [];
        return { ...c, operations };
      }),
    [update],
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
      if (old !== photo) deletePhoto(old);
      update(id, (c) => ({ ...c, photo }));
    },
    [contacts, update],
  );

  const removeContact = useCallback(
    (id: string) => {
      deletePhoto(contacts.find((c) => c.id === id)?.photo);
      setContacts((list) => list.filter((c) => c.id !== id));
    },
    [contacts],
  );

  const removeOperation = useCallback(
    (contactId: string, opId: string) =>
      update(contactId, (c) => ({ ...c, operations: c.operations.filter((op) => op.id !== opId) })),
    [update],
  );

  const updateOperation = useCallback(
    (contactId: string, opId: string, patch: Omit<Operation, 'id'>) =>
      update(contactId, (c) => ({
        ...c,
        operations: c.operations.map((op) => (op.id === opId ? { ...op, ...patch } : op)).sort((a, b) => a.date - b.date),
      })),
    [update],
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
      const kept = new Set(backup.contacts.map((c) => c.photo));
      for (const c of contacts) if (!kept.has(c.photo)) deletePhoto(c.photo);
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
