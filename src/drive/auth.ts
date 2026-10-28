import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { GOOGLE_WEB_CLIENT_ID } from './config';

/** Доступ только к файлам, которые создало само приложение, — не ко всему Диску. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Почему Google Диск недоступен; null — доступен. */
export const driveUnavailableReason =
  Platform.OS !== 'android'
    ? 'Google Диск работает только в приложении для Android.'
    : !GOOGLE_WEB_CLIENT_ID
      ? 'Google Диск ещё не настроен: не указан Client ID в src/drive/config.ts.'
      : null;

let configured = false;

function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, scopes: [DRIVE_SCOPE] });
  configured = true;
}

/** Вход в Google с доступом к Диску. Возвращает email или null, если пользователь отменил. */
export async function connect(): Promise<string | null> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    // На экране согласия доступ к Диску можно снять галочкой — тогда просим его отдельно
    if (!response.data.scopes.includes(DRIVE_SCOPE)) {
      const added = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
      if (!added || !isSuccessResponse(added)) {
        await GoogleSignin.signOut();
        return null;
      }
    }
    return response.data.user.email;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw e;
  }
}

/** Подключённый аккаунт без показа окон; null — Диск не подключён. */
export async function connectedAccount(): Promise<string | null> {
  if (driveUnavailableReason) return null;
  ensureConfigured();
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  const current = GoogleSignin.getCurrentUser();
  if (current) return current.user.email;
  const response = await GoogleSignin.signInSilently();
  return response.type === 'success' ? response.data.user.email : null;
}

/** Токен для Drive API. refresh — выбросить закэшированный (например, после ответа 401). */
export async function accessToken(refresh = false): Promise<string> {
  ensureConfigured();
  if (!GoogleSignin.getCurrentUser()) {
    const response = await GoogleSignin.signInSilently();
    if (response.type !== 'success') throw new Error('Вход в Google устарел — подключите Google Диск заново.');
  }
  let { accessToken: token } = await GoogleSignin.getTokens();
  if (refresh) {
    await GoogleSignin.clearCachedAccessToken(token);
    ({ accessToken: token } = await GoogleSignin.getTokens());
  }
  return token;
}

/** Отключает Диск: отзывает доступ приложения и выходит из аккаунта. Файлы на Диске остаются. */
export async function disconnect() {
  ensureConfigured();
  try {
    await GoogleSignin.revokeAccess();
  } catch (e) {
    console.warn('Не удалось отозвать доступ', e);
  }
  await GoogleSignin.signOut();
}
