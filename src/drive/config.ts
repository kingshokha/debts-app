/**
 * Client ID OAuth-клиента типа «Web application» из Google Cloud Console
 * (APIs & Services → Credentials). Это не секрет: он только называет проект Google.
 * Кроме него в том же проекте должен быть клиент типа «Android» с пакетом com.blend.debts
 * и SHA-1 ключа подписи из EAS — иначе Google откажет во входе.
 */
export const GOOGLE_WEB_CLIENT_ID = '';
