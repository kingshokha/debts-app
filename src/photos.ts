import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type PhotoSource = 'camera' | 'library';

const isWeb = Platform.OS === 'web';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.6,
  base64: isWeb, // в браузере нет файловой системы — храним картинку прямо в данных
};

/**
 * Открывает камеру или галерею и сохраняет фото в папку приложения.
 * Возвращает uri сохранённого фото; null — пользователь отменил; 'denied' — нет доступа к камере.
 */
export async function pickPhoto(source: PhotoSource): Promise<string | null | 'denied'> {
  if (source === 'camera' && !isWeb) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return 'denied';
  }
  const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const result = await launch(PICKER_OPTIONS);
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  if (isWeb) return asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;

  // Пикер кладёт файл во временную папку, которую система может очистить — копируем в документы
  const dir = new Directory(Paths.document, 'photos');
  dir.create({ idempotent: true, intermediates: true });
  const target = new File(dir, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`);
  await new File(asset.uri).copy(target);
  return target.uri;
}

/** Удаляет файл фото, если он лежит на устройстве. Ошибки не критичны — только лог. */
export function deletePhoto(uri: string | null | undefined) {
  if (!uri || isWeb || !uri.startsWith('file:')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (e) {
    console.warn('Не удалось удалить фото', e);
  }
}
