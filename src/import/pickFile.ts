import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export type PickedText = { name: string; text: string };

/** Выбор файла и чтение его как текста. null — пользователь отменил выбор. */
export async function pickTextFile(): Promise<PickedText | null> {
  if (Platform.OS === 'android') {
    // DocumentPicker копирует файл в общий cacheDir приложения, а expo-file-system в Expo Go разрешает
    // читать только папки своего проекта — отсюда «Missing 'READ' permission». Системный выбор файлов
    // из expo-file-system отдаёт content://-ссылку от «Загрузок»/WhatsApp, которую читать можно.
    const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
    if (picked.canceled) return null;
    return { name: picked.result.name || 'файл', text: await picked.result.text() };
  }

  // Тип не ограничиваем: WhatsApp и файловые менеджеры часто отдают .txt без правильного MIME-типа
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, base64: false });
  if (result.canceled || !result.assets.length) return null;
  const asset = result.assets[0];
  const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
  return { name: asset.name, text };
}
