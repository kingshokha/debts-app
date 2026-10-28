import type { Contact } from '../types';

// Чистые функции копии в Google Диск: без сети, файлов и React Native — их проверяют юнит-тесты.

/** Фото в копии хранится как ссылка на файл в папке «Фото» на Диске, а не как локальный путь телефона. */
const REF_PREFIX = 'drive-photo:';

/** Имя файла из пути: file:///…/photos/abc.jpg → abc.jpg */
export const photoName = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);

/** Имя фото из ссылки копии; null — это не ссылка на фото в Диске. */
export const refName = (value: string) => (value.startsWith(REF_PREFIX) ? value.slice(REF_PREFIX.length) : null);

/**
 * Готовит контакты к копии: локальные пути фото заменяются ссылками по имени файла.
 * Фото, которые не лежат в папке приложения (data:-uri в вебе, чужие ссылки), в копию не попадают.
 */
export function toPortable(contacts: Contact[], isAppPhoto: (uri: string) => boolean) {
  const photoNames = new Set<string>();
  const portable = (uri: string | null | undefined) => {
    if (!uri || !isAppPhoto(uri)) return null;
    const name = photoName(uri);
    photoNames.add(name);
    return REF_PREFIX + name;
  };
  const result = contacts.map((c) => ({
    ...c,
    photo: portable(c.photo),
    passport: (c.passport ?? []).map(portable).filter((ref): ref is string => ref !== null),
  }));
  return { contacts: result, photoNames: [...photoNames] };
}

/** Имена всех фото, на которые ссылается копия. */
export function photoRefsOf(contacts: Contact[]) {
  const names = new Set<string>();
  for (const c of contacts) {
    for (const value of [c.photo, ...(c.passport ?? [])]) {
      const name = value ? refName(value) : null;
      if (name) names.add(name);
    }
  }
  return [...names];
}

/** Обратно к локальным путям. resolve отдаёт путь к скачанному фото или null, если его нет — тогда фото убирается. */
export function fromPortable(contacts: Contact[], resolve: (name: string) => string | null): Contact[] {
  const local = (value: string | null | undefined) => {
    if (!value) return null;
    const name = refName(value);
    return name === null ? null : resolve(name);
  };
  return contacts.map((c) => ({
    ...c,
    photo: local(c.photo),
    passport: (c.passport ?? []).map(local).filter((uri): uri is string => uri !== null),
  }));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** «Долги 2026-10-28 05-10.json» — по местному времени, сортируется по имени. */
export function backupFileName(date: Date) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `Долги ${day} ${pad(date.getHours())}-${pad(date.getMinutes())}.json`;
}

/** Сутки между автоматическими копиями. */
export const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000;

/** После неудачной автокопии следующую пробуем не раньше чем через час. */
export const AUTO_RETRY_INTERVAL = 60 * 60 * 1000;

/** Пора ли делать автоматическую копию. */
export function isAutoBackupDue(now: number, lastBackupAt: number | null, lastAttemptAt: number | null) {
  if (lastAttemptAt !== null && now - lastAttemptAt < AUTO_RETRY_INTERVAL) return false;
  return lastBackupAt === null || now - lastBackupAt >= AUTO_BACKUP_INTERVAL;
}
