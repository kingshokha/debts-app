import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { notify } from './confirm';
import { formatDate, formatTime } from './format';

// Обновления по воздуху (EAS Update): какая версия запущена, ручная проверка
// и сообщение при первом запуске после нового обновления.

const SEEN_KEY = 'debts/update-seen/v1';

/** В Expo Go и при разработке обновлений нет — они работают только в установленном APK. */
export const updatesEnabled = Updates.isEnabled;

const when = (date: Date) => `${formatDate(date.getTime())}, ${formatTime(date.getTime())}`;

/** «28 окт. 2026, 14:05 · обновление по воздуху» */
export function currentVersionLabel() {
  if (!updatesEnabled) return 'режим разработки (Expo Go)';
  const date = Updates.createdAt ? when(Updates.createdAt) : '—';
  return `${date} · ${Updates.isEmbeddedLaunch ? 'встроенная в APK' : 'обновление по воздуху'}`;
}

/**
 * Проверяет сервер обновлений. Если есть новое — скачивает и сразу перезапускает приложение
 * (промис тогда не завершается). 'none' — новее нет.
 */
export async function checkAndApplyUpdate(): Promise<'none'> {
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return 'none';
  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();
  return 'none';
}

/** Один раз сообщает, что запущено новое обновление по воздуху. */
export function useUpdateNotice() {
  useEffect(() => {
    const id = Updates.updateId;
    if (!updatesEnabled || Updates.isEmbeddedLaunch || !id) return;
    AsyncStorage.getItem(SEEN_KEY)
      .then(async (seen) => {
        if (seen === id) return;
        await AsyncStorage.setItem(SEEN_KEY, id);
        notify('Приложение обновлено', `Версия от ${Updates.createdAt ? when(Updates.createdAt) : '—'}.`);
      })
      .catch((e) => console.warn(e));
  }, []);
}
