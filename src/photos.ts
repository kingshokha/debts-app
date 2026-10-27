import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type PhotoSource = 'camera' | 'library';

const isWeb = Platform.OS === 'web';

/** Сколько фото можно выбрать из галереи за раз. */
const SELECTION_LIMIT = 10;

const photosDir = () => new Directory(Paths.document, 'photos');

type PickOptions = {
  /** Квадратная обрезка — для фото контакта. */
  crop?: boolean;
  /** Выбор нескольких фото из галереи (с камеры — всегда одно). */
  multiple?: boolean;
};

/**
 * Открывает камеру или галерею. Возвращает uri выбранных снимков — это временные файлы,
 * перед сохранением их нужно передать в persistPhotos. Пустой массив — пользователь отменил;
 * 'denied' — нет доступа к камере.
 */
export async function pickImages(source: PhotoSource, { crop = false, multiple = false }: PickOptions = {}) {
  if (source === 'camera' && !isWeb) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return 'denied' as const;
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    quality: 0.6,
    base64: isWeb, // в браузере нет файловой системы — храним картинку прямо в данных
    // Обрезка и множественный выбор вместе не работают
    ...(crop ? { allowsEditing: true, aspect: [1, 1] } : {}),
    ...(multiple && !crop ? { allowsMultipleSelection: true, selectionLimit: SELECTION_LIMIT } : {}),
  };
  const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const result = await launch(options);
  if (result.canceled || !result.assets) return [];
  return result.assets.map((a) => (isWeb && a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : a.uri));
}

const isSaved = (uri: string) => uri.startsWith(photosDir().uri);

/**
 * Копирует снимки из временной папки (её может очистить система) в папку приложения.
 * Уже сохранённые и data:-uri возвращает как есть.
 */
export async function persistPhotos(uris: string[]): Promise<string[]> {
  if (isWeb) return uris;
  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  return Promise.all(
    uris.map(async (uri) => {
      if (!uri.startsWith('file:') || isSaved(uri)) return uri;
      const target = new File(dir, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`);
      await new File(uri).copy(target);
      return target.uri;
    }),
  );
}

/** Удаляет файлы фото из папки приложения. Ошибки не критичны — только лог. */
export function deletePhotos(uris: (string | null | undefined)[]) {
  if (isWeb) return;
  for (const uri of uris) {
    if (!uri || !isSaved(uri)) continue;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch (e) {
      console.warn('Не удалось удалить фото', e);
    }
  }
}
