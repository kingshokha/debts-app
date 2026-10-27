import { newId } from '../id';
import type { Contact, Group, Operation } from '../types';
import type { DebtBook } from './debtBook';

// Сопоставление файла с данными приложения. Чистые функции: без базы и интерфейса.
// Клиент ищется по точному имени; операция — дубль, если у клиента уже есть операция с тем же временем и суммой.

export type AppData = { contacts: Contact[]; groups: Group[]; templates: string[] };

export type ImportStats = {
  contactsAdded: number;
  contactsMatched: number;
  operationsAdded: number;
  operationsSkipped: number;
  templatesAdded: number;
  groupsAdded: number;
};

export type ImportPlan = {
  newGroups: Group[];
  newContacts: Contact[];
  /** Новые операции уже существующих контактов. */
  addedOperations: { contactId: string; operation: Operation }[];
  /** Существующие контакты без группы получают группу из метки в имени. */
  groupAssignments: { contactId: string; groupId: string }[];
  newTemplates: string[];
  stats: ImportStats;
};

const opKey = (date: number, amount: number) => `${date}|${amount}`;

export function planImport(book: DebtBook, current: AppData): ImportPlan {
  const groupIdByName = new Map(current.groups.map((g) => [g.name.toLowerCase(), g.id]));
  const newGroups: Group[] = [];
  const groupIdFor = (label: string | null) => {
    if (!label) return null;
    let id = groupIdByName.get(label.toLowerCase());
    if (!id) {
      id = newId();
      groupIdByName.set(label.toLowerCase(), id);
      newGroups.push({ id, name: label });
    }
    return id;
  };

  const contactByName = new Map<string, Contact>();
  for (const c of current.contacts) if (!contactByName.has(c.name)) contactByName.set(c.name, c);

  const newContacts: Contact[] = [];
  const addedOperations: ImportPlan['addedOperations'] = [];
  const groupAssignments: ImportPlan['groupAssignments'] = [];
  let operationsSkipped = 0;

  for (const client of book.clients) {
    const existing = contactByName.get(client.name);
    if (!existing) {
      newContacts.push({
        id: newId(),
        name: client.name,
        createdAt: client.operations[0]?.date ?? book.header.backupTime,
        groupId: groupIdFor(client.group),
        photo: null,
        passport: [],
        operations: client.operations.map((op) => ({ id: newId(), ...op })),
      });
      continue;
    }

    if (!existing.groupId && client.group) {
      groupAssignments.push({ contactId: existing.id, groupId: groupIdFor(client.group)! });
    }
    // Считаем совпадения поштучно: если в файле две одинаковые операции, а в приложении одна — добавится вторая
    const available = new Map<string, number>();
    for (const op of existing.operations) {
      const key = opKey(op.date, op.amount);
      available.set(key, (available.get(key) ?? 0) + 1);
    }
    for (const op of client.operations) {
      const key = opKey(op.date, op.amount);
      const left = available.get(key) ?? 0;
      if (left > 0) {
        available.set(key, left - 1);
        operationsSkipped++;
      } else {
        addedOperations.push({ contactId: existing.id, operation: { id: newId(), ...op } });
      }
    }
  }

  const knownTemplates = new Set(current.templates);
  const newTemplates: string[] = [];
  for (const t of book.templates) {
    if (!knownTemplates.has(t)) {
      knownTemplates.add(t);
      newTemplates.push(t);
    }
  }

  return {
    newGroups,
    newContacts,
    addedOperations,
    groupAssignments,
    newTemplates,
    stats: {
      contactsAdded: newContacts.length,
      contactsMatched: book.clients.length - newContacts.length,
      operationsAdded: newContacts.reduce((n, c) => n + c.operations.length, 0) + addedOperations.length,
      operationsSkipped,
      templatesAdded: newTemplates.length,
      groupsAdded: newGroups.length,
    },
  };
}

/** Данные приложения после импорта — то же, что окажется в базе. */
export function applyPlan(current: AppData, plan: ImportPlan): AppData {
  const addedByContact = new Map<string, Operation[]>();
  for (const { contactId, operation } of plan.addedOperations) {
    const list = addedByContact.get(contactId);
    if (list) list.push(operation);
    else addedByContact.set(contactId, [operation]);
  }
  const groupByContact = new Map(plan.groupAssignments.map((a) => [a.contactId, a.groupId]));

  const contacts = current.contacts.map((c) => {
    const added = addedByContact.get(c.id);
    const groupId = groupByContact.get(c.id);
    if (!added && !groupId) return c;
    return {
      ...c,
      groupId: groupId ?? c.groupId,
      // Сортировка устойчивая: при одинаковом времени старые операции остаются раньше новых
      operations: added ? [...c.operations, ...added].sort((a, b) => a.date - b.date) : c.operations,
    };
  });

  return {
    contacts: [...contacts, ...plan.newContacts],
    groups: [...current.groups, ...plan.newGroups],
    templates: [...current.templates, ...plan.newTemplates],
  };
}
