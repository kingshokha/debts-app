import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { colors } from '../theme';
import type { Group } from '../types';

type Props = {
  groups: Group[];
  value: string | null;
  onChange: (groupId: string | null) => void;
  /** Создаёт группу и возвращает её id. */
  onCreate: (name: string) => string;
};

/** Чипы групп: «Без группы», существующие группы и «+ Новая» с полем ввода. */
export function GroupSelect({ groups, value, onChange, onCreate }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = () => {
    if (!name.trim()) return;
    onChange(onCreate(name));
    setName('');
    setCreating(false);
  };

  return (
    <View>
      <View style={styles.chips}>
        <Chip label="Без группы" active={value === null} onPress={() => onChange(null)} />
        {groups.map((g) => (
          <Chip key={g.id} label={g.name} active={value === g.id} onPress={() => onChange(g.id)} />
        ))}
        {!creating ? <Chip label="+ Новая" dashed onPress={() => setCreating(true)} /> : null}
      </View>
      {creating ? (
        <View style={styles.newRow}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Название группы"
            placeholderTextColor={colors.muted}
            autoFocus
            onSubmitEditing={create}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
          />
          <Pressable onPress={create} hitSlop={8} disabled={!name.trim()}>
            <MaterialCommunityIcons name="check" size={26} color={name.trim() ? colors.green : colors.divider} />
          </Pressable>
          <Pressable onPress={() => setCreating(false)} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={24} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

type ChipProps = { label: string; active?: boolean; dashed?: boolean; onPress: () => void };

export function Chip({ label, active, dashed, onPress }: ChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive, dashed && styles.chipDashed]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 200,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipDashed: { borderStyle: 'dashed' },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: '#1e1e1e', fontWeight: '700' },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingVertical: 4,
    outlineWidth: 0,
  },
});
