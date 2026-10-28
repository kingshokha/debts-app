import { balanceOf, matchesSearch, sortContacts } from '../contactMath';
import type { Contact } from '../types';

let n = 0;
const contact = (name: string, amounts: number[], comment = ''): Contact => ({
  id: String(n++),
  name,
  createdAt: 0,
  operations: amounts.map((amount, i) => ({ id: `${n}-${i}`, amount, date: 1000 * (n * 10 + i), comment })),
});

describe('sortContacts', () => {
  const a = contact('ШМ Борис', [500]);
  const b = contact('ШЗ Ёлкина', [-100]);
  const c = contact('ПЗ Ҷамшед', [500]);
  const d = contact('ОВД Анна', [0], 'Предоплата');

  it('по имени — по-русски, ё и таджикские буквы на своих местах', () => {
    expect(sortContacts([a, b, c, d], 'name').map((x) => x.name)).toEqual(['ОВД Анна', 'ПЗ Ҷамшед', 'ШЗ Ёлкина', 'ШМ Борис']);
  });

  it('по сумме, равные остаются в исходном порядке', () => {
    expect(sortContacts([a, b, c, d], 'amount')).toEqual([b, d, a, c]);
    expect(sortContacts([c, a], 'amount')).toEqual([c, a]);
  });

  it('по дате последней операции', () => {
    expect(sortContacts([d, a, c, b], 'date')).toEqual([a, b, c, d]);
  });

  it('не меняет исходный массив', () => {
    const list = [d, a];
    sortContacts(list, 'name');
    expect(list).toEqual([d, a]);
  });
});

describe('кэш баланса', () => {
  it('новый объект контакта считается заново', () => {
    const x = contact('Х', [100, 200]);
    expect(balanceOf(x)).toBe(300);
    const changed = { ...x, operations: [...x.operations, { id: 'new', amount: -50, date: 9e12, comment: '' }] };
    expect(balanceOf(changed)).toBe(250);
    expect(balanceOf(x)).toBe(300);
  });
});

describe('matchesSearch', () => {
  it('ищет по имени и комментариям без учёта регистра', () => {
    const x = contact('ШМ Акбар', [100], 'Пылесос 780-200');
    expect(matchesSearch(x, '')).toBe(true);
    expect(matchesSearch(x, 'акбар')).toBe(true);
    expect(matchesSearch(x, 'пылесос')).toBe(true);
    expect(matchesSearch(x, 'холодильник')).toBe(false);
  });
});
