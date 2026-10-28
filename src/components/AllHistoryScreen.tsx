import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { confirmAction } from '../confirm';
import { formatAmount, formatDateTimeFull } from '../format';
import { balanceOf } from '../store';
import { amountColor, colors } from '../theme';
import type { Contact, Group, Operation } from '../types';
import { Text, TextInput } from '../ui/Text';
import { EditOperationDialog } from './EditOperationDialog';
import { type Anchor, MenuButton, PopupMenu } from './PopupMenu';
import { Screen, screenStyles } from './Screen';

type Props = {
  contacts: Contact[];
  groups: Group[];
  suggestions: string[];
  onClose: () => void;
  onOpenContact: (contactId: string) => void;
  onUpdateOperation: (contactId: string, opId: string, patch: Omit<Operation, 'id'>) => void;
  onDeleteOperation: (contactId: string, opId: string) => void;
};

type Entry = { op: Operation; contact: Contact };
type RowAction = 'edit' | 'delete' | 'open';

/** Фильтр по группе: undefined — все контакты, null — «Без группы». */
type GroupFilter = string | null | undefined;

const ALL = '__all__';
const NO_GROUP = '__none__';

/** «История операций»: все операции всех контактов одной лентой, новые сверху. */
export function AllHistoryScreen({ contacts, groups, suggestions, onClose, onOpenContact, onUpdateOperation, onDeleteOperation }: Props) {
  const [filter, setFilter] = useState<GroupFilter>(undefined);
  const [search, setSearch] = useState<string | null>(null); // null — поиск закрыт
  const [newestFirst, setNewestFirst] = useState(true);
  const [filterMenu, setFilterMenu] = useState<Anchor | null>(null);
  const [rowMenu, setRowMenu] = useState<{ entry: Entry; anchor: Anchor } | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);

  const groupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  // Ссылка на удалённую группу считается «Без группы», как на главном экране
  const scoped = useMemo(() => {
    if (filter === undefined) return contacts;
    return contacts.filter((c) => (c.groupId && groupIds.has(c.groupId) ? c.groupId : null) === filter);
  }, [contacts, filter, groupIds]);

  const total = useMemo(() => scoped.reduce((s, c) => s + balanceOf(c), 0), [scoped]);

  const entries = useMemo(() => {
    const q = search?.trim().toLowerCase() ?? '';
    const list: Entry[] = [];
    for (const contact of scoped) {
      const nameMatches = !q || contact.name.toLowerCase().includes(q);
      for (const op of contact.operations) {
        if (nameMatches || op.comment.toLowerCase().includes(q)) list.push({ op, contact });
      }
    }
    const dir = newestFirst ? -1 : 1;
    return list.sort((a, b) => dir * (a.op.date - b.op.date));
  }, [scoped, search, newestFirst]);

  const filterLabel =
    filter === undefined ? 'Все контакты' : filter === null ? 'Без группы' : (groups.find((g) => g.id === filter)?.name ?? '');

  const onRowAction = (action: RowAction) => {
    const entry = rowMenu?.entry;
    if (!entry) return;
    if (action === 'edit') return setEditing(entry);
    if (action === 'open') return onOpenContact(entry.contact.id);
    confirmAction(
      'Удалить операцию?',
      `${entry.contact.name}\n${formatAmount(entry.op.amount)} будет убрано из истории, баланс пересчитается.`,
      'Удалить',
      () => onDeleteOperation(entry.contact.id, entry.op.id),
      true,
    );
  };

  const title =
    search !== null ? (
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Имя или комментарий"
        placeholderTextColor="rgba(255,255,255,0.5)"
        autoFocus
        selectionColor={colors.accent}
        cursorColor={colors.accent}
      />
    ) : (
      <FilterTitle label={filterLabel} total={total} onOpen={setFilterMenu} />
    );

  return (
    <Screen
      onClose={onClose}
      title={title}
      right={
        <>
          <Pressable
            onPress={() => setSearch(search === null ? '' : null)}
            hitSlop={8}
            style={screenStyles.headerButton}
            accessibilityLabel={search === null ? 'Поиск' : 'Закрыть поиск'}
          >
            <MaterialCommunityIcons name={search === null ? 'magnify' : 'close'} size={26} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => setNewestFirst((v) => !v)}
            hitSlop={8}
            style={screenStyles.headerButton}
            accessibilityLabel={newestFirst ? 'Сначала старые' : 'Сначала новые'}
          >
            <MaterialCommunityIcons name={newestFirst ? 'sort-descending' : 'sort-ascending'} size={26} color="#fff" />
          </Pressable>
        </>
      }
    >
      <FlatList
        data={entries}
        keyExtractor={(e) => e.op.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        ListEmptyComponent={<Text style={styles.empty}>{search ? 'Ничего не найдено' : 'Операций пока нет'}</Text>}
        renderItem={({ item }) => (
          <HistoryRow entry={item} onPress={onOpenContact} onMenu={(anchor) => setRowMenu({ entry: item, anchor })} />
        )}
      />

      <PopupMenu
        align="left"
        items={[
          { action: ALL, label: 'Все контакты' },
          ...groups.map((g) => ({ action: g.id, label: g.name })),
          { action: NO_GROUP, label: 'Без группы' },
        ]}
        anchor={filterMenu}
        onSelect={(key) => setFilter(key === ALL ? undefined : key === NO_GROUP ? null : key)}
        onClose={() => setFilterMenu(null)}
      />
      <PopupMenu
        items={[
          { action: 'edit', label: 'Редактировать' },
          { action: 'open', label: 'История контакта' },
          { action: 'delete', label: 'Удалить' },
        ]}
        anchor={rowMenu?.anchor ?? null}
        onSelect={onRowAction}
        onClose={() => setRowMenu(null)}
      />
      {editing ? (
        <EditOperationDialog
          contact={editing.contact}
          operation={editing.op}
          suggestions={suggestions}
          onClose={() => setEditing(null)}
          onSubmit={onUpdateOperation}
        />
      ) : null}
    </Screen>
  );
}

/** «Все контакты ▾» и баланс под ним; нажатие открывает выбор группы. */
function FilterTitle({ label, total, onOpen }: { label: string; total: number; onOpen: (anchor: Anchor) => void }) {
  return (
    <Pressable
      style={styles.filter}
      onPress={(e) => {
        const { pageY } = e.nativeEvent;
        onOpen({ x: 0, y: pageY - 20, height: 40 });
      }}
    >
      <Text style={styles.filterLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.filterTotal}>
        <Text style={[styles.total, { color: amountColor(total) }]}>{formatAmount(total)}</Text>
        <MaterialCommunityIcons name="menu-down" size={22} color="#fff" />
      </View>
    </Pressable>
  );
}

const HistoryRow = memo(function HistoryRow({
  entry: { op, contact },
  onPress,
  onMenu,
}: {
  entry: Entry;
  onPress: (contactId: string) => void;
  onMenu: (anchor: Anchor) => void;
}) {
  return (
    <Pressable style={styles.row} android_ripple={{ color: 'rgba(255,255,255,0.08)' }} onPress={() => onPress(contact.id)}>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.amount, { color: amountColor(op.amount) }]}>{formatAmount(op.amount)}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {contact.name}
          </Text>
        </View>
        <Text style={styles.meta} numberOfLines={3}>
          {formatDateTimeFull(op.date)}
          {op.comment ? <Text style={styles.comment}>{'   '}{op.comment}</Text> : null}
        </Text>
      </View>
      <MenuButton onOpen={onMenu} color={colors.muted} style={styles.dots} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  search: { color: '#fff', fontSize: 18, paddingVertical: 4 },
  filter: { alignItems: 'center' },
  filterLabel: { color: '#fff', fontSize: 17, fontWeight: '600' },
  filterTotal: { flexDirection: 'row', alignItems: 'center' },
  total: { fontSize: 15, fontWeight: '700' },
  list: { paddingHorizontal: 6, paddingTop: 4, paddingBottom: 24 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontSize: 16 },
  row: {
    backgroundColor: colors.card,
    borderRadius: 3,
    marginBottom: 4,
    paddingLeft: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  amount: { fontSize: 18, fontWeight: '700' },
  name: { flex: 1, color: colors.text, fontSize: 18 },
  meta: { color: colors.muted, fontSize: 15 },
  comment: { color: colors.text },
  dots: { paddingHorizontal: 10, paddingVertical: 4 },
});
