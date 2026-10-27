import type { Contact } from '../../types';
import { readDebtBook } from '../debtBook';
import { buildDebtBook } from '../fixture';
import { type AppData, applyPlan, planImport } from '../merge';

const T = (day: number) => Date.UTC(2020, 0, day, 10, 0);

const text = buildDebtBook({
  clients: [
    { name: 'ШМ Тестов Рустам', balance: 41_000 },
    { name: 'ШЗ Примерова Зарина', balance: 0 },
    { name: 'ОВД Образцов', balance: -8_600 },
  ],
  operations: [
    { name: 'ШМ Тестов Рустам', date: T(3), amount: -19_000 },
    { name: 'ОВД Образцов', date: T(1), amount: -8_600, comment: 'Предоплата' },
    { name: 'ШМ Тестов Рустам', date: T(1), amount: 79_000 },
    { name: 'ШМ Тестов Рустам', date: T(2), amount: -19_000 },
  ],
  templates: ['Пылесос', 'Туб_115+25+25 камир'],
});

const EMPTY: AppData = { contacts: [], groups: [], templates: [] };
const balance = (c: Contact) => c.operations.reduce((s, op) => s + op.amount, 0);

describe('planImport / applyPlan', () => {
  it('первый импорт создаёт всех клиентов, группы и шаблоны', async () => {
    const book = await readDebtBook(text);
    const plan = planImport(book, EMPTY);
    expect(plan.stats).toEqual({
      contactsAdded: 3,
      contactsMatched: 0,
      operationsAdded: 4,
      operationsSkipped: 0,
      templatesAdded: 2,
      groupsAdded: 3,
    });

    const data = applyPlan(EMPTY, plan);
    expect(data.groups.map((g) => g.name)).toEqual(['ШМ', 'ШЗ', 'ОВД']);
    const groupName = (c: Contact) => data.groups.find((g) => g.id === c.groupId)?.name;
    expect(data.contacts.map(groupName)).toEqual(['ШМ', 'ШЗ', 'ОВД']);
    // Балансы пересчитываются из операций и совпадают с файлом
    expect(data.contacts.map(balance)).toEqual(book.clients.map((c) => c.balance));
    expect(data.contacts[0].operations.map((op) => op.date)).toEqual([T(1), T(2), T(3)]);
    // Клиент без операций создаётся с временем бэкапа
    expect(data.contacts[1]).toMatchObject({ operations: [], createdAt: book.header.backupTime });
    expect(data.templates).toEqual(['Пылесос', 'Туб_115+25+25 камир']);
  });

  it('повторный импорт того же файла не создаёт дублей', async () => {
    const book = await readDebtBook(text);
    const once = applyPlan(EMPTY, planImport(book, EMPTY));

    const again = planImport(book, once);
    expect(again.stats).toEqual({
      contactsAdded: 0,
      contactsMatched: 3,
      operationsAdded: 0,
      operationsSkipped: 4,
      templatesAdded: 0,
      groupsAdded: 0,
    });
    const twice = applyPlan(once, again);
    expect(twice.contacts).toHaveLength(3);
    expect(twice.contacts.flatMap((c) => c.operations)).toHaveLength(4);
    expect(twice.groups).toHaveLength(3);
    expect(twice.templates).toHaveLength(2);
    expect(twice.contacts.map(balance)).toEqual([41_000, 0, -8_600]);
  });

  it('добавляет к существующему клиенту только недостающие операции', async () => {
    const book = await readDebtBook(text);
    const existing: AppData = {
      contacts: [
        {
          id: 'testov',
          name: 'ШМ Тестов Рустам',
          createdAt: T(1),
          groupId: null,
          operations: [
            { id: 'o1', date: T(1), amount: 79_000, comment: 'введено вручную' },
            { id: 'o2', date: T(5), amount: 1_000, comment: 'своя операция' },
          ],
        },
      ],
      groups: [{ id: 'g1', name: 'шм' }], // группа совпадает без учёта регистра
      templates: ['Пылесос'],
    };
    const plan = planImport(book, existing);
    expect(plan.stats).toMatchObject({ contactsAdded: 2, contactsMatched: 1, operationsAdded: 3, operationsSkipped: 1 });
    expect(plan.addedOperations.map((a) => a.operation.date)).toEqual([T(2), T(3)]);
    expect(plan.groupAssignments).toEqual([{ contactId: 'testov', groupId: 'g1' }]);
    expect(plan.newTemplates).toEqual(['Туб_115+25+25 камир']);

    const testov = applyPlan(existing, plan).contacts[0];
    expect(testov.groupId).toBe('g1');
    expect(testov.operations.map((op) => op.id).slice(0, 1)).toEqual(['o1']);
    expect(testov.operations.map((op) => op.date)).toEqual([T(1), T(2), T(3), T(5)]);
  });

  it('ищет клиента по точному имени', async () => {
    const book = await readDebtBook(text);
    const existing: AppData = {
      contacts: [{ id: 'x', name: 'шм тестов рустам', createdAt: 0, operations: [] }],
      groups: [],
      templates: [],
    };
    expect(planImport(book, existing).stats.contactsAdded).toBe(3);
  });

  it('при двух одинаковых операциях в файле и одной в приложении добавляет вторую', async () => {
    const book = await readDebtBook(
      buildDebtBook({
        clients: [{ name: 'А', balance: 200 }],
        operations: [
          { name: 'А', date: T(1), amount: 100 },
          { name: 'А', date: T(1), amount: 100 },
        ],
      }),
    );
    const existing: AppData = {
      contacts: [{ id: 'a', name: 'А', createdAt: 0, operations: [{ id: 'o', date: T(1), amount: 100, comment: '' }] }],
      groups: [],
      templates: [],
    };
    expect(planImport(book, existing).stats).toMatchObject({ operationsAdded: 1, operationsSkipped: 1 });
  });
});
