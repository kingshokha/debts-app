import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

// Вход в приложение по 4-значному коду и, по желанию, отпечатку пальца.
// Код хранится в SecureStore — на Android он зашифрован ключом из Android Keystore.

const PIN_KEY = 'debts.pin';

export const PIN_LENGTH = 4;

/** В браузере нет ни SecureStore, ни отпечатка. */
export const lockSupported = Platform.OS !== 'web';

/** Если приложение свернули дольше, при возврате снова спросим код. */
const LOCK_AFTER_MS = 60 * 1000;

export const savePin = (pin: string) => SecureStore.setItemAsync(PIN_KEY, pin);
export const clearPin = () => SecureStore.deleteItemAsync(PIN_KEY);

export async function checkPin(pin: string) {
  return (await SecureStore.getItemAsync(PIN_KEY)) === pin;
}

/** Есть сканер и на телефоне сохранён хотя бы один отпечаток. */
export async function biometricReady() {
  if (!lockSupported) return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

/** Системное окно отпечатка. true — подтверждено. */
export async function authenticateBiometric() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Вход в «Долги»',
    cancelLabel: 'Ввести код',
    disableDeviceFallback: true,
  });
  return result.success;
}

/**
 * Заблокировано ли приложение: при запуске (если вход по коду включён) и после возврата,
 * когда приложение было свёрнуто дольше LOCK_AFTER_MS. Настройки к этому моменту уже прочитаны
 * (SettingsProvider не показывает приложение раньше), поэтому начальное значение верное сразу.
 */
export function useAppLock(lockEnabled: boolean) {
  const [locked, setLocked] = useState(lockEnabled);
  const hiddenAt = useRef<number | null>(null);
  const enabledRef = useRef(lockEnabled);

  useEffect(() => {
    enabledRef.current = lockEnabled;
  }, [lockEnabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') hiddenAt.current = Date.now();
      if (state === 'active' && hiddenAt.current !== null) {
        const away = Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        if (enabledRef.current && away >= LOCK_AFTER_MS) setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  return { locked, unlock: () => setLocked(false) };
}
