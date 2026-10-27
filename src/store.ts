import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { Contact, Operation, SortSettings } from './types';

const DATA_KEY = 'debts/contacts/v1';
const SORT_KEY = 'debts/sort/v1';

const DEFAULT_SORT: SortSettings = { key: 'date', desc: true, showZero: true };

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const balanceOf = (c: Contact) => Math.round(c.operations.reduce((s, op) => s + op.amount, 0) * 100) / 100;

export const lastDateOf = (c: Contact) => c.operations.at(-1)?.date ?? c.createdAt;

export const lastCommentOf = (c: Contact) => c.operations.findLast((op) => op.comment)?.comment ?? '';

const insertOp = (ops: Operation[], op: Operation) => [...ops, op].sort((a, b) => a.date - b.date);

/** Проверка импортируемых данных: массив контактов с операциями. */
export function parseBackup(text: string): Contact[] | null {
  try {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data?.contacts;
    if (!Array.isArray(list)) return null;
    return list.map((c: any) => ({
      id: String(c.id ?? newId()),
      name: String(c.name ?? ''),
      createdAt: Number(c.createdAt ?? Date.now()),
      operations: (Array.isArray(c.operations) ? c.operations : [])
        .map((op: any) => ({
          id: String(op.id ?? newId()),
          amount: Number(op.amount) || 0,
          date: Number(op.date ?? Date.now()),
          comment: String(op.comment ?? ''),
        }))
        .sort((a: Operation, b: Operation) => a.date - b.date),
    }));
  } catch {
    return null;
  }
}

export function useDebts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sort, setSort] = useState<SortSettings>(DEFAULT_SORT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [data, sortData] = await Promise.all([AsyncStorage.getItem(DATA_KEY), AsyncStorage.getItem(SORT_KEY)]);
        if (data) setContacts(JSON.parse(data));
        if (sortData) setSort({ ...DEFAULT_SORT, ...JSON.parse(sortData) });
      } catch (e) {
        console.warn('Не удалось загрузить данные', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(DATA_KEY, JSON.stringify(contacts)).catch((e) => console.warn(e));
  }, [contacts, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(SORT_KEY, JSON.stringify(sort)).catch((e) => console.warn(e));
  }, [sort, loaded]);

  const update = useCallback((id: string, fn: (c: Contact) => Contact) => {
    setContacts((list) => list.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const addOperation = useCallback(
    (contactId: string, amount: number, date: number, comment: string) =>
      update(contactId, (c) => ({ ...c, operations: insertOp(c.operations, { id: newId(), amount, date, comment }) })),
    [update],
  );

  /** Новый контакт; если контакт с таким именем уже есть — операция добавляется к нему. */
  const addContact = useCallback((name: string, amount: number, date: number, comment: string) => {
    const trimmed = name.trim();
    setContacts((list) => {
      const op: Operation = { id: newId(), amount, date, comment };
      const existing = list.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        return list.map((c) => (c.id === existing.id ? { ...c, operations: insertOp(c.operations, op) } : c));
      }
      return [...list, { id: newId(), name: trimmed, createdAt: Date.now(), operations: [op] }];
    });
  }, []);

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

  const removeContact = useCallback((id: string) => setContacts((list) => list.filter((c) => c.id !== id)), []);

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

  return {
    loaded,
    contacts,
    sort,
    setSort,
    replaceAll: setContacts,
    addOperation,
    addContact,
    payOff,
    clearHistory,
    rename,
    removeContact,
    removeOperation,
    updateOperation,
  };
}
