import { Alert, Platform } from 'react-native';

// В react-native-web Alert.alert ничего не делает — в браузере используем window.confirm/alert

export function confirmAction(title: string, message: string, okText: string, onOk: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    { text: okText, style: destructive ? 'destructive' : 'default', onPress: onOk },
  ]);
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
