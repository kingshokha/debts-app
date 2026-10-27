import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Backup } from './backup';
import { notify } from './confirm';
import * as db from './db';
import { newId } from './id';
import { deletePhotos } from './photos';
import type { Contact, Group, Operation, SortSettings, ViewSettings } from './types';

const SORT_KEY = 'debts/sort/v1';
const VIEW_KEY = 'debts/view/v1';

const DEFAULT_SORT: SortSettings = { key: 'date', desc: true, showZero: true };
const DEFAULT_VIEW: ViewSettings = { mode: 'all', groupId: null };

/** Баланс в дирамах. */
export const balanceOf = (c: Contact) => c.operations.reduce((s, op) => s + op.amount, 0);

export const lastDateOf = (c: Contact) => c.operations.at(-1)?.date ?? c.createdAt;

export const lastCommentOf = (c: Contact) => c.operations.findLast((op) => op.comment)?.comment ?? '';

const insertOp = (ops: Operation[], op: Operation) => [...ops, op].sort((a, b) => a.date - b.date);

/** Все файлы фото контакта: его фото и фото паспорта. */
export const photosOf = (c: Contact) => [c.photo, ...(c.passport ?? [])];

/** Запись в базу идёт в фоне; если она не удалась, данные в памяти и в базе разойдутся — сообщаем. */
function save(write: Promise<unknown>) {
  write.catch((e) => {
    console.warn('Ошибка базы данных', e);
    notify('Не удалось сохранить изменения', 'Перезапустите приложение и проверьте последние действия.');
  });
}

/** Сохраняет значение в AsyncStorage при каждом изменении (после первичной загрузки). */
function usePersist(key: string, value: unknown, loaded: boolean) {
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(key, JSON.stringify(value)).catch((e) => console.warn(e));
  }, [key, value, loaded]);
}

export function useDebts() {
  const [contacts, setContactsState] = useState<Contact[]>([]);
  const [groups, setGroupsState] = useState<Group[]>([]);
  const [sort, setSort] = useState<SortSettings>(DEFAULT_SORT);
  const [view, setView] = useState<ViewSettings>(DEFAULT_VIEW);
  const [loaded, setLoaded] = useState(false);

  // Актуальные данные для действий: из них считается и новое состояние, и запись в базу
  const contactsRef = useRef(contacts);
  const groupsRef = useRef(groups);

  const setContacts = useCallback((next: Contact[]) => {
    contactsRef.current = next;
    setContactsState(next);
  }, []);

  const setGroups = useCallback((next: Group[]) => {
    groupsRef.current = next;
    setGroupsState(next);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [stored, sortData, viewData] = await Promise.all([
          db.loadAll(),
          AsyncStorage.getItem(SORT_KEY),
          AsyncStorage.getItem(VIEW_KEY),
        ]);
        setContacts(stored.contacts);
        setGroups(stored.groups);
        if (sortData) setSort({ ...DEFAULT_SORT, ...JSON.parse(sortData) });
        if (viewData) setView({ ...DEFAULT_VIEW, ...JSON.parse(viewData) });
      } catch (e) {
        console.warn('Не удалось загрузить данные', e);
        notify('Не удалось открыть базу данных', String((e as Error)?.message ?? e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [setContacts, setGroups]);

  usePersist(SORT_KEY, sort, loaded);
  usePersist(VIEW_KEY, view, loaded);

  const replaceContact = useCallback(
    (next: Contact) => setContacts(contactsRef.current.map((c) => (c.id === next.id ? next : c))),
    [setContacts],
  );

  /** Меняет поля контакта (имя, группа, фото) и сохраняет их. */
  const updateContact = useCallback(
    (id: string, fn: (c: Contact) => Contact) => {
      const contact = contactsRef.current.find((c) => c.id === id);
      if (!contact) return;
      const next = fn(contact);
      replaceContact(next);
      save(db.updateContact(next));
    },
    [replaceContact],
  );

  const addOperation = useCallback(
    (contactId: string, amount: number, date: number, comment: string) => {
      const contact = contactsRef.current.find((c) => c.id === contactId);
      if (!contact) return;
      const op: Operation = { id: newId(), amount, date, comment };
      replaceContact({ ...contact, operations: insertOp(contact.operations, op) });
      save(db.insertOperation(contactId, op));
    },
    [replaceContact],
  );

  /**
   * Новый контакт; если контакт с таким именем уже есть — операция добавляется к нему,
   * группа и фото проставляются, только если их ещё не было, а фото паспорта дописываются.
   */
  const addContact = useCallback(
    (
      name: string,
      amount: number,
      date: number,
      comment: string,
      groupId: string | null,
      photo: string | null,
      passport: string[],
    ) => {
      const trimmed = name.trim();
      const existing = contactsRef.current.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
      const op: Operation = { id: newId(), amount, date, comment };
      if (existing) {
        // У существующего контакта своё фото остаётся — новое не понадобится
        if (photo && existing.photo) deletePhotos([photo]);
        const next: Contact = {
          ...existing,
          groupId: existing.groupId ?? groupId,
          photo: existing.photo ?? photo,
          passport: [...(existing.passport ?? []), ...passport],
          operations: insertOp(existing.operations, op),
        };
        replaceContact(next);
        save(db.updateContact(next));
        save(db.insertOperation(existing.id, op));
        return;
      }
      const contact: Contact = { id: newId(), name: trimmed, createdAt: Date.now(), groupId, photo, passport, operations: [op] };
      setContacts([...contactsRef.current, contact]);
      save(db.insertContact(contact));
    },
    [replaceContact, setContacts],
  );

  const payOff = useCallback(
    (id: string) => {
      const contact = contactsRef.current.find((c) => c.id === id);
      const balance = contact ? balanceOf(contact) : 0;
      if (balance) addOperation(id, -balance, Date.now(), 'Погашение');
    },
    [addOperation],
  );

  /** Схлопывает историю в одну операцию с текущим балансом. */
  const clearHistory = useCallback(
    (id: string) => {
      const contact = contactsRef.current.find((c) => c.id === id);
      if (!contact) return;
      const balance = balanceOf(contact);
      const operations = balance ? [{ id: newId(), amount: balance, date: Date.now(), comment: lastCommentOf(contact) }] : [];
      replaceContact({ ...contact, operations });
      save(db.replaceOperations(id, operations));
    },
    [replaceContact],
  );

  const rename = useCallback((id: string, name: string) => updateContact(id, (c) => ({ ...c, name: name.trim() })), [updateContact]);

  const setContactGroup = useCallback(
    (id: string, groupId: string | null) => updateContact(id, (c) => ({ ...c, groupId })),
    [updateContact],
  );

  /** Ставит или убирает фото; старый файл удаляется. */
  const setPhoto = useCallback(
    (id: string, photo: string | null) =>
      updateContact(id, (c) => {
        if (c.photo !== photo) deletePhotos([c.photo]);
        return { ...c, photo };
      }),
    [updateContact],
  );

  /** Заменяет фото паспорта; убранные файлы удаляются. */
  const setPassport = useCallback(
    (id: string, passport: string[]) =>
      updateContact(id, (c) => {
        const kept = new Set(passport);
        deletePhotos((c.passport ?? []).filter((uri) => !kept.has(uri)));
        return { ...c, passport };
      }),
    [updateContact],
  );

  const removeContact = useCallback(
    (id: string) => {
      const contact = contactsRef.current.find((c) => c.id === id);
      if (contact) deletePhotos(photosOf(contact));
      setContacts(contactsRef.current.filter((c) => c.id !== id));
      save(db.deleteContact(id));
    },
    [setContacts],
  );

  const removeOperation = useCallback(
    (contactId: string, opId: string) => {
      const contact = contactsRef.current.find((c) => c.id === contactId);
      if (!contact) return;
      replaceContact({ ...contact, operations: contact.operations.filter((op) => op.id !== opId) });
      save(db.deleteOperation(opId));
    },
    [replaceContact],
  );

  const updateOperation = useCallback(
    (contactId: string, opId: string, patch: Omit<Operation, 'id'>) => {
      const contact = contactsRef.current.find((c) => c.id === contactId);
      if (!contact) return;
      const updated: Operation = { id: opId, ...patch };
      replaceContact({
        ...contact,
        operations: contact.operations.map((op) => (op.id === opId ? updated : op)).sort((a, b) => a.date - b.date),
      });
      save(db.updateOperation(updated));
    },
    [replaceContact],
  );

  /** Создаёт группу (или возвращает существующую с таким же именем) и отдаёт её id. */
  const addGroup = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      const existing = groupsRef.current.find((g) => g.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing.id;
      const id = newId();
      const next = [...groupsRef.current, { id, name: trimmed }];
      setGroups(next);
      save(db.saveGroups(next));
      return id;
    },
    [setGroups],
  );

  const renameGroup = useCallback(
    (id: string, name: string) => {
      const next = groupsRef.current.map((g) => (g.id === id ? { ...g, name: name.trim() } : g));
      setGroups(next);
      save(db.saveGroups(next));
    },
    [setGroups],
  );

  /** Удаляет группу; её контакты остаются, но переходят в «Без группы». */
  const removeGroup = useCallback(
    (id: string) => {
      const next = groupsRef.current.filter((g) => g.id !== id);
      setGroups(next);
      setContacts(contactsRef.current.map((c) => (c.groupId === id ? { ...c, groupId: null } : c)));
      setView((v) => (v.groupId === id ? { ...v, groupId: null } : v));
      save(db.removeGroup(id, next));
    },
    [setContacts, setGroups],
  );

  /** Заменяет все данные копией. Состояние меняется, только если запись в базу прошла. */
  const importBackup = useCallback(
    async (backup: Backup) => {
      try {
        await db.replaceAll(backup);
      } catch (e) {
        console.warn(e);
        notify('Не удалось восстановить копию', 'Данные остались прежними.');
        return;
      }
      // Фото, на которые копия больше не ссылается, удаляем, чтобы не копились файлы
      const kept = new Set(backup.contacts.flatMap(photosOf));
      deletePhotos(contactsRef.current.flatMap(photosOf).filter((uri) => !kept.has(uri)));
      setGroups(backup.groups);
      setContacts(backup.contacts);
      setView((v) => ({ ...v, groupId: null }));
    },
    [setContacts, setGroups],
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
    setPassport,
    removeContact,
    removeOperation,
    updateOperation,
    addGroup,
    renameGroup,
    removeGroup,
  };
}
