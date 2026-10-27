import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { SortKey, SortSettings } from '../types';
import { Dialog, dialogStyles } from './Dialog';

const OPTIONS: { key: SortKey; desc: boolean; label: string }[] = [
  { key: 'name', desc: false, label: 'Возрастание по Имени' },
  { key: 'amount', desc: false, label: 'Возрастание по Сумме' },
  { key: 'date', desc: false, label: 'Возрастание по Дате' },
  { key: 'name', desc: true, label: 'Убывание по Имени' },
  { key: 'amount', desc: true, label: 'Убывание по Сумме' },
  { key: 'date', desc: true, label: 'Убывание по Дате' },
];

type Props = {
  visible: boolean;
  sort: SortSettings;
  onChange: (s: SortSettings) => void;
  onClose: () => void;
};

export function SortDialog({ visible, sort, onChange, onClose }: Props) {
  return (
    <Dialog visible={visible} onClose={onClose} title="Список контактов">
      <Pressable style={styles.checkRow} onPress={() => onChange({ ...sort, showZero: !sort.showZero })}>
        <MaterialCommunityIcons
          name={sort.showZero ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={26}
          color={sort.showZero ? colors.accent : colors.muted}
        />
        <Text style={styles.text}>Отображать нулевой баланс</Text>
      </Pressable>
      <View style={[dialogStyles.divider, { marginHorizontal: -24 }]} />
      {OPTIONS.map((o) => {
        const active = o.key === sort.key && o.desc === sort.desc;
        return (
          <Pressable
            key={o.label}
            style={styles.option}
            android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
            onPress={() => {
              onChange({ ...sort, key: o.key, desc: o.desc });
              onClose();
            }}
          >
            <Text style={[styles.text, active && styles.active]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  option: { paddingVertical: 14 },
  text: { color: colors.text, fontSize: 17 },
  active: { fontWeight: '700' },
});
