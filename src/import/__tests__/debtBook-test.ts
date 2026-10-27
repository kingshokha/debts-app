import { DebtBookError, decodeBase64, decodeUtf8, groupOfName, parseRow, readDebtBook } from '../debtBook';
import { buildDebtBook, type FixtureClient, type FixtureOperation } from '../fixture';

const T = (day: number) => Date.UTC(2020, 0, day, 10, 0); // время операции, мс UTC

const CLIENTS: FixtureClient[] = [
  { name: 'ШМ Иванов Алишер 92-000-00-00 Мехробод', balance: 1_200_000 },
  { name: 'ПЗ Каримова Нигина', balance: 0 }, // без операций
  { name: 'ОВД Переплата Сафаров', balance: -1_600 },
  { name: 'Сидоров без метки', balance: 50_00 },
];

// Операции нарочно не по порядку, в том числе внутри одного клиента
const OPERATIONS: FixtureOperation[] = [
  { name: CLIENTS[0].name, date: T(3), amount: 500_000, comment: 'Тв 43" Артел андроид' },
  { name: CLIENTS[2].name, date: T(2), amount: -2_600, comment: 'Предоплата\nвторая строка' },
  { name: CLIENTS[0].name, date: T(1), amount: 1_000_000, comment: 'Пылесос 780-200=580' },
  { name: CLIENTS[3].name, date: T(5), amount: 50_00 },
  { name: CLIENTS[2].name, date: T(1), amount: 1_000 },
  { name: CLIENTS[0].name, date: T(2), amount: -300_000 },
];

const TEMPLATES = ['A16_4/128_2280-200=2080', 'Пылесос'];

const fixture = (overrides: Partial<Parameters<typeof buildDebtBook>[0]> = {}) =>
  buildDebtBook({ clients: CLIENTS, operations: OPERATIONS, templates: TEMPLATES, ...overrides });

const problemsOf = async (text: string) => {
  try {
    await readDebtBook(text);
  } catch (e) {
    if (e instanceof DebtBookError) return e.problems;
    throw e;
  }
  throw new Error('ожидалась ошибка проверки');
};

describe('base64 и UTF-8', () => {
  it('раскодирует кириллицу и таджикские буквы', () => {
    // «Тоҷикистон» — base64 от UTF-8
    expect(decodeUtf8(decodeBase64('0KLQvtK30LjQutC40YHRgtC+0L0='))).toBe('Тоҷикистон');
  });

  it('раскодирует заголовок из настоящего файла', () => {
    expect(decodeUtf8(decodeBase64('ODsyNjs0ODU3MDA7LTg2MDA7MTc5Mjc3MTIwNDI3Mg=='))).toBe('8;26;485700;-8600;1792771204272');
  });
});

describe('parseRow', () => {
  it('понимает \\" и \\\\', () => {
    expect(parseRow('"Тв 43\\" Артел";"C:\\\\path";""')).toEqual(['Тв 43" Артел', 'C:\\path', '']);
  });

  it('превращает \\\\n в перенос строки', () => {
    expect(parseRow('"2698-100=500$\\\\n500(20.01.15)"')).toEqual(['2698-100=500$\n500(20.01.15)']);
  });

  it('не склеивает поля, когда внутри экранированная кавычка', () => {
    expect(parseRow('"a\\";b";"c"')).toEqual(['a";b', 'c']);
  });

  it('отклоняет строку без закрывающей кавычки', () => {
    expect(parseRow('"abc;"d"')).toBeNull();
    expect(parseRow('abc')).toBeNull();
  });
});

describe('groupOfName', () => {
  it('берёт метку из начала имени', () => {
    expect(groupOfName('ШМ Тестов Рустам')).toBe('ШМ');
    expect(groupOfName('ОВД Образцов Фарход')).toBe('ОВД');
    expect(groupOfName('ШМТестов')).toBeNull();
    expect(groupOfName('Тестов ШМ')).toBeNull();
  });
});

describe('readDebtBook', () => {
  it('читает клиентов, операции и шаблоны', async () => {
    const book = await readDebtBook(fixture());
    expect(book.header).toMatchObject({ clients: 4, operations: 6, positive: 1_205_000, negative: -1_600 });
    expect(book.templates).toEqual(TEMPLATES);
    expect(book.clients.map((c) => c.name)).toEqual(CLIENTS.map((c) => c.name));
    expect(book.clients.map((c) => c.group)).toEqual(['ШМ', 'ПЗ', 'ОВД', null]);
  });

  it('создаёт клиента без операций', async () => {
    const book = await readDebtBook(fixture());
    expect(book.clients[1]).toMatchObject({ name: 'ПЗ Каримова Нигина', balance: 0, operations: [] });
  });

  it('сортирует операции по времени', async () => {
    const book = await readDebtBook(fixture());
    expect(book.clients[0].operations.map((op) => op.date)).toEqual([T(1), T(2), T(3)]);
    expect(book.clients[2].operations.map((op) => op.amount)).toEqual([1_000, -2_600]);
  });

  it('сохраняет порядок файла для операций с одинаковым временем', async () => {
    const book = await readDebtBook(
      buildDebtBook({
        clients: [{ name: 'А', balance: 3 }],
        operations: [
          { name: 'А', date: T(1), amount: 1, comment: 'первая' },
          { name: 'А', date: T(1), amount: 2, comment: 'вторая' },
        ],
      }),
    );
    expect(book.clients[0].operations.map((op) => op.comment)).toEqual(['первая', 'вторая']);
  });

  it('раскодирует кавычку и перенос строки в комментариях', async () => {
    const book = await readDebtBook(fixture());
    expect(book.clients[0].operations[2].comment).toBe('Тв 43" Артел андроид');
    expect(book.clients[2].operations[1].comment).toBe('Предоплата\nвторая строка');
  });

  it('принимает отрицательный баланс (переплату)', async () => {
    const book = await readDebtBook(fixture());
    const overpaid = book.clients[2];
    expect(overpaid.balance).toBe(-1_600);
    expect(overpaid.operations.reduce((s, op) => s + op.amount, 0)).toBe(-1_600);
  });

  it('не берёт кэш последней операции из таблицы клиентов', async () => {
    const book = await readDebtBook(fixture());
    // В fixture кэш у всех «999 / кэш», а у клиента без операций операций быть не должно
    expect(book.clients[1].operations).toHaveLength(0);
    expect(book.clients.flatMap((c) => c.operations).some((op) => op.comment === 'кэш')).toBe(false);
  });

  it('сообщает о прогрессе', async () => {
    const progress: number[] = [];
    await readDebtBook(fixture(), (p) => progress.push(p));
    expect(progress.at(-1)).toBe(1);
  });
});

describe('проверка перед записью', () => {
  it('ловит расхождение баланса клиента с его операциями', async () => {
    const clients = CLIENTS.map((c, i) => (i === 0 ? { ...c, balance: 1_100_000 } : c));
    const problems = await problemsOf(
      fixture({ clients, header: [4, 6, 1_205_000, -1_600, 0].join(';') }),
    );
    expect(problems.join('\n')).toContain('«ШМ Иванов Алишер 92-000-00-00 Мехробод»: по операциям 12000,00, в файле 11000,00');
  });

  it('ловит неверное число клиентов и операций в заголовке', async () => {
    const problems = await problemsOf(fixture({ header: [5, 7, 1_205_000, -1_600, 0].join(';') }));
    expect(problems).toContain('Клиентов в файле 4, а в заголовке указано 5.');
    expect(problems).toContain('Операций в файле 6, а в заголовке указано 7.');
  });

  it('ловит неверные суммы долгов и переплат в заголовке', async () => {
    const problems = await problemsOf(fixture({ header: [4, 6, 1, -2, 0].join(';') }));
    expect(problems).toContain('Сумма долгов 12050,00, а в заголовке 0,01.');
    expect(problems).toContain('Сумма переплат -16,00, а в заголовке -0,02.');
  });

  it('ловит операцию клиента, которого нет в списке', async () => {
    const operations = [...OPERATIONS, { name: 'Неизвестный', date: T(9), amount: 100 }];
    const problems = await problemsOf(fixture({ operations }));
    expect(problems.join('\n')).toContain('«Неизвестный» — операций: 1');
  });

  it('отклоняет файл другого формата', async () => {
    expect(await problemsOf('просто текст')).toEqual(['Это не резервная копия долговой книги: нет строки «~2».']);
    expect((await problemsOf(fixture().replace('~2', '~3')))[0]).toContain('«~3»');
  });
});
