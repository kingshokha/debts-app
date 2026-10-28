import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Share, StyleSheet, View } from 'react-native';
import { serializeBackup } from '../backup';
import { confirmAction, notify } from '../confirm';
import type { DriveFile } from '../drive/api';
import { backupStats, deleteDriveBackup } from '../drive/backup';
import type { useDrive } from '../drive/useDrive';
import { formatAgo, formatAmount } from '../format';
import { amountColor, colors } from '../theme';
import type { Contact, Group } from '../types';
import { Text } from '../ui/Text';
import { type Anchor, MenuButton, PopupMenu } from './PopupMenu';
import { Screen, screenStyles } from './Screen';

type Drive = ReturnType<typeof useDrive>;

type Props = {
  drive: Drive;
  contacts: Contact[];
  groups: Group[];
  templates: string[];
  onClose: () => void;
  /** «Импорт из текста» — диалог открывает App. */
  onImportText: () => void;
  /** «Импорт из файла (.txt)» долговой книги. */
  onImportFile: () => void;
};

type HeaderAction = 'backup' | 'connect' | 'disconnect' | 'export' | 'importText' | 'importFile';
type ItemAction = 'restore' | 'delete';

const message = (e: unknown) => String((e as Error)?.message ?? e);

/** «Резервные копии»: копии в Google Диске, создание, восстановление, экспорт и импорт. */
export function BackupsScreen({ drive, contacts, groups, templates, onClose, onImportText, onImportFile }: Props) {
  const [backups, setBackups] = useState<DriveFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [headerMenu, setHeaderMenu] = useState<Anchor | null>(null);
  const [itemMenu, setItemMenu] = useState<{ file: DriveFile; anchor: Anchor } | null>(null);

  const { account, listBackups } = drive;
  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      setBackups(await listBackups());
    } catch (e) {
      notify('Не удалось получить список копий', message(e));
    } finally {
      setLoading(false);
    }
  }, [account, listBackups]);

  // Список обновляется при открытии и после каждой новой копии
  const { lastBackupAt } = drive;
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    listBackups()
      .then((list) => !cancelled && setBackups(list))
      .catch((e) => !cancelled && notify('Не удалось получить список копий', message(e)));
    return () => {
      cancelled = true;
    };
  }, [account, listBackups, lastBackupAt]);

  const headerItems: { action: HeaderAction; label: string }[] = [
    ...(drive.account
      ? [
          { action: 'backup' as const, label: 'Создать копию сейчас' },
          { action: 'disconnect' as const, label: 'Отключить Google Диск' },
        ]
      : drive.unavailable
        ? []
        : [{ action: 'connect' as const, label: 'Подключить Google Диск' }]),
    { action: 'export', label: 'Экспорт (поделиться)' },
    { action: 'importText', label: 'Импорт из текста' },
    { action: 'importFile', label: 'Импорт из файла (.txt)' },
  ];

  const onHeaderAction = (action: HeaderAction) => {
    switch (action) {
      case 'backup':
        return drive.backupNow();
      case 'connect':
        return drive.connect();
      case 'disconnect':
        return confirmAction(
          'Отключить Google Диск?',
          'Автоматические копии прекратятся. Уже сохранённые копии останутся в папке «Долги» на Диске.',
          'Отключить',
          () => drive.disconnect(),
          true,
        );
      case 'export':
        return Share.share({ message: serializeBackup(contacts, groups, templates) });
      case 'importText':
        return onImportText();
      case 'importFile':
        return onImportFile();
    }
  };

  const onItemAction = (action: ItemAction) => {
    const file = itemMenu?.file;
    if (!file) return;
    const when = formatAgo(Date.parse(file.createdTime));
    if (action === 'restore') {
      return confirmAction(
        'Восстановить из копии?',
        `Копия: ${when}.\nВсе текущие данные будут заменены данными из этой копии.`,
        'Восстановить',
        async () => {
          const missing = await drive.restore(file.id);
          if (missing !== null) notify('Данные восстановлены', missing ? `Не нашлось фото: ${missing}.` : undefined);
        },
        true,
      );
    }
    confirmAction(
      'Удалить копию?',
      `Копия: ${when}.\nФото на Диске останутся — на них ссылаются другие копии.`,
      'Удалить',
      async () => {
        try {
          await deleteDriveBackup(file.id);
          setBackups((list) => list?.filter((f) => f.id !== file.id) ?? null);
        } catch (e) {
          notify('Не удалось удалить копию', message(e));
        }
      },
      true,
    );
  };

  return (
    <Screen
      onClose={onClose}
      title="Резервные копии"
      right={<MenuButton onOpen={setHeaderMenu} color="#fff" style={screenStyles.headerButton} />}
    >
      <Status drive={drive} />
      {drive.account ? (
        <FlatList
          data={backups ?? []}
          keyExtractor={(f) => f.id}
          refreshing={loading}
          onRefresh={load}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            backups === null || loading ? (
              <ActivityIndicator color={colors.accent} style={styles.spinner} />
            ) : (
              <Text style={styles.empty}>Копий пока нет. Первая появится автоматически.</Text>
            )
          }
          renderItem={({ item }) => <BackupRow file={item} onMenu={(anchor) => setItemMenu({ file: item, anchor })} />}
        />
      ) : null}

      <PopupMenu items={headerItems} anchor={headerMenu} onSelect={onHeaderAction} onClose={() => setHeaderMenu(null)} />
      <PopupMenu
        items={[
          { action: 'restore', label: 'Восстановить' },
          { action: 'delete', label: 'Удалить' },
        ]}
        anchor={itemMenu?.anchor ?? null}
        onSelect={onItemAction}
        onClose={() => setItemMenu(null)}
      />
    </Screen>
  );
}

/** Состояние Google Диска над списком: не подключён / идёт копия / ошибка / аккаунт. */
function Status({ drive }: { drive: Drive }) {
  if (drive.unavailable) return <Text style={[styles.status, styles.statusText]}>{drive.unavailable}</Text>;
  if (drive.checking) return null;
  if (!drive.account) {
    return (
      <View style={styles.status}>
        <Text style={styles.statusText}>
          Подключите Google Диск — приложение будет раз в сутки сохранять туда копию вместе с фото и паспортами.
        </Text>
        <Pressable style={styles.connect} onPress={() => drive.connect()}>
          <MaterialCommunityIcons name="google-drive" size={20} color={colors.bg} />
          <Text style={styles.connectText}>ПОДКЛЮЧИТЬ GOOGLE ДИСК</Text>
        </Pressable>
        {drive.lastError ? <Text style={styles.error}>{drive.lastError}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.status}>
      <Text style={styles.statusHint} numberOfLines={1}>
        {drive.account} · автокопия раз в сутки
      </Text>
      {drive.busy ? (
        <View style={styles.progress}>
          <Text style={styles.statusHint}>{drive.busy.label}</Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${Math.round(drive.busy.progress * 100)}%` }]} />
          </View>
        </View>
      ) : null}
      {drive.lastError && !drive.busy ? <Text style={styles.error}>{drive.lastError}</Text> : null}
    </View>
  );
}

function BackupRow({ file, onMenu }: { file: DriveFile; onMenu: (anchor: Anchor) => void }) {
  const stats = backupStats(file);
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.when}>{formatAgo(Date.parse(file.createdTime))}</Text>
        {stats ? (
          <>
            <View style={styles.counts}>
              <MaterialCommunityIcons name="account-multiple" size={16} color={colors.muted} />
              <Text style={styles.count}>{stats.contacts}</Text>
              <MaterialCommunityIcons name="file-document-outline" size={16} color={colors.muted} style={styles.gap} />
              <Text style={styles.count}>{stats.operations}</Text>
            </View>
            <Text style={styles.totals}>
              <Text style={{ color: amountColor(stats.positive) }}>{formatAmount(stats.positive)}</Text>
              <Text style={styles.sep}> | </Text>
              <Text style={{ color: amountColor(stats.negative) }}>{formatAmount(stats.negative)}</Text>
            </Text>
          </>
        ) : (
          <Text style={styles.count}>{file.name}</Text>
        )}
      </View>
      <View style={styles.side}>
        <MenuButton onOpen={onMenu} color={colors.muted} />
        <MaterialCommunityIcons name="google-drive" size={18} color={colors.text} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  statusText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  statusHint: { color: colors.muted, fontSize: 13 },
  error: { color: colors.red, fontSize: 14 },
  connect: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  connectText: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  progress: { gap: 6 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.card, overflow: 'hidden' },
  bar: { height: 6, backgroundColor: colors.accent },
  list: { paddingHorizontal: 6, paddingBottom: 24 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontSize: 16 },
  spinner: { marginTop: 40 },
  row: {
    backgroundColor: colors.card,
    borderRadius: 3,
    marginBottom: 4,
    paddingLeft: 14,
    paddingVertical: 8,
    flexDirection: 'row',
  },
  rowBody: { flex: 1, gap: 2 },
  when: { color: colors.text, fontSize: 16, fontWeight: '700' },
  counts: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { color: colors.text, fontSize: 16 },
  gap: { marginLeft: 12 },
  totals: { fontSize: 16 },
  sep: { color: colors.muted },
  side: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
});
