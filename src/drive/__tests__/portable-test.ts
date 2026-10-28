import type { Contact } from '../../types';
import {
  AUTO_BACKUP_INTERVAL,
  AUTO_RETRY_INTERVAL,
  backupFileName,
  fromPortable,
  isAutoBackupDue,
  photoRefsOf,
  toPortable,
} from '../portable';

const DIR = 'file:///data/user/0/com.blend.debts/files/photos/';
const isAppPhoto = (uri: string) => uri.startsWith(DIR);

const contact = (over: Partial<Contact>): Contact => ({ id: 'c', name: 'А', createdAt: 0, operations: [], ...over });

describe('фото в копии Google Диска', () => {
  const contacts = [
    contact({ id: '1', photo: `${DIR}a.jpg`, passport: [`${DIR}p1.jpg`, `${DIR}p2.jpg`] }),
    contact({ id: '2', photo: 'data:image/png;base64,AAA', passport: [`${DIR}a.jpg`] }), // фото из веба и общий файл
    contact({ id: '3', photo: null }),
  ];

  it('заменяет локальные пути ссылками по имени и собирает список файлов', () => {
    const { contacts: portable, photoNames } = toPortable(contacts, isAppPhoto);
    expect(photoNames.sort()).toEqual(['a.jpg', 'p1.jpg', 'p2.jpg']);
    expect(portable[0]).toMatchObject({ photo: 'drive-photo:a.jpg', passport: ['drive-photo:p1.jpg', 'drive-photo:p2.jpg'] });
    // data:-uri и чужие ссылки в копию не попадают
    expect(portable[1]).toMatchObject({ photo: null, passport: ['drive-photo:a.jpg'] });
    expect(photoRefsOf(portable).sort()).toEqual(['a.jpg', 'p1.jpg', 'p2.jpg']);
  });

  it('при восстановлении подставляет скачанные файлы и убирает ненайденные', () => {
    const { contacts: portable } = toPortable(contacts, isAppPhoto);
    const local = 'file:///new/photos/';
    const restored = fromPortable(portable, (name) => (name === 'p2.jpg' ? null : local + name));
    expect(restored[0]).toMatchObject({ photo: `${local}a.jpg`, passport: [`${local}p1.jpg`] });
    expect(restored[1]).toMatchObject({ photo: null, passport: [`${local}a.jpg`] });
    expect(restored[2].photo).toBeNull();
  });
});

describe('расписание автокопии', () => {
  const now = 1_800_000_000_000;

  it('копирует, если копии ещё не было или прошли сутки', () => {
    expect(isAutoBackupDue(now, null, null)).toBe(true);
    expect(isAutoBackupDue(now, now - AUTO_BACKUP_INTERVAL, null)).toBe(true);
    expect(isAutoBackupDue(now, now - AUTO_BACKUP_INTERVAL + 1, null)).toBe(false);
  });

  it('после неудачи ждёт час, прежде чем пробовать снова', () => {
    expect(isAutoBackupDue(now, null, now - 5 * 60 * 1000)).toBe(false);
    expect(isAutoBackupDue(now, null, now - AUTO_RETRY_INTERVAL)).toBe(true);
  });
});

it('называет файл копии по местной дате и времени', () => {
  expect(backupFileName(new Date(2026, 9, 28, 5, 7))).toBe('Долги 2026-10-28 05-07.json');
});
