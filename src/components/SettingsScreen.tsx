import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { confirmAction, notify } from '../confirm';
import { authenticateBiometric, biometricReady, clearPin, lockSupported, savePin } from '../lock';
import { FONT_SIZES, FontScaleContext, useSettings } from '../settings';
import { colors } from '../theme';
import { checkAndApplyUpdate, currentVersionLabel, updatesEnabled } from '../updates';
import { Text } from '../ui/Text';
import { PinScreen } from './PinScreen';
import { Screen } from './Screen';

type Props = { onClose: () => void };

/** Установка кода: ввести и повторить. step — какой ввод сейчас; first — первый ввод. */
type PinSetup = { step: 'enter' } | { step: 'repeat'; first: string };

export function SettingsScreen({ onClose }: Props) {
  const { settings, update } = useSettings();
  const [pinSetup, setPinSetup] = useState<PinSetup | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const checkUpdates = async () => {
    setChecking(true);
    try {
      // Если обновление есть, приложение скачает его и перезапустится — до сообщения дело не дойдёт
      await checkAndApplyUpdate();
      notify('Обновлений нет', 'У вас последняя версия.');
    } catch (e) {
      notify('Не удалось проверить обновления', String((e as Error)?.message ?? e));
    } finally {
      setChecking(false);
    }
  };

  const startPinSetup = () => {
    setPinError(null);
    setPinSetup({ step: 'enter' });
  };

  const onPin = async (pin: string) => {
    if (!pinSetup) return;
    if (pinSetup.step === 'enter') {
      setPinError(null);
      return setPinSetup({ step: 'repeat', first: pin });
    }
    if (pin !== pinSetup.first) {
      setPinError('Коды не совпали — придумайте код заново');
      return setPinSetup({ step: 'enter' });
    }
    try {
      await savePin(pin);
      update({ lockEnabled: true });
      setPinSetup(null);
    } catch (e) {
      setPinSetup(null);
      notify('Не удалось сохранить код', String((e as Error)?.message ?? e));
    }
  };

  const toggleLock = (on: boolean) => {
    if (on) return startPinSetup();
    confirmAction('Отключить вход по коду?', 'Приложение будет открываться без кода и отпечатка.', 'Отключить', async () => {
      update({ lockEnabled: false, biometric: false });
      await clearPin().catch((e) => console.warn(e));
    });
  };

  const toggleBiometric = async (on: boolean) => {
    if (!on) return update({ biometric: false });
    if (!(await biometricReady())) {
      return notify('Отпечаток недоступен', 'Добавьте отпечаток пальца в настройках телефона и попробуйте снова.');
    }
    // Проверяем сразу, что отпечаток владельца срабатывает, — до того как на него полагаться
    if (await authenticateBiometric()) update({ biometric: true });
  };

  return (
    <Screen onClose={onClose} title="Настройки">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Размер шрифта</Text>
        <View style={styles.card}>
          {FONT_SIZES.map((f) => (
            <Pressable key={f.key} style={styles.option} onPress={() => update({ fontSize: f.key })}>
              <MaterialCommunityIcons
                name={settings.fontSize === f.key ? 'radiobox-marked' : 'radiobox-blank'}
                size={24}
                color={settings.fontSize === f.key ? colors.accent : colors.muted}
              />
              {/* Каждый вариант показан своим размером */}
              <FontScaleContext.Provider value={f.scale}>
                <Text style={styles.optionText}>{f.label}</Text>
              </FontScaleContext.Provider>
            </Pressable>
          ))}
        </View>

        {lockSupported ? (
          <>
            <Text style={styles.section}>Защита</Text>
            <View style={styles.card}>
              <SwitchRow
                icon="lock-outline"
                label="Вход по коду"
                hint="4 цифры при запуске и после того, как приложение было свёрнуто дольше минуты"
                value={settings.lockEnabled}
                onChange={toggleLock}
              />
              <SwitchRow
                icon="fingerprint"
                label="Вход по отпечатку пальца"
                hint={settings.lockEnabled ? 'Код остаётся запасным способом входа' : 'Сначала включите вход по коду'}
                value={settings.biometric}
                onChange={toggleBiometric}
                disabled={!settings.lockEnabled}
              />
              {settings.lockEnabled ? (
                <Pressable style={styles.option} onPress={startPinSetup}>
                  <MaterialCommunityIcons name="form-textbox-password" size={24} color={colors.muted} />
                  <Text style={styles.optionText}>Сменить код</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.note}>
              Если забыть код и отпечаток не сработает, войти не получится — придётся переустановить приложение и
              восстановить данные из Google Диска.
            </Text>
          </>
        ) : null}

        <Text style={styles.section}>Обновления</Text>
        <View style={styles.card}>
          <View style={styles.option}>
            <MaterialCommunityIcons name="information-outline" size={24} color={colors.muted} />
            <View style={styles.switchText}>
              <Text style={styles.optionText}>Текущая версия</Text>
              <Text style={styles.hint}>{currentVersionLabel()}</Text>
            </View>
          </View>
          {updatesEnabled ? (
            <Pressable style={[styles.option, checking && styles.disabled]} onPress={checkUpdates} disabled={checking}>
              <MaterialCommunityIcons name="update" size={24} color={colors.muted} />
              <Text style={styles.optionText}>{checking ? 'Проверка…' : 'Проверить обновления'}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {pinSetup ? (
        <PinScreen
          title={pinSetup.step === 'enter' ? 'Придумайте код из 4 цифр' : 'Повторите код'}
          error={pinError}
          onComplete={onPin}
          onCancel={() => setPinSetup(null)}
        />
      ) : null}
    </Screen>
  );
}

function SwitchRow(p: {
  icon: 'lock-outline' | 'fingerprint';
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.option, p.disabled && styles.disabled]} onPress={() => !p.disabled && p.onChange(!p.value)}>
      <MaterialCommunityIcons name={p.icon} size={24} color={colors.muted} />
      <View style={styles.switchText}>
        <Text style={styles.optionText}>{p.label}</Text>
        <Text style={styles.hint}>{p.hint}</Text>
      </View>
      <Switch
        value={p.value}
        onValueChange={p.onChange}
        disabled={p.disabled}
        trackColor={{ true: colors.accent, false: colors.divider }}
        thumbColor={p.value ? '#fff' : '#ccc'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 32 },
  section: { color: colors.accent, fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: colors.card, borderRadius: 4, paddingHorizontal: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  optionText: { color: colors.text, fontSize: 18 },
  switchText: { flex: 1 },
  hint: { color: colors.muted, fontSize: 14, marginTop: 2 },
  disabled: { opacity: 0.45 },
  note: { color: colors.muted, fontSize: 14, marginTop: 10, marginHorizontal: 4, lineHeight: 20 },
});
