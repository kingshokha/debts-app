import { File, UploadType } from 'expo-file-system';
import { accessToken } from './auth';

// Минимальный клиент Google Drive API v3 поверх fetch. URLSearchParams в React Native урезан,
// поэтому строку запроса собираем сами.

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type DriveFile = {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  appProperties?: Record<string, string>;
};

const query = (params: Record<string, string | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');

/** Строка в кавычках для языка запросов Drive (q=…). */
export const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

async function errorText(res: Response) {
  try {
    const json = await res.json();
    return json?.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

/** Запрос с токеном. На 401 токен обновляется и запрос повторяется один раз. */
async function request(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const token = await accessToken(attempt > 0);
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 && attempt === 0) continue;
    if (!res.ok) throw new Error(`Google Диск ответил ${res.status}: ${await errorText(res)}`);
    return res;
  }
}

const json = { 'Content-Type': 'application/json; charset=UTF-8' };

export async function listFiles(q: string, orderBy?: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = query({
      q,
      orderBy,
      pageToken,
      pageSize: '1000',
      spaces: 'drive',
      fields: 'nextPageToken,files(id,name,createdTime,size,appProperties)',
    });
    const page = await (await request(`${API}/files?${params}`)).json();
    files.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return files;
}

/** Папка по имени (среди созданных приложением); null — такой нет. */
export async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const parent = parentId ? ` and ${quote(parentId)} in parents` : '';
  const found = await listFiles(`name = ${quote(name)} and mimeType = '${FOLDER_MIME}' and trashed = false${parent}`);
  return found[0]?.id ?? null;
}

export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  const res = await request(`${API}/files?fields=id`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
  });
  return (await res.json()).id;
}

/**
 * Создаёт текстовый файл одним multipart-запросом.
 * appProperties — короткие пометки к файлу, которые возвращает список файлов (без скачивания содержимого).
 */
export async function uploadText(
  name: string,
  parentId: string,
  text: string,
  appProperties?: Record<string, string>,
  mimeType = 'application/json',
) {
  const boundary = `debts-${Date.now().toString(36)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify({ name, mimeType, parents: [parentId], appProperties })}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`;
  await request(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

/** Загружает файл с телефона: сначала создаётся запись, потом содержимое идёт потоком, без чтения в память. */
export async function uploadFile(file: File, name: string, parentId: string, mimeType: string) {
  const created = await request(`${API}/files?fields=id`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ name, mimeType, parents: [parentId] }),
  });
  const { id } = await created.json();
  for (let attempt = 0; ; attempt++) {
    const token = await accessToken(attempt > 0);
    const result = await file
      .createUploadTask(`${UPLOAD}/files/${id}?uploadType=media`, {
        httpMethod: 'PATCH',
        uploadType: UploadType.BINARY_CONTENT,
        mimeType,
        headers: { Authorization: `Bearer ${token}` },
      })
      .uploadAsync();
    if (result.status === 401 && attempt === 0) continue;
    if (result.status >= 300) {
      await deleteFile(id).catch(() => {}); // пустая запись без содержимого не нужна
      throw new Error(`Google Диск не принял фото ${name}: ${result.status}`);
    }
    return id as string;
  }
}

export async function downloadText(id: string) {
  return (await request(`${API}/files/${id}?alt=media`)).text();
}

/** Скачивает файл с Диска прямо в destination. */
export async function downloadFile(id: string, destination: File) {
  for (let attempt = 0; ; attempt++) {
    const token = await accessToken(attempt > 0);
    try {
      await File.downloadFileAsync(`${API}/files/${id}?alt=media`, destination, {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true,
      });
      return;
    } catch (e) {
      // Токен мог устареть — одна повторная попытка со свежим
      if (attempt > 0) throw e;
    }
  }
}

export async function deleteFile(id: string) {
  await request(`${API}/files/${id}`, { method: 'DELETE' });
}
