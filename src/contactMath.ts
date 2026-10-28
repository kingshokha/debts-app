import type { Contact, SortKey } from './types';

// Расчёты по контактам, которые выполняются тысячи раз за отрисовку (сортировка, итоги, поиск).
// Контакт неизменяем: любая правка создаёт новый объект, поэтому результат можно запомнить
// для объекта в WeakMap — он пересчитается сам, когда контакт заменят.

const balances = new WeakMap<Contact, number>();
const searchTexts = new WeakMap<Contact, string>();

/** Баланс в дирамах. */
export function balanceOf(c: Contact) {
  let balance = balances.get(c);
  if (balance === undefined) {
    balance = c.operations.reduce((s, op) => s + op.amount, 0);
    balances.set(c, balance);
  }
  return balance;
}

export const lastDateOf = (c: Contact) => c.operations.at(-1)?.date ?? c.createdAt;

export const lastCommentOf = (c: Contact) => c.operations.findLast((op) => op.comment)?.comment ?? '';

/** Имя и все комментарии в нижнем регистре — для поиска одной проверкой includes. */
function searchTextOf(c: Contact) {
  let text = searchTexts.get(c);
  if (text === undefined) {
    text = [c.name, ...c.operations.map((op) => op.comment)].join('\n').toLowerCase();
    searchTexts.set(c, text);
  }
  return text;
}

export const matchesSearch = (c: Contact, query: string) => !query || searchTextOf(c).includes(query);

// Один объект сравнения на всё приложение: localeCompare(…, 'ru') в Hermes создаёт его заново
// на каждое сравнение, и сортировка 1700 имён занимала секунды
const collator = new Intl.Collator('ru');

/** Контакты по возрастанию ключа; при равных ключах — в исходном порядке. Направление — разворотом. */
export function sortContacts(contacts: Contact[], key: SortKey): Contact[] {
  if (key === 'name') return [...contacts].sort((a, b) => collator.compare(a.name, b.name));
  // Ключи считаем один раз, а не в каждом сравнении
  const keyOf = key === 'amount' ? balanceOf : lastDateOf;
  const keyed = contacts.map((c) => ({ c, k: keyOf(c) }));
  keyed.sort((a, b) => a.k - b.k);
  return keyed.map((x) => x.c);
}
