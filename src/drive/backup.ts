import { type Backup, normalizeBackup, serializeBackup } from '../backup';
import type { AppData } from '../import/merge';
import { isAppPhoto, photoFile } from '../photos';
import {
  deleteFile,
  type DriveFile,
  downloadFile,
  downloadText,
  findFolder,
  findOrCreateFolder,
  listFiles,
  quote,
  uploadFile,
  uploadText,
} from './api';
import { backupFileName, fromPortable, photoRefsOf, toPortable } from './portable';

// Структура на Диске:  Долги/  — копии данных «Долги 2026-10-28 05-10.json» (последние KEEP_BACKUPS)
//                      Долги/Фото/ — фото контактов и паспортов, по одному файлу, догружаются только новые

const ROOT_FOLDER = 'Долги';
const PHOTOS_FOLDER = 'Фото';
export const KEEP_BACKUPS = 10;

export type Progress = (label: string, fraction: number) => void;

const backupsIn = (rootId: string) =>
  listFiles(`${quote(rootId)} in parents and mimeType = 'application/json' and trashed = false`, 'createdTime desc');

const photosIn = (photosId: string) => listFiles(`${quote(photosId)} in parents and trashed = false`);

export async function backupToDrive(data: AppData, onProgress?: Progress) {
  onProgress?.('Подключение к Google Диску…', 0);
  const rootId = await findOrCreateFolder(ROOT_FOLDER);
  const photosId = await findOrCreateFolder(PHOTOS_FOLDER, rootId);

  const { contacts, photoNames } = toPortable(data.contacts, isAppPhoto);
  const remote = await photosIn(photosId);
  const remoteNames = new Set(remote.map((f) => f.name));
  const toUpload = photoNames.filter((name) => !remoteNames.has(name) && photoFile(name).exists);
  for (let i = 0; i < toUpload.length; i++) {
    onProgress?.(`Фото ${i + 1} из ${toUpload.length}…`, (i / toUpload.length) * 0.8);
    await uploadFile(photoFile(toUpload[i]), toUpload[i], photosId, 'image/jpeg');
  }

  // Фото удалённых контактов и убранные страницы паспортов на Диске больше не храним
  const used = new Set(photoNames);
  for (const f of remote) if (!used.has(f.name)) await deleteFile(f.id);

  onProgress?.('Сохранение данных…', 0.85);
  const name = backupFileName(new Date());
  await uploadText(name, rootId, serializeBackup(contacts, data.groups, data.templates));

  const backups = await backupsIn(rootId);
  for (const old of backups.slice(KEEP_BACKUPS)) await deleteFile(old.id);
  onProgress?.('Готово', 1);
  return { name, photosUploaded: toUpload.length };
}

/** Копии на Диске, новые сверху. */
export async function listDriveBackups(): Promise<DriveFile[]> {
  const rootId = await findFolder(ROOT_FOLDER);
  return rootId ? backupsIn(rootId) : [];
}

/** Скачивает копию и её фото. Данные приложения не меняет — их заменяет вызывающий. */
export async function restoreFromDrive(fileId: string, onProgress?: Progress): Promise<{ backup: Backup; missingPhotos: number }> {
  onProgress?.('Загрузка копии…', 0);
  const backup = normalizeBackup(JSON.parse(await downloadText(fileId)));
  if (!backup) throw new Error('Файл копии повреждён.');

  const names = photoRefsOf(backup.contacts);
  const available = new Set<string>();
  if (names.length) {
    const rootId = await findFolder(ROOT_FOLDER);
    const photosId = rootId ? await findFolder(PHOTOS_FOLDER, rootId) : null;
    const remote = new Map((photosId ? await photosIn(photosId) : []).map((f) => [f.name, f.id]));
    for (let i = 0; i < names.length; i++) {
      onProgress?.(`Фото ${i + 1} из ${names.length}…`, 0.1 + (i / names.length) * 0.85);
      const file = photoFile(names[i]);
      const id = remote.get(names[i]);
      if (!file.exists && id) await downloadFile(id, file);
      if (file.exists) available.add(names[i]);
    }
  }

  const contacts = fromPortable(backup.contacts, (name) => (available.has(name) ? photoFile(name).uri : null));
  onProgress?.('Готово', 1);
  return { backup: { ...backup, contacts }, missingPhotos: names.length - available.size };
}
