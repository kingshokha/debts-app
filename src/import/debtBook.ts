// Разбор резервной копии «долговой книги» (.txt). Модуль не зависит от интерфейса и React Native.
//
// Формат: строка «~2», затем 4 секции base64 (с переносом каждые 76 символов), разделённые строкой «#####»:
//   0 — заголовок: клиентов;операций;сумма_положительных;сумма_отрицательных;время_бэкапа_мс
//   1 — шаблоны заметок, по одному на строку
//   2 — клиенты: "имя";"баланс";"время";"сумма";"комментарий" (последние три — ненадёжный кэш, не используются)
//   3 — операции: "имя_клиента";"время_мс";"сумма";"комментарий"
// Суммы — целые дирамы. Внутри кавычек: \" — кавычка, \\ — обратный слэш, оставшийся \n — перенос строки.

export const FORMAT_VERSION = '~2';

/** Метки в начале имени, которые становятся группой клиента. */
export const GROUP_PREFIXES = ['ШМ', 'ШЗ', 'ПМ', 'ПЗ', 'БМ', 'БЗ', 'ОВД', 'СВ', 'МВ'];

export type BookHeader = {
  clients: number;
  operations: number;
  positive: number;
  negative: number;
  backupTime: number;
};

export type BookOperation = { date: number; amount: number; comment: string };

export type BookClient = {
  name: string;
  /** Баланс из файла — только для проверки, в приложении он считается из операций. */
  balance: number;
  group: string | null;
  /** Отсортированы по времени; при одинаковом времени — в порядке файла. */
  operations: BookOperation[];
};

export type DebtBook = { header: BookHeader; templates: string[]; clients: BookClient[] };

/** Файл не прочитан или не прошёл проверку; problems — что именно не так. */
export class DebtBookError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'));
    this.name = 'DebtBookError';
  }
}

export type Progress = (fraction: number) => void;

// ——— base64 и UTF-8 (без зависимостей от платформы: в Hermes нет гарантированного TextDecoder) ———

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_INDEX = new Int8Array(128).fill(-1);
for (let i = 0; i < BASE64_ALPHABET.length; i++) BASE64_INDEX[BASE64_ALPHABET.charCodeAt(i)] = i;

export function decodeBase64(input: string): Uint8Array {
  const src = input.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((src.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < src.length; i++) {
    const code = src.charCodeAt(i);
    const value = code < 128 ? BASE64_INDEX[code] : -1;
    if (value < 0) throw new Error(`недопустимый символ base64 «${src[i]}»`);
    buffer = ((buffer << 6) | value) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

export function decodeUtf8(bytes: Uint8Array): string {
  const parts: string[] = [];
  const units: number[] = [];
  const flush = () => {
    parts.push(String.fromCharCode(...units));
    units.length = 0;
  };
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let cp: number;
    let extra: number;
    if (b < 0x80) [cp, extra] = [b, 0];
    else if (b >= 0xc2 && b < 0xe0) [cp, extra] = [b & 0x1f, 1];
    else if (b >= 0xe0 && b < 0xf0) [cp, extra] = [b & 0x0f, 2];
    else if (b >= 0xf0 && b < 0xf5) [cp, extra] = [b & 0x07, 3];
    else throw new Error(`некорректный UTF-8 в байте ${i}`);
    if (i + extra >= bytes.length + (extra ? 0 : 1)) throw new Error('обрезанный символ UTF-8 в конце');
    for (let k = 1; k <= extra; k++) {
      const next = bytes[i + k];
      if ((next & 0xc0) !== 0x80) throw new Error(`некорректный UTF-8 в байте ${i + k}`);
      cp = (cp << 6) | (next & 0x3f);
    }
    i += extra + 1;
    if (cp > 0xffff) {
      cp -= 0x10000;
      units.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      units.push(cp);
    }
    if (units.length >= 8192) flush();
  }
  flush();
  return parts.join('');
}

// ——— Структура файла ———

/** Делит файл на секции и раскодирует каждую в текст. */
export function splitSections(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim());
  const version = lines.find((l) => l.startsWith('~'));
  if (version !== FORMAT_VERSION) {
    throw new DebtBookError([
      version ? `Неизвестная версия формата «${version}», ожидается «${FORMAT_VERSION}».` : 'Это не резервная копия долговой книги: нет строки «~2».',
    ]);
  }
  const sections: string[][] = [[]];
  for (const line of lines) {
    if (line === '#####') sections.push([]);
    else if (line && !line.startsWith('~')) sections[sections.length - 1].push(line);
  }
  if (sections.length !== 4) {
    throw new DebtBookError([`В файле ${sections.length} секций вместо 4 — файл повреждён или обрезан.`]);
  }
  return sections.map((section, i) => {
    try {
      return decodeUtf8(decodeBase64(section.join('')));
    } catch (e) {
      throw new DebtBookError([`Секция ${i}: ${(e as Error).message}.`]);
    }
  });
}

/**
 * Разбирает строку вида `"a";"b \"c\"";""`. Возвращает null, если строка не в этом формате.
 * Экранирование: \" — кавычка, \\ — обратный слэш; оставшийся после этого \n — перенос строки.
 */
export function parseRow(line: string): string[] | null {
  const fields: string[] = [];
  let i = 0;
  for (;;) {
    if (line[i] !== '"') return null;
    i++;
    let field = '';
    let start = i;
    for (;;) {
      if (i >= line.length) return null; // нет закрывающей кавычки
      const ch = line[i];
      if (ch === '\\' && (line[i + 1] === '"' || line[i + 1] === '\\')) {
        field += line.slice(start, i) + line[i + 1];
        i += 2;
        start = i;
      } else if (ch === '"') {
        field += line.slice(start, i);
        i++;
        break;
      } else {
        i++;
      }
    }
    fields.push(field.replace(/\\n/g, '\n'));
    if (i === line.length) return fields;
    if (line[i] !== ';') return null;
    i++;
  }
}

const INTEGER = /^-?\d+$/;

function toInteger(value: string): number | null {
  if (!INTEGER.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

/** Метка группы — первое слово имени, если оно из списка GROUP_PREFIXES. */
export function groupOfName(name: string): string | null {
  const first = name.trim().split(/\s+/)[0];
  return GROUP_PREFIXES.includes(first) ? first : null;
}

const lines = (section: string) => section.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.length > 0);

/** Сколько проблем перечислять поимённо, прежде чем написать «и ещё N». */
const MAX_LISTED = 10;

function pushLimited(problems: string[], items: string[]) {
  problems.push(...items.slice(0, MAX_LISTED));
  if (items.length > MAX_LISTED) problems.push(`…и ещё ${items.length - MAX_LISTED}`);
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Сколько строк разбирать между паузами, чтобы интерфейс успевал перерисовываться. */
const CHUNK = 500;

/**
 * Читает и проверяет файл. Работает порциями и отдаёт управление интерфейсу между ними.
 * Если что-то не так с форматом или контрольными суммами — бросает DebtBookError со списком проблем.
 */
export async function readDebtBook(text: string, onProgress?: Progress): Promise<DebtBook> {
  const sections = splitSections(text);
  await yieldToUi();

  const headerFields = sections[0].trim().split(';').map((f) => toInteger(f.trim()));
  if (headerFields.length !== 5 || headerFields.some((n) => n === null)) {
    throw new DebtBookError([`Заголовок не разобран: «${sections[0].trim()}».`]);
  }
  const [clientsCount, operationsCount, positive, negative, backupTime] = headerFields as number[];
  const header: BookHeader = { clients: clientsCount, operations: operationsCount, positive, negative, backupTime };

  const templates = lines(sections[1]);
  const clientLines = lines(sections[2]);
  const operationLines = lines(sections[3]);
  const total = clientLines.length + operationLines.length;

  const formatProblems: string[] = [];
  const clients = new Map<string, BookClient>();
  const duplicateNames: string[] = [];
  const unknownClients = new Map<string, number>();
  // Порядок в файле нужен, чтобы операции с одинаковым временем не перемешались при сортировке
  const order = new Map<BookOperation, number>();

  for (let i = 0; i < total; i++) {
    if (i % CHUNK === 0 && i > 0) {
      onProgress?.(i / total);
      await yieldToUi();
    }
    if (i < clientLines.length) {
      const row = parseRow(clientLines[i]);
      const balance = row?.length === 5 ? toInteger(row[1]) : null;
      if (!row || row.length !== 5 || balance === null) {
        formatProblems.push(`Клиенты, строка ${i + 1}: не разобрана «${clientLines[i].slice(0, 80)}».`);
        continue;
      }
      const name = row[0];
      if (clients.has(name)) {
        duplicateNames.push(`«${name}»`);
        continue;
      }
      clients.set(name, { name, balance, group: groupOfName(name), operations: [] });
    } else {
      const n = i - clientLines.length;
      const row = parseRow(operationLines[n]);
      const date = row?.length === 4 ? toInteger(row[1]) : null;
      const amount = row?.length === 4 ? toInteger(row[2]) : null;
      if (!row || row.length !== 4 || date === null || amount === null) {
        formatProblems.push(`Операции, строка ${n + 1}: не разобрана «${operationLines[n].slice(0, 80)}».`);
        continue;
      }
      const client = clients.get(row[0]);
      if (!client) {
        unknownClients.set(row[0], (unknownClients.get(row[0]) ?? 0) + 1);
        continue;
      }
      const op: BookOperation = { date, amount, comment: row[3] };
      order.set(op, n);
      client.operations.push(op);
    }
  }

  const problems: string[] = [];
  pushLimited(problems, formatProblems);
  if (duplicateNames.length) {
    problems.push('Имя клиента должно быть уникальным, а повторяется:');
    pushLimited(problems, duplicateNames);
  }
  if (unknownClients.size) {
    problems.push('Есть операции клиентов, которых нет в списке клиентов:');
    pushLimited(problems, [...unknownClients].map(([name, count]) => `«${name}» — операций: ${count}`));
  }
  if (problems.length) throw new DebtBookError(problems);

  for (const client of clients.values()) {
    client.operations.sort((a, b) => a.date - b.date || order.get(a)! - order.get(b)!);
  }
  const book: DebtBook = { header, templates, clients: [...clients.values()] };

  const checkProblems = validateDebtBook(book);
  if (checkProblems.length) throw new DebtBookError(checkProblems);
  onProgress?.(1);
  return book;
}

/** Сверка с контрольными суммами заголовка и балансами клиентов. Пустой список — всё сошлось. */
export function validateDebtBook({ header, clients }: DebtBook): string[] {
  const problems: string[] = [];
  const operationsCount = clients.reduce((n, c) => n + c.operations.length, 0);
  if (clients.length !== header.clients) {
    problems.push(`Клиентов в файле ${clients.length}, а в заголовке указано ${header.clients}.`);
  }
  if (operationsCount !== header.operations) {
    problems.push(`Операций в файле ${operationsCount}, а в заголовке указано ${header.operations}.`);
  }

  const mismatches: string[] = [];
  let positive = 0;
  let negative = 0;
  for (const c of clients) {
    const sum = c.operations.reduce((s, op) => s + op.amount, 0);
    if (sum !== c.balance) mismatches.push(`«${c.name}»: по операциям ${diramsText(sum)}, в файле ${diramsText(c.balance)}`);
    if (c.balance > 0) positive += c.balance;
    else negative += c.balance;
  }
  if (mismatches.length) {
    problems.push('Баланс клиента не совпадает с суммой его операций:');
    pushLimited(problems, mismatches);
  }
  if (positive !== header.positive) {
    problems.push(`Сумма долгов ${diramsText(positive)}, а в заголовке ${diramsText(header.positive)}.`);
  }
  if (negative !== header.negative) {
    problems.push(`Сумма переплат ${diramsText(negative)}, а в заголовке ${diramsText(header.negative)}.`);
  }
  return problems;
}

/** Сумма в сомони для текста ошибки; модуль не тянет за собой форматирование интерфейса. */
function diramsText(dirams: number) {
  const abs = Math.abs(dirams);
  return `${dirams < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

export type BookSummary = {
  backupTime: number;
  clients: number;
  operations: number;
  /** Общий долг и переплаты, дирамы. */
  positive: number;
  negative: number;
  firstDate: number | null;
  lastDate: number | null;
};

export function summarize({ header, clients }: DebtBook): BookSummary {
  let firstDate: number | null = null;
  let lastDate: number | null = null;
  for (const c of clients) {
    const first = c.operations[0]?.date;
    const last = c.operations[c.operations.length - 1]?.date;
    if (first !== undefined && (firstDate === null || first < firstDate)) firstDate = first;
    if (last !== undefined && (lastDate === null || last > lastDate)) lastDate = last;
  }
  return {
    backupTime: header.backupTime,
    clients: clients.length,
    operations: clients.reduce((n, c) => n + c.operations.length, 0),
    positive: header.positive,
    negative: header.negative,
    firstDate,
    lastDate,
  };
}
