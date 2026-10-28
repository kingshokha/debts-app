import { newId } from './id';
import type { Contact, Group, Operation } from './types';

/** templates — шаблоны заметок; в старых копиях их нет, тогда текущие шаблоны не трогаем. */
export type Backup = { contacts: Contact[]; groups: Group[]; templates?: string[] };

/** С этой версии суммы в копии — целые дирамы; в более старых — сомони. */
const DIRAM_VERSION = 3;

export function serializeBackup(contacts: Contact[], groups: Group[], templates: string[]) {
  return JSON.stringify({ app: 'debts', version: DIRAM_VERSION, contacts, groups, templates });
}

/** Приводит данные копии к текущей модели. Понимает и старый формат — просто массив контактов. */
export function normalizeBackup(data: any): Backup | null {
  const list = Array.isArray(data) ? data : data?.contacts;
  if (!Array.isArray(list)) return null;
  const scale = Number(data?.version) >= DIRAM_VERSION ? 1 : 100;
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
    passport: Array.isArray(c.passport) ? c.passport.filter((uri: unknown) => typeof uri === 'string') : [],
    operations: (Array.isArray(c.operations) ? c.operations : [])
      .map((op: any) => ({
        id: String(op.id ?? newId()),
        amount: Math.round((Number(op.amount) || 0) * scale),
        date: Number(op.date ?? Date.now()),
        comment: String(op.comment ?? ''),
      }))
      .sort((a: Operation, b: Operation) => a.date - b.date),
  }));
  const templates = Array.isArray(data?.templates)
    ? data.templates.filter((t: unknown): t is string => typeof t === 'string')
    : undefined;
  return { contacts, groups, templates };
}

export function parseBackup(text: string): Backup | null {
  try {
    return normalizeBackup(JSON.parse(text));
  } catch {
    return null;
  }
}
