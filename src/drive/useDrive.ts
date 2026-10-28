import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Backup } from '../backup';
import type { AppData } from '../import/merge';
import * as auth from './auth';
import { backupToDrive, listDriveBackups, restoreFromDrive } from './backup';
import { isAutoBackupDue } from './portable';

const STATE_KEY = 'debts/drive/v1';

type Saved = { lastBackupAt: number | null; lastError: string | null };

export type DriveState = Saved & {
  /** Почему Диск недоступен (не Android, не настроен); null — доступен. */
  unavailable: string | null;
  account: string | null;
  /** Идёт проверка входа при запуске. */
  checking: boolean;
  busy: { label: string; progress: number } | null;
};

const message = (e: unknown) => String((e as Error)?.message ?? e);

/**
 * Резервное копирование в Google Диск: подключение, копия по кнопке, автоматическая копия
 * раз в сутки (при запуске и при возврате в приложение), восстановление.
 */
export function useDrive(data: AppData & { loaded: boolean }, applyBackup: (backup: Backup) => Promise<boolean>) {
  const [state, setState] = useState<DriveState>({
    unavailable: auth.driveUnavailableReason,
    account: null,
    checking: !auth.driveUnavailableReason,
    busy: null,
    lastBackupAt: null,
    lastError: null,
  });

  // Копия берёт данные на момент запуска, а не на момент создания колбэка
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  });
  const busyRef = useRef(false);
  const lastAttemptRef = useRef<number | null>(null);
  const savedRef = useRef<Saved>({ lastBackupAt: null, lastError: null });

  const patch = useCallback((next: Partial<DriveState>) => setState((s) => ({ ...s, ...next })), []);

  /** Время последней копии и ошибка переживают перезапуск приложения. */
  const save = useCallback(
    (next: Partial<Saved>) => {
      savedRef.current = { ...savedRef.current, ...next };
      patch(savedRef.current);
      AsyncStorage.setItem(STATE_KEY, JSON.stringify(savedRef.current)).catch((e) => console.warn(e));
    },
    [patch],
  );

  useEffect(() => {
    if (auth.driveUnavailableReason) return;
    (async () => {
      const saved: Partial<Saved> = JSON.parse((await AsyncStorage.getItem(STATE_KEY)) ?? '{}');
      let account: string | null = null;
      try {
        account = await auth.connectedAccount();
      } catch (e) {
        console.warn('Не удалось проверить вход в Google', e);
      }
      savedRef.current = { lastBackupAt: saved.lastBackupAt ?? null, lastError: saved.lastError ?? null };
      patch({ account, checking: false, ...savedRef.current });
    })();
  }, [patch]);

  /** Одна копия за раз; возвращает успех. Ошибка сохраняется в состоянии и видна в окне Диска. */
  const backupNow = useCallback(async () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    lastAttemptRef.current = Date.now();
    patch({ busy: { label: 'Подготовка…', progress: 0 } });
    try {
      await backupToDrive(dataRef.current, (label, progress) => patch({ busy: { label, progress } }));
      save({ lastBackupAt: Date.now(), lastError: null });
      return true;
    } catch (e) {
      console.warn('Копия в Google Диск не удалась', e);
      save({ lastError: message(e) });
      return false;
    } finally {
      busyRef.current = false;
      patch({ busy: null });
    }
  }, [patch, save]);

  // Автокопия: при запуске и при каждом возврате в приложение, если с прошлой прошло больше суток
  const { loaded } = data;
  const { account, lastBackupAt } = state;
  useEffect(() => {
    if (!loaded || !account) return;
    const check = () => {
      // Пустые данные (например, после сбоя загрузки) не копируем — иначе они вытеснят хорошие копии
      if (!dataRef.current.contacts.length) return;
      if (isAutoBackupDue(Date.now(), lastBackupAt, lastAttemptRef.current)) backupNow();
    };
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [loaded, account, lastBackupAt, backupNow]);

  const connect = useCallback(async () => {
    try {
      const email = await auth.connect();
      if (!email) return;
      save({ lastError: null });
      // Первая копия сразу после подключения сработает через автокопию: lastBackupAt ещё нет или устарел
      patch({ account: email });
    } catch (e) {
      console.warn(e);
      save({ lastError: `Не удалось войти в Google: ${message(e)}` });
    }
  }, [patch, save]);

  const disconnect = useCallback(async () => {
    await auth.disconnect().catch((e) => console.warn(e));
    patch({ account: null });
  }, [patch]);

  /** Заменяет данные приложения копией с Диска. Возвращает, сколько фото не нашлось, или null при ошибке. */
  const restore = useCallback(
    async (fileId: string) => {
      if (busyRef.current) return null;
      busyRef.current = true;
      patch({ busy: { label: 'Загрузка копии…', progress: 0 } });
      try {
        const { backup, missingPhotos } = await restoreFromDrive(fileId, (label, progress) => patch({ busy: { label, progress } }));
        return (await applyBackup(backup)) ? missingPhotos : null;
      } catch (e) {
        console.warn(e);
        save({ lastError: `Не удалось восстановить: ${message(e)}` });
        return null;
      } finally {
        busyRef.current = false;
        patch({ busy: null });
      }
    },
    [applyBackup, patch, save],
  );

  return { ...state, connect, disconnect, backupNow, restore, listBackups: listDriveBackups };
}
