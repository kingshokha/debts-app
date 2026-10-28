import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PIN_LENGTH } from '../lock';
import { colors } from '../theme';
import { Text } from '../ui/Text';

type Props = {
  title: string;
  /** Красная подсказка под точками (неверный код, коды не совпали). */
  error?: string | null;
  /** Вызывается, когда введены все цифры; поле очищается для следующей попытки. */
  onComplete: (pin: string) => void;
  /** Кнопка отпечатка слева от нуля; не передана — кнопки нет. */
  onBiometric?: () => void;
  /** Кнопка «Отмена» в углу; не передана — экран нельзя закрыть (экран входа). */
  onCancel?: () => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

/** Полноэкранный ввод 4-значного кода: экран входа и установка кода в настройках. */
export function PinScreen({ title, error, onComplete, onBiometric, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');

  const press = (key: string) => {
    if (key === 'del') return setPin((p) => p.slice(0, -1));
    if (key === 'bio') return onBiometric?.();
    const next = pin + key;
    if (next.length < PIN_LENGTH) return setPin(next);
    setPin('');
    onComplete(next);
  };

  return (
    <Modal visible animationType="fade" onRequestClose={() => onCancel?.()}>
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.top}>
          {onCancel ? (
            <Pressable onPress={onCancel} hitSlop={10} style={styles.cancel}>
              <Text style={styles.cancelText}>Отмена</Text>
            </Pressable>
          ) : null}
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.title}>{title}</Text>
          <View style={styles.dots}>
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled, error && !pin && styles.dotError]} />
            ))}
          </View>
          <Text style={styles.error}>{error ?? ' '}</Text>
        </View>

        <View style={styles.keys}>
          {KEYS.map((key) => {
            if (key === 'bio' && !onBiometric) return <View key={key} style={styles.key} />;
            return (
              <Pressable
                key={key}
                style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                onPress={() => press(key)}
                accessibilityLabel={key === 'del' ? 'Стереть' : key === 'bio' ? 'Отпечаток пальца' : key}
              >
                {key === 'del' ? (
                  <MaterialCommunityIcons name="backspace-outline" size={28} color={colors.text} />
                ) : key === 'bio' ? (
                  <MaterialCommunityIcons name="fingerprint" size={32} color={colors.accent} />
                ) : (
                  <Text style={styles.keyText}>{key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const KEY_SIZE = 76;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between', alignItems: 'center' },
  top: { alignItems: 'center', alignSelf: 'stretch' },
  cancel: { position: 'absolute', right: 20, top: 0 },
  cancelText: { color: colors.teal, fontSize: 17, fontWeight: '600' },
  logo: { width: 72, height: 72, borderRadius: 18, marginTop: 24 },
  title: { color: colors.text, fontSize: 20, marginTop: 24 },
  dots: { flexDirection: 'row', gap: 18, marginTop: 24 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.muted },
  dotFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotError: { borderColor: colors.red },
  error: { color: colors.red, fontSize: 15, marginTop: 16 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', width: KEY_SIZE * 3 + 24 * 2, gap: 24, rowGap: 18 },
  key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { backgroundColor: colors.card },
  keyText: { color: colors.text, fontSize: 32 },
});
