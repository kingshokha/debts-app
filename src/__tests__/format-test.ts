import { amountToInput, formatAmount, parseAmount } from '../format';

describe('суммы в дирамах', () => {
  it('показывает сомони с двумя знаками', () => {
    expect(formatAmount(82_519_700)).toBe('+825 197,00');
    expect(formatAmount(-11_600)).toBe('-116,00');
    expect(formatAmount(150_050, false)).toBe('1 500,50');
    expect(formatAmount(5)).toBe('+0,05');
    expect(formatAmount(0)).toBe('0,00');
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
