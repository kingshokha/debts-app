import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './src/ui/Text';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddDialog } from './src/components/AddDialog';
import { AllHistoryScreen } from './src/components/AllHistoryScreen';
import { BackupsScreen } from './src/components/BackupsScreen';
import { BalanceDialog } from './src/components/BalanceDialog';
import { ContactGroupDialog } from './src/components/ContactGroupDialog';
import { ContactRow } from './src/components/ContactRow';
import { DebtBookImportDialog } from './src/components/DebtBookImportDialog';
import { Dialog } from './src/components/Dialog';
import { GroupBar } from './src/components/GroupBar';
import { HistoryModal } from './src/components/HistoryModal';
import { LockScreen } from './src/components/LockScreen';
import { NameDialog } from './src/components/NameDialog';
import { PassportDialog } from './src/components/PassportDialog';
import { PhotoDialog } from './src/components/PhotoDialog';
import { type Anchor, MenuButton, PopupMenu } from './src/components/PopupMenu';
import { SettingsScreen } from './src/components/SettingsScreen';
import { SortDialog } from './src/components/SortDialog';
import { TextImportDialog } from './src/components/TextImportDialog';
import { confirmAction, notify } from './src/confirm';
import { useDrive } from './src/drive/useDrive';
import { formatAmount } from './src/format';
import { type PickedText, pickTextFile } from './src/import/pickFile';
import { type PhotoSource, persistPhotos, pickImages } from './src/photos';
import { useAppLock } from './src/lock';
import { SettingsProvider, useSettings } from './src/settings';
import { matchesSearch, sortContacts } from './src/contactMath';
import { balanceOf, useDebts } from './src/store';
import { amountColor, colors } from './src/theme';
import type { Contact, Group } from './src/types';

type MenuAction = 'payOff' | 'balance' | 'history' | 'clear' | 'rename' | 'group' | 'photo' | 'passport' | 'delete';

const CONTACT_MENU: { action: MenuAction; label: string }[] = [
  { action: 'payOff', label: 'Погасить всю сумму' },
  { action: 'balance', label: 'Изменить баланс' },
  { action: 'history', label: 'История операций' },
  { action: 'clear', label: 'Очистить историю' },
  { action: 'rename', label: 'Переименовать' },
  { action: 'group', label: 'Изменить группу' },
  { action: 'photo', label: 'Добавить фото' },
  { action: 'passport', label: 'Фото паспорта' },
  { action: 'delete', label: 'Удалить контакт' },
];

/** Что сейчас редактируется в NameDialog. */
type NameEdit =
  | { kind: 'contact'; id: string; initial: string }
  | { kind: 'newGroup'; initial: string }
  | { kind: 'renameGroup'; id: string; initial: string };

type MainAction = 'history' | 'backups' | 'settings';

/** Меню «☰». */
const MAIN_MENU: { action: MainAction; label: string }[] = [
  { action: 'history', label: 'История операций' },
  { action: 'backups', label: 'Резервные копии' },
  { action: 'settings', label: 'Настройки' },
];

const NAME_DIALOG_TITLE: Record<NameEdit['kind'], string> = {
  contact: 'Переименовать',
  newGroup: 'Новая группа',
  renameGroup: 'Переименовать группу',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <StatusBar style="light" />
        <MainScreen />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function MainScreen() {
  const insets = useSafeAreaInsets();
  const debts = useDebts();
  const { contacts, groups, templates, sort, view } = debts;
  const drive = useDrive({ contacts, groups, templates, loaded: debts.loaded }, debts.importBackup);

  const [search, setSearch] = useState<string | null>(null); // null — поиск закрыт
  const [addOpen, setAddOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // Растёт при каждом открытии «Добавления» и импорта из текста: новый key пересоздаёт диалог с чистыми полями
  const [dialogKey, setDialogKey] = useState(0);
  const [mainMenu, setMainMenu] = useState<Anchor | null>(null);
  const [screen, setScreen] = useState<MainAction | null>(null);
  const [textImportOpen, setTextImportOpen] = useState(false);
  const [menu, setMenu] = useState<{ id: string; anchor: { x: number; y: number; height: number } } | null>(null);
  const [balanceId, setBalanceId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [nameEdit, setNameEdit] = useState<NameEdit | null>(null);
  const [groupContactId, setGroupContactId] = useState<string | null>(null);
  const [groupActions, setGroupActions] = useState<Group | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [passportId, setPassportId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<PickedText | null>(null);
  const { settings } = useSettings();
  const lock = useAppLock(settings.lockEnabled);

  const byId = (id: string | null) => (id ? (contacts.find((c) => c.id === id) ?? null) : null);

  const inGroups = view.mode === 'groups';
  const groupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  // Ссылка на удалённую группу считается «Без группы»
  const groupOf = useCallback((c: Contact) => (c.groupId && groupIds.has(c.groupId) ? c.groupId : null), [groupIds]);
  const selectedGroup = view.groupId && groupIds.has(view.groupId) ? view.groupId : null;

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of contacts) {
      const key = groupOf(c) ?? '';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [contacts, groupOf]);

  // В режиме «По группам» показываем выбранную группу; поиск ищет по всем контактам
  const scope = useMemo(
    () => (inGroups && search === null ? contacts.filter((c) => groupOf(c) === selectedGroup) : contacts),
    [contacts, inGroups, search, selectedGroup, groupOf],
  );

  const totals = useMemo(() => {
    let plus = 0;
    let minus = 0;
    for (const c of scope) {
      const b = balanceOf(c);
      if (b > 0) plus += b;
      else minus += b;
    }
    return { plus, minus, total: plus + minus };
  }, [scope]);

  // Сортируем только при смене поля или данных; направление — разворот готового списка
  const sorted = useMemo(() => sortContacts(scope, sort.key), [scope, sort.key]);

  const visible = useMemo(() => {
    const q = search?.trim().toLowerCase() ?? '';
    const ordered = sort.desc ? [...sorted].reverse() : sorted;
    return ordered.filter((c) => (sort.showZero || balanceOf(c) !== 0) && matchesSearch(c, q));
  }, [sorted, sort.desc, sort.showZero, search]);

  // Выпадающий список комментариев: прошлые (свежие сверху), затем шаблоны заметок; без повторов
  const suggestions = useMemo(() => {
    const ops = contacts.flatMap((c) => c.operations).filter((op) => op.comment);
    ops.sort((a, b) => b.date - a.date);
    const recent = [...new Set(ops.map((op) => op.comment))].slice(0, 30);
    return [...new Set([...recent, ...templates])];
  }, [contacts, templates]);

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
        return setNameEdit({ kind: 'contact', id: contact.id, initial: contact.name });
      case 'group':
        return setGroupContactId(contact.id);
      case 'photo':
        return setPhotoId(contact.id);
      case 'passport':
        return setPassportId(contact.id);
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

  const menuHasPhoto = !!byId(menu?.id ?? null)?.photo;
  const menuItems = useMemo(
    () => CONTACT_MENU.map((item) => (item.action === 'photo' && menuHasPhoto ? { ...item, label: 'Изменить фото' } : item)),
    [menuHasPhoto],
  );

  const onRowPhoto = useCallback((id: string) => setPhotoId(id), []);

  const choosePhoto = async (contactId: string, source: PhotoSource) => {
    try {
      const picked = await pickImages(source, { crop: true });
      if (picked === 'denied') notify('Нет доступа к камере', 'Разрешите приложению доступ к камере в настройках телефона.');
      else if (picked.length) debts.setPhoto(contactId, (await persistPhotos(picked))[0]);
    } catch (e) {
      console.warn(e);
      notify('Не удалось получить фото', source === 'camera' ? 'Камера недоступна.' : undefined);
    }
  };

  const removePhoto = (contact: Contact) =>
    confirmAction('Удалить фото?', contact.name, 'Удалить', () => debts.setPhoto(contact.id, null), true);

  const openAdd = () => {
    setDialogKey((k) => k + 1);
    setAddOpen(true);
  };

  const importFromFile = async () => {
    try {
      const file = await pickTextFile();
      if (!file) return;
      setImportFile(file);
    } catch (e) {
      console.warn(e);
      notify('Не удалось открыть файл', String((e as Error)?.message ?? e));
    }
  };

  const openTextImport = () => {
    setDialogKey((k) => k + 1);
    setTextImportOpen(true);
  };

  const submitName = (name: string) => {
    if (!nameEdit) return;
    if (nameEdit.kind === 'contact') debts.rename(nameEdit.id, name);
    else if (nameEdit.kind === 'renameGroup') debts.renameGroup(nameEdit.id, name);
    else debts.setView({ mode: 'groups', groupId: debts.addGroup(name) });
  };

  const deleteGroup = (group: Group) => {
    const count = groupCounts[group.id] ?? 0;
    confirmAction(
      'Удалить группу?',
      `«${group.name}»\nКонтакты (${count}) не удалятся — они перейдут в «Без группы».`,
      'Удалить',
      () => debts.removeGroup(group.id),
      true,
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {search === null ? (
          <>
            <MenuButton onOpen={setMainMenu} icon="menu" size={30} color="#fff" style={styles.iconBtn} />
            <View style={{ flex: 1 }} />
            <View style={styles.sep} />
            <Pressable onPress={() => setSearch('')} hitSlop={8} style={styles.iconBtn}>
              <MaterialCommunityIcons name="magnify" size={28} color="#fff" />
            </Pressable>
            <View style={styles.sep} />
            <Pressable
              onPress={() => debts.setView({ ...view, mode: inGroups ? 'all' : 'groups' })}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityLabel={inGroups ? 'Показать всех' : 'Показать по группам'}
            >
              <MaterialCommunityIcons
                name={inGroups ? 'folder' : 'folder-outline'}
                size={27}
                color={inGroups ? colors.accent : '#fff'}
              />
            </Pressable>
            <View style={styles.sep} />
            <Pressable onPress={() => setSortOpen(true)} hitSlop={8} style={styles.iconBtn}>
              <MaterialCommunityIcons name="sort-ascending" size={28} color="#fff" />
            </Pressable>
            <View style={styles.sep} />
            <View style={styles.totals}>
              <Text style={[styles.totalSmall, { color: amountColor(totals.minus) }]}>{formatAmount(totals.minus)}</Text>
              <Text style={[styles.totalSmall, { color: amountColor(totals.plus) }]}>{formatAmount(totals.plus)}</Text>
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

      {inGroups && search === null ? (
        <GroupBar
          groups={groups}
          counts={groupCounts}
          selected={selectedGroup}
          onSelect={(groupId) => debts.setView({ mode: 'groups', groupId })}
          onLongPress={setGroupActions}
          onCreate={() => setNameEdit({ kind: 'newGroup', initial: '' })}
        />
      ) : null}

      {debts.loaded ? (
        <FlatList
          data={visible}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ContactRow contact={item} onPress={onRowPress} onMenu={onRowMenu} onPhoto={onRowPhoto} />}
          contentContainerStyle={{ paddingTop: 7, paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search
                ? 'Ничего не найдено'
                : inGroups
                  ? 'В этой группе пока никого.\nНажмите «+», чтобы добавить.'
                  : 'Пока нет должников.\nНажмите «+», чтобы добавить.'}
            </Text>
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
          onPress={openAdd}
        >
          <MaterialCommunityIcons name="plus" size={32} color="#fff" />
        </Pressable>
      </View>

      <AddDialog
        key={`add-${dialogKey}`}
        visible={addOpen}
        contacts={contacts}
        groups={groups}
        defaultGroupId={inGroups ? selectedGroup : null}
        suggestions={suggestions}
        onClose={() => setAddOpen(false)}
        onCreateGroup={debts.addGroup}
        onSubmit={debts.addContact}
      />
      <SortDialog visible={sortOpen} sort={sort} onChange={debts.setSort} onClose={() => setSortOpen(false)} />
      <PopupMenu items={menuItems} anchor={menu?.anchor ?? null} onSelect={onMenuAction} onClose={() => setMenu(null)} />
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
      <NameDialog
        title={nameEdit ? NAME_DIALOG_TITLE[nameEdit.kind] : ''}
        initialValue={nameEdit?.initial ?? null}
        placeholder={nameEdit?.kind === 'contact' ? 'Имя контакта' : 'Название группы'}
        onClose={() => setNameEdit(null)}
        onSubmit={submitName}
      />
      <ContactGroupDialog
        contact={byId(groupContactId)}
        groups={groups}
        onClose={() => setGroupContactId(null)}
        onCreateGroup={debts.addGroup}
        onSubmit={debts.setContactGroup}
      />
      <PhotoDialog contact={byId(photoId)} onClose={() => setPhotoId(null)} onPick={choosePhoto} onRemove={removePhoto} />
      <PassportDialog contact={byId(passportId)} onClose={() => setPassportId(null)} onSubmit={debts.setPassport} />
      <Dialog visible={groupActions !== null} onClose={() => setGroupActions(null)} title={groupActions?.name}>
        {(['rename', 'delete'] as const).map((action) => (
          <Pressable
            key={action}
            style={styles.dialogItem}
            onPress={() => {
              const group = groupActions!;
              setGroupActions(null);
              if (action === 'rename') setNameEdit({ kind: 'renameGroup', id: group.id, initial: group.name });
              else deleteGroup(group);
            }}
          >
            <Text style={[styles.dialogItemText, action === 'delete' && { color: colors.red }]}>
              {action === 'rename' ? 'Переименовать группу' : 'Удалить группу'}
            </Text>
          </Pressable>
        ))}
      </Dialog>
      <PopupMenu align="left" items={MAIN_MENU} anchor={mainMenu} onSelect={setScreen} onClose={() => setMainMenu(null)} />
      {screen === 'history' ? (
        <AllHistoryScreen
          contacts={contacts}
          groups={groups}
          suggestions={suggestions}
          onClose={() => setScreen(null)}
          onOpenContact={setHistoryId}
          onUpdateOperation={debts.updateOperation}
          onDeleteOperation={debts.removeOperation}
        />
      ) : null}
      {screen === 'backups' ? (
        <BackupsScreen
          drive={drive}
          contacts={contacts}
          groups={groups}
          templates={templates}
          onClose={() => setScreen(null)}
          onImportText={openTextImport}
          onImportFile={importFromFile}
        />
      ) : null}
      {screen === 'settings' ? <SettingsScreen onClose={() => setScreen(null)} /> : null}
      <TextImportDialog
        key={`text-import-${dialogKey}`}
        visible={textImportOpen}
        contactsCount={contacts.length}
        onClose={() => setTextImportOpen(false)}
        onImport={debts.importBackup}
      />
      <DebtBookImportDialog
        file={importFile}
        onClose={() => setImportFile(null)}
        onPlan={debts.planDebtBookImport}
        onImport={debts.importDebtBook}
      />
      {/* Последним, чтобы закрывать всё, включая открытые разделы */}
      {lock.locked ? <LockScreen biometric={settings.biometric} onUnlock={lock.unlock} /> : null}
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
  dialogItem: { paddingVertical: 14 },
  dialogItemText: { color: colors.text, fontSize: 17 },
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
