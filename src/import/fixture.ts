// Генератор файла «долговой книги» для тестов: та же структура, что у настоящего бэкапа.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '=';
  }
  return out;
}

/** base64 с переносом каждые 76 символов, как в настоящем файле. */
const section = (text: string) => encodeBase64(new TextEncoder().encode(text)).match(/.{1,76}/g)?.join('\n') ?? '';

/** Поле в кавычках с экранированием файла: \ → \\, " → \", перенос строки → \\n. */
const quote = (value: string | number) =>
  `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\\\n')}"`;

export const row = (...fields: (string | number)[]) => fields.map(quote).join(';');

export type FixtureClient = { name: string; balance: number };
export type FixtureOperation = { name: string; date: number; amount: number; comment?: string };

/** Собирает текст файла. header по умолчанию считается из данных — передайте свой, чтобы проверить ошибки. */
export function buildDebtBook({
  clients,
  operations,
  templates = [],
  backupTime = Date.UTC(2026, 9, 23, 16, 0),
  header,
}: {
  clients: FixtureClient[];
  operations: FixtureOperation[];
  templates?: string[];
  backupTime?: number;
  header?: string;
}): string {
  const positive = clients.reduce((s, c) => s + Math.max(c.balance, 0), 0);
  const negative = clients.reduce((s, c) => s + Math.min(c.balance, 0), 0);
  const head = header ?? [clients.length, operations.length, positive, negative, backupTime].join(';');
  // Кэш «последней операции» в файле ненадёжен — пишем мусор, импорт должен его игнорировать
  const clientRows = clients.map((c) => row(c.name, c.balance, 1, 999, 'кэш'));
  const opRows = operations.map((op) => row(op.name, op.date, op.amount, op.comment ?? ''));
  return [
    '~2',
    section(head),
    '',
    '#####',
    section(templates.join('\n')),
    '',
    '#####',
    section(clientRows.join('\n')),
    '',
    '#####',
    section(opRows.join('\n')),
    '',
  ].join('\n');
}
