import { amountToInput, formatAgo, formatAmount, formatAmountShort, formatDateTimeFull, parseAmount, plural } from '../format';

describe('суммы в дирамах', () => {
  it('показывает сомони с двумя знаками', () => {
    expect(formatAmount(82_519_700)).toBe('+825 197,00');
    expect(formatAmount(-11_600)).toBe('-116,00');
    expect(formatAmount(150_050, false)).toBe('1 500,50');
    expect(formatAmount(5)).toBe('+0,05');
    expect(formatAmount(0)).toBe('0,00');
  });

  it('коротко — без «,00», если дирамов нет', () => {
    expect(formatAmountShort(82_003_200)).toBe('+820 032');
    expect(formatAmountShort(-11_600)).toBe('-116');
    expect(formatAmountShort(1_250)).toBe('+12,50');
    expect(formatAmountShort(0)).toBe('0');
  });

  it('переводит ввод в сомони в целые дирамы', () => {
    expect(parseAmount('1500')).toBe(150_000);
    expect(parseAmount('100,5')).toBe(10_050);
    expect(parseAmount('0.1+0.2')).toBe(30);
    expect(parseAmount('2280-200')).toBe(208_000);
    expect(parseAmount('abc')).toBeNull();
  });

  it('возвращает сумму в поле ввода без лишних нулей', () => {
    expect(amountToInput(150_000)).toBe('1500');
    expect(amountToInput(-150_050)).toBe('1500,5');
    expect(amountToInput(10_000)).toBe('100');
    expect(amountToInput(7)).toBe('0,07');
  });
});

describe('даты', () => {
  const now = new Date(2026, 9, 28, 12, 0).getTime();
  const H = 60 * 60 * 1000;

  it('пишет, сколько прошло, с правильным склонением', () => {
    expect(formatAgo(now - 30 * 1000, now)).toBe('только что');
    expect(formatAgo(now - 21 * 60 * 1000, now)).toBe('21 минуту назад');
    expect(formatAgo(now - 19 * H, now)).toBe('19 часов назад');
    expect(formatAgo(now - 22 * H, now)).toBe('22 часа назад');
    expect(formatAgo(now - 3 * 24 * H, now)).toBe('3 дня назад');
    expect(formatAgo(now - 7 * 24 * H, now)).toBe('7 дней назад');
    expect(formatAgo(new Date(2026, 9, 20, 9, 0).getTime(), now)).toBe('20 окт. 2026 г.');
  });

  it('склоняет числа', () => {
    expect([1, 2, 5, 11, 12, 14, 21, 22, 25, 111].map((n) => plural(n, ['день', 'дня', 'дней']))).toEqual([
      'день', 'дня', 'дней', 'дней', 'дней', 'дней', 'день', 'дня', 'дней', 'дней',
    ]);
  });

  it('показывает дату с днём недели', () => {
    expect(formatDateTimeFull(new Date(2026, 9, 27, 17, 9).getTime())).toBe('27 окт. 2026, вт, 17:09');
  });
});
