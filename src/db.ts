import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseAsync, type SQLiteBindValue, type SQLiteDatabase } from 'expo-sqlite';
import { type Backup, normalizeBackup } from './backup';
import type { ImportPlan } from './import/merge';
import type { Contact, Group, Operation } from './types';

// Хранилище — SQLite. Суммы — целые дирамы (100 = 1 сомони).
// Приложение держит данные в памяти (см. store.ts), а сюда пишет каждое изменение точечным запросом.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  group_id TEXT,
  photo TEXT,
  passport TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS contacts_name ON contacts (name);
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY NOT NULL,
  contact_id TEXT NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  date INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS operations_contact ON operations (contact_id, date, amount);
CREATE TABLE IF NOT EXISTS templates (
  text TEXT PRIMARY KEY NOT NULL,
  position INTEGER NOT NULL
);
`;

let dbPromise: Promise<SQLiteDatabase> | null = null;

function getDb() {
  dbPromise ??= (async () => {
    const db = await openDatabaseAsync('debts.db');
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await db.execAsync(SCHEMA);
    return db;
  })();
  return dbPromise;
}

// Все обращения к базе идут строго по очереди, поэтому транзакция не пересекается с другими запросами
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const run = queue.then(async () => task(await getDb()));
  queue = run.catch(() => {});
  return run;
}

/** Транзакция: при любой ошибке откатывается целиком. */
export function transaction<T>(task: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  return enqueue(async (db) => {
    let result!: T;
    await db.withTransactionAsync(async () => {
      result = await task(db);
    });
    return result;
  });
}

// SQLite ограничивает число параметров в одном запросе
const MAX_PARAMS = 900;

/** Вставка пачками по несколько строк в одном INSERT — на порядок быстрее, чем по одной. */
export async function insertMany(
  db: SQLiteDatabase,
  table: string,
  columns: readonly string[],
  rows: SQLiteBindValue[][],
  onRows?: (inserted: number) => void,
) {
  const perBatch = Math.floor(MAX_PARAMS / columns.length);
  const placeholder = `(${columns.map(() => '?').join(', ')})`;
  for (let i = 0; i < rows.length; i += perBatch) {
    const batch = rows.slice(i, i + perBatch);
    await db.runAsync(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${batch.map(() => placeholder).join(', ')}`,
      batch.flat(),
    );
    onRows?.(batch.length);
  }
}

export const GROUP_COLUMNS = ['id', 'name', 'position'] as const;
export const CONTACT_COLUMNS = ['id', 'name', 'created_at', 'group_id', 'photo', 'passport'] as const;
export const OPERATION_COLUMNS = ['id', 'contact_id', 'amount', 'date', 'comment'] as const;

export const groupRow = (g: Group, position: number): SQLiteBindValue[] => [g.id, g.name, position];

export const contactRow = (c: Contact): SQLiteBindValue[] => [
  c.id,
  c.name,
  c.createdAt,
  c.groupId ?? null,
  c.photo ?? null,
  JSON.stringify(c.passport ?? []),
];

export const operationRow = (contactId: string, op: Operation): SQLiteBindValue[] => [
  op.id,
  contactId,
  op.amount,
  op.date,
  op.comment,
];

const operationRowsOf = (contacts: Contact[]) => contacts.flatMap((c) => c.operations.map((op) => operationRow(c.id, op)));

type ContactRecord = {
  id: string;
  name: string;
  created_at: number;
  group_id: string | null;
  photo: string | null;
  passport: string;
};
type OperationRecord = { id: string; contact_id: string; amount: number; date: number; comment: string };

export type Stored = { contacts: Contact[]; groups: Group[]; templates: string[] };

export async function loadAll(): Promise<Stored> {
  await migrateLegacy();
  return enqueue(async (db) => {
    const groups = await db.getAllAsync<Group>('SELECT id, name FROM groups ORDER BY position');
    const contactRecords = await db.getAllAsync<ContactRecord>('SELECT * FROM contacts ORDER BY rowid');
    // rowid сохраняет порядок ввода для операций с одинаковым временем
    const opRecords = await db.getAllAsync<OperationRecord>(
      'SELECT id, contact_id, amount, date, comment FROM operations ORDER BY date, rowid',
    );
    const templates = await db.getAllAsync<{ text: string }>('SELECT text FROM templates ORDER BY position');

    const byId = new Map<string, Contact>();
    const contacts = contactRecords.map((r) => {
      const contact: Contact = {
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        groupId: r.group_id,
        photo: r.photo,
        passport: JSON.parse(r.passport),
        operations: [],
      };
      byId.set(r.id, contact);
      return contact;
    });
    for (const r of opRecords) {
      byId.get(r.contact_id)?.operations.push({ id: r.id, amount: r.amount, date: r.date, comment: r.comment });
    }
    return { contacts, groups, templates: templates.map((t) => t.text) };
  });
}

/** Заменяет всех контактов и группы (восстановление из JSON-копии). */
export function replaceAll({ contacts, groups, templates }: Backup) {
  return transaction(async (db) => {
    await db.execAsync('DELETE FROM operations; DELETE FROM contacts; DELETE FROM groups;');
    await insertMany(db, 'groups', GROUP_COLUMNS, groups.map(groupRow));
    await insertMany(db, 'contacts', CONTACT_COLUMNS, contacts.map(contactRow));
    await insertMany(db, 'operations', OPERATION_COLUMNS, operationRowsOf(contacts));
    if (templates) {
      await db.runAsync('DELETE FROM templates');
      await insertMany(db, 'templates', ['text', 'position'], templates.map((text, i) => [text, i]));
    }
  });
}

export const insertContact = (contact: Contact) =>
  transaction(async (db) => {
    await insertMany(db, 'contacts', CONTACT_COLUMNS, [contactRow(contact)]);
    await insertMany(db, 'operations', OPERATION_COLUMNS, operationRowsOf([contact]));
  });

/** Сохраняет поля самого контакта (без операций). */
export const updateContact = (c: Contact) =>
  enqueue((db) =>
    db.runAsync('UPDATE contacts SET name = ?, group_id = ?, photo = ?, passport = ? WHERE id = ?', [
      c.name,
      c.groupId ?? null,
      c.photo ?? null,
      JSON.stringify(c.passport ?? []),
      c.id,
    ]),
  );

export const deleteContact = (id: string) =>
  transaction(async (db) => {
    await db.runAsync('DELETE FROM operations WHERE contact_id = ?', [id]);
    await db.runAsync('DELETE FROM contacts WHERE id = ?', [id]);
  });

export const insertOperation = (contactId: string, op: Operation) =>
  enqueue((db) => insertMany(db, 'operations', OPERATION_COLUMNS, [operationRow(contactId, op)]));

export const updateOperation = (op: Operation) =>
  enqueue((db) =>
    db.runAsync('UPDATE operations SET amount = ?, date = ?, comment = ? WHERE id = ?', [op.amount, op.date, op.comment, op.id]),
  );

export const deleteOperation = (id: string) => enqueue((db) => db.runAsync('DELETE FROM operations WHERE id = ?', [id]));

/** Заменяет все операции контакта (очистка истории). */
export const replaceOperations = (contactId: string, ops: Operation[]) =>
  transaction(async (db) => {
    await db.runAsync('DELETE FROM operations WHERE contact_id = ?', [contactId]);
    await insertMany(db, 'operations', OPERATION_COLUMNS, ops.map((op) => operationRow(contactId, op)));
  });

/** Групп немного — после любого изменения список перезаписывается целиком. */
export const saveGroups = (groups: Group[]) =>
  transaction(async (db) => {
    await db.runAsync('DELETE FROM groups');
    await insertMany(db, 'groups', GROUP_COLUMNS, groups.map(groupRow));
  });

/** Удаляет группу; её контакты переходят в «Без группы». */
export const removeGroup = (id: string, groups: Group[]) =>
  transaction(async (db) => {
    await db.runAsync('UPDATE contacts SET group_id = NULL WHERE group_id = ?', [id]);
    await db.runAsync('DELETE FROM groups');
    await insertMany(db, 'groups', GROUP_COLUMNS, groups.map(groupRow));
  });

/**
 * Записывает импорт одной транзакцией: при любой ошибке не остаётся ничего.
 * groups — итоговый список групп; templatesBefore — сколько шаблонов было (для их порядка).
 */
export const applyImport = (plan: ImportPlan, groups: Group[], templatesBefore: number, onProgress?: (fraction: number) => void) =>
  transaction(async (db) => {
    const operations = [
      ...operationRowsOf(plan.newContacts),
      ...plan.addedOperations.map(({ contactId, operation }) => operationRow(contactId, operation)),
    ];
    const total = Math.max(1, plan.newContacts.length + operations.length);
    let done = 0;
    const report = (n: number) => {
      done += n;
      onProgress?.(done / total);
    };

    if (plan.newGroups.length) {
      await db.runAsync('DELETE FROM groups');
      await insertMany(db, 'groups', GROUP_COLUMNS, groups.map(groupRow));
    }
    await insertMany(db, 'contacts', CONTACT_COLUMNS, plan.newContacts.map(contactRow), report);
    await insertMany(db, 'operations', OPERATION_COLUMNS, operations, report);
    for (const { contactId, groupId } of plan.groupAssignments) {
      await db.runAsync('UPDATE contacts SET group_id = ? WHERE id = ?', [groupId, contactId]);
    }
    await insertMany(
      db,
      'templates',
      ['text', 'position'],
      plan.newTemplates.map((text, i) => [text, templatesBefore + i]),
    );
  });

// Раньше всё лежало одной JSON-строкой в AsyncStorage, а суммы были в сомони
const LEGACY_CONTACTS_KEY = 'debts/contacts/v1';
const LEGACY_GROUPS_KEY = 'debts/groups/v1';

/**
 * Однократно переносит данные из AsyncStorage в SQLite. Старые значения не стираются,
 * а переезжают под ключ с суффиксом «-migrated»: если с переносом что-то не так, их можно вернуть.
 */
async function migrateLegacy() {
  const [[, contactsJson], [, groupsJson]] = await AsyncStorage.multiGet([LEGACY_CONTACTS_KEY, LEGACY_GROUPS_KEY]);
  if (contactsJson === null && groupsJson === null) return;
  let backup: Backup | null = null;
  try {
    backup = normalizeBackup({
      version: 2,
      contacts: contactsJson ? JSON.parse(contactsJson) : [],
      groups: groupsJson ? JSON.parse(groupsJson) : [],
    });
  } catch (e) {
    console.warn('Старые данные не читаются', e);
  }
  // Повреждённые данные тоже откладываем, иначе перенос пытался бы повториться при каждом запуске
  if (backup) await replaceAll(backup);
  await AsyncStorage.multiSet([
    [`${LEGACY_CONTACTS_KEY}-migrated`, contactsJson ?? '[]'],
    [`${LEGACY_GROUPS_KEY}-migrated`, groupsJson ?? '[]'],
  ]);
  await AsyncStorage.multiRemove([LEGACY_CONTACTS_KEY, LEGACY_GROUPS_KEY]);
}
