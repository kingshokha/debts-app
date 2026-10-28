import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { colors } from '../theme';
import type { Group } from '../types';

type Props = {
  groups: Group[];
  /** Количество контактов по id группы; ключ '' — «Без группы». */
  counts: Record<string, number>;
  selected: string | null;
  onSelect: (groupId: string | null) => void;
  onLongPress: (group: Group) => void;
  onCreate: () => void;
};

/** Полоса выбора группы под шапкой в режиме «По группам». */
export function GroupBar({ groups, counts, selected, onSelect, onLongPress, onCreate }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.content}
    >
      {groups.map((g) => (
        <Tab
          key={g.id}
          label={g.name}
          count={counts[g.id] ?? 0}
          active={selected === g.id}
          onPress={() => onSelect(g.id)}
          onLongPress={() => onLongPress(g)}
        />
      ))}
      <Tab label="Без группы" count={counts[''] ?? 0} active={selected === null} onPress={() => onSelect(null)} />
      <Pressable style={[styles.tab, styles.add]} onPress={onCreate}>
        <Text style={styles.text}>+ Группа</Text>
      </Pressable>
    </ScrollView>
  );
}

type TabProps = { label: string; count: number; active: boolean; onPress: () => void; onLongPress?: () => void };

function Tab({ label, count, active, onPress, onLongPress }: TabProps) {
  return (
    <Pressable style={[styles.tab, active && styles.active]} onPress={onPress} onLongPress={onLongPress}>
      <Text style={[styles.text, active && styles.activeText]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.count, active && styles.activeText]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // У ScrollView по умолчанию flexShrink: 1 — длинный список под полосой сжимал её и обрезал вкладки
  bar: { flexGrow: 0, flexShrink: 0, backgroundColor: '#0e3760' },
  content: { paddingHorizontal: 8, paddingVertical: 8, gap: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    maxWidth: 220,
  },
  active: { backgroundColor: colors.accent },
  add: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'transparent' },
  text: { color: '#fff', fontSize: 15, flexShrink: 1 },
  count: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  activeText: { color: '#1e1e1e', fontWeight: '700' },
});
