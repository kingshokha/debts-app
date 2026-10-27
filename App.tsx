import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddDialog } from './src/components/AddDialog';
import { BackupDialog } from './src/components/BackupDialog';
import { BalanceDialog } from './src/components/BalanceDialog';
import { ContactRow } from './src/components/ContactRow';
import { HistoryModal } from './src/components/HistoryModal';
import { PopupMenu } from './src/components/PopupMenu';
import { RenameDialog } from './src/components/RenameDialog';
import { SortDialog } from './src/components/SortDialog';
import { confirmAction, notify } from './src/confirm';
import { formatAmount } from './src/format';
import { balanceOf, lastDateOf, useDebts } from './src/store';
import { colors } from './src/theme';

type MenuAction = 'payOff' | 'balance' | 'history' | 'clear' | 'rename' | 'delete';

const CONTACT_MENU: { action: MenuAction; label: string }[] = [
  { action: 'payOff', label: 'Погасить всю сумму' },
  { action: 'balance', label: 'Изменить баланс' },
  { action: 'history', label: 'История операций' },
  { action: 'clear', label: 'Очистить историю' },
  { action: 'rename', label: 'Переименовать' },
  { action: 'delete', label: 'Удалить контакт' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <MainScreen />
    </SafeAreaProvider>
  );
}

function MainScreen() {
  const insets = useSafeAreaInsets();
  const debts = useDebts();
  const { contacts, sort } = debts;

  const [search, setSearch] = useState<string | null>(null); // null — поиск закрыт
  const [addOpen, setAddOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [menu, setMenu] = useState<{ id: string; anchor: { x: number; y: number; height: number } } | null>(null);
  const [balanceId, setBalanceId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);

  const byId = (id: string | null) => (id ? (contacts.find((c) => c.id === id) ?? null) : null);

  const totals = useMemo(() => {
    let plus = 0;
    let minus = 0;
    for (const c of contacts) {
      const b = balanceOf(c);
      if (b > 0) plus += b;
      else minus += b;
    }
    return { plus, minus, total: plus + minus };
  }, [contacts]);

  const visible = useMemo(() => {
    const q = search?.trim().toLowerCase() ?? '';
    const list = contacts.filter((c) => {
      if (!sort.showZero && balanceOf(c) === 0) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.operations.some((op) => op.comment.toLowerCase().includes(q));
    });
    const dir = sort.desc ? -1 : 1;
    const cmp = {
      name: (a: typeof list[0], b: typeof list[0]) => a.name.localeCompare(b.name, 'ru'),
      amount: (a: typeof list[0], b: typeof list[0]) => balanceOf(a) - balanceOf(b),
      date: (a: typeof list[0], b: typeof list[0]) => lastDateOf(a) - lastDateOf(b),
    }[sort.key];
    return list.sort((a, b) => dir * cmp(a, b));
  }, [contacts, sort, search]);

  // Прошлые комментарии для выпадающего списка: свежие сверху, без повторов
  const suggestions = useMemo(() => {
    const ops = contacts.flatMap((c) => c.operations).filter((op) => op.comment);
    ops.sort((a, b) => b.date - a.date);
    return [...new Set(ops.map((op) => op.comment))].slice(0, 30);
  }, [contacts]);

  const onRowPress = useCallback((id: string) => setBalanceId(id), []);
  const onRowMenu = useCallback((id: string, anchor: { x: number; y: number; height: number }) => setMenu({ id, anchor }), []);

  const onMenuAction = (action: MenuAction) => {
    const contact = byId(menu?.id ?? null);
    if (!contact) return;
    switch (action) {
      case 'payOff': {
        const b = balanceOf(contact);
        if (!b) return notify('Баланс уже нулевой');
        return confirmAction('Погасить всю сумму?', `${contact.name}\n${formatAmount(b)} → 0`, 'Погасить', () =>
          debts.payOff(contact.id),
        );
      }
      case 'balance':
        return setBalanceId(contact.id);
      case 'history':
        return setHistoryId(contact.id);
      case 'clear':
        return confirmAction(
          'Очистить историю?',
          'Все операции будут заменены одной записью с текущим балансом.',
          'Очистить',
          () => debts.clearHistory(contact.id),
          true,
        );
      case 'rename':
        return setRenameId(contact.id);
      case 'delete':
        return confirmAction(
          'Удалить контакт?',
          `${contact.name}\nБаланс: ${formatAmount(balanceOf(contact))}`,
          'Удалить',
          () => debts.removeContact(contact.id),
          true,
        );
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {search === null ? (
          <>
            <Pressable onPress={() => setBackupOpen(true)} hitSlop={8} style={styles.iconBtn}>
              <MaterialCommunityIcons name="menu" size={30} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }} />
            <View style={styles.sep} />
            <Pressable onPress={() => setSearch('')} hitSlop={8} style={styles.iconBtn}>
              <MaterialCommunityIcons name="magnify" size={28} color="#fff" />
            </Pressable>
            <View style={styles.sep} />
            <Pressable onPress={() => setSortOpen(true)} hitSlop={8} style={styles.iconBtn}>
              <MaterialCommunityIcons name="sort-ascending" size={28} color="#fff" />
            </Pressable>
            <View style={styles.sep} />
            <View style={styles.totals}>
              <Text style={[styles.totalSmall, { color: colors.red }]}>{formatAmount(totals.minus)}</Text>
              <Text style={[styles.totalSmall, { color: colors.green }]}>{formatAmount(totals.plus)}</Text>
              <View style={styles.totalLine} />
              <Text style={styles.total}>{formatAmount(totals.total)}</Text>
            </View>
          </>
        ) : (
          <>
            <Pressable onPress={() => setSearch(null)} hitSlop={8} style={styles.iconBtn}>
              <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
            </Pressable>
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Поиск по имени или комментарию"
              placeholderTextColor="#8aa0b8"
              autoFocus
              selectionColor={colors.accent}
              cursorColor={colors.accent}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8} style={styles.iconBtn}>
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {debts.loaded ? (
        <FlatList
          data={visible}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ContactRow contact={item} onPress={onRowPress} onMenu={onRowMenu} />}
          contentContainerStyle={{ paddingTop: 7, paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>{search ? 'Ничего не найдено' : 'Пока нет должников.\nНажмите «+», чтобы добавить.'}</Text>
          }
        />
      ) : (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      )}

      {/* Фон и тень — на View, ripple — на внутреннем Pressable: borderless-ripple на Android затирает backgroundColor */}
      <View style={[styles.fab, { bottom: insets.bottom + 24 }]}>
        <Pressable
          style={styles.fabPress}
          android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
          onPress={() => setAddOpen(true)}
        >
          <MaterialCommunityIcons name="plus" size={32} color="#fff" />
        </Pressable>
      </View>

      <AddDialog
        visible={addOpen}
        contacts={contacts}
        suggestions={suggestions}
        onClose={() => setAddOpen(false)}
        onSubmit={debts.addContact}
      />
      <SortDialog visible={sortOpen} sort={sort} onChange={debts.setSort} onClose={() => setSortOpen(false)} />
      <PopupMenu items={CONTACT_MENU} anchor={menu?.anchor ?? null} onSelect={onMenuAction} onClose={() => setMenu(null)} />
      <BalanceDialog
        contact={byId(balanceId)}
        suggestions={suggestions}
        onClose={() => setBalanceId(null)}
        onSubmit={debts.addOperation}
        onHistory={setHistoryId}
      />
      <HistoryModal
        contact={byId(historyId)}
        suggestions={suggestions}
        onClose={() => setHistoryId(null)}
        onDeleteOperation={debts.removeOperation}
        onUpdateOperation={debts.updateOperation}
      />
      <RenameDialog contact={byId(renameId)} onClose={() => setRenameId(null)} onSubmit={debts.rename} />
      <BackupDialog visible={backupOpen} contacts={contacts} onClose={() => setBackupOpen(false)} onImport={debts.replaceAll} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.header, flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 8 },
  iconBtn: { padding: 10 },
  sep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 10, backgroundColor: 'rgba(255,255,255,0.25)' },
  totals: { alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 4, minWidth: 90 },
  totalSmall: { fontSize: 15, fontWeight: '600', lineHeight: 18 },
  totalLine: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.4)', marginVertical: 2 },
  total: { color: '#fff', fontSize: 15, fontWeight: '600', lineHeight: 18 },
  search: { flex: 1, color: '#fff', fontSize: 18, paddingVertical: 8 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 60, fontSize: 16, lineHeight: 24 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    overflow: 'hidden',
    elevation: 6,
  },
  fabPress: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
