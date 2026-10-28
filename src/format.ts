const MONTHS = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];

// Все суммы в приложении — целые дирамы (100 дирам = 1 сомони); в сомони они только показываются

/** Дирамы -> сомони: 82519700 -> "+825 197,00", -11600 -> "-116,00", 0 -> "0,00" */
export function formatAmount(dirams: number, withPlus = true): string {
  const abs = Math.abs(Math.round(dirams));
  const int = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const body = `${int},${String(abs % 100).padStart(2, '0')}`;
  if (dirams < 0) return '-' + body;
  if (dirams > 0 && withPlus) return '+' + body;
  return body;
}

/** Как formatAmount, но целые сомони без «,00»: «+820 032», «-116», «+12,50». */
export const formatAmountShort = (dirams: number, withPlus = true) => formatAmount(dirams, withPlus).replace(/,00$/, '');

/** Введённая сумма в сомони (можно выражением: "100+50,5") -> дирамы; null, если не разобрать. */
export function parseAmount(input: string): number | null {
  const somoni = evalExpression(input);
  return somoni === null ? null : Math.round(somoni * 100);
}

/** Дирамы -> текст для поля ввода без лишних нулей: 150050 -> "1500,5", 150000 -> "1500". */
export function amountToInput(dirams: number): string {
  return (Math.abs(dirams) / 100).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
}

/** "27 окт. 2026" */
export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Выбранный день + текущее время, чтобы операции за один день шли в порядке ввода. */
export function withCurrentTime(day: Date): number {
  const now = new Date();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()).getTime();
}

/** День из `day`, время суток из `timeFrom` — при редактировании даты операция не меняет место внутри дня. */
export function withTimeOf(day: Date, timeFrom: number): number {
  const t = new Date(timeFrom);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.getHours(), t.getMinutes(), t.getSeconds()).getTime();
}

/** Вычисляет простое выражение: "1000-100", "3*250+50", "(1200+300)/2". Возвращает null, если не разобрать. */
export function evalExpression(input: string): number | null {
  const src = input.replace(/\s+/g, '').replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/');
  if (!src) return null;
  let pos = 0;
  const peek = () => src[pos];

  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = src[pos++];
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = src[pos++];
      const r = parseFactor();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function parseFactor(): number {
    if (peek() === '-') {
      pos++;
      return -parseFactor();
    }
    if (peek() === '(') {
      pos++;
      const v = parseExpr();
      if (src[pos++] !== ')') throw new Error(')');
      return v;
    }
    const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(pos));
    if (!m) throw new Error('number');
    pos += m[0].length;
    return parseFloat(m[0]);
  }

  try {
    const v = parseExpr();
    if (pos !== src.length || !Number.isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  } catch {
    return null;
  }
}

/** «1 час», «2 часа», «5 часов» */
export function plural(n: number, [one, few, many]: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** «только что», «5 минут назад», «19 часов назад», «3 дня назад»; старше недели — «20 окт. 2026 г.» */
export function formatAgo(ts: number, now = Date.now()) {
  const diff = Math.max(0, now - ts);
  if (diff < MINUTE) return 'только что';
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} ${plural(m, ['минуту', 'минуты', 'минут'])} назад`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} ${plural(h, ['час', 'часа', 'часов'])} назад`;
  }
  if (diff < 8 * DAY) {
    const d = Math.floor(diff / DAY);
    return `${d} ${plural(d, ['день', 'дня', 'дней'])} назад`;
  }
  return `${formatDate(ts)} г.`;
}

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** «27 окт. 2026, вт, 17:09» */
export function formatDateTimeFull(ts: number) {
  return `${formatDate(ts)}, ${WEEKDAYS[new Date(ts).getDay()]}, ${formatTime(ts)}`;
}
