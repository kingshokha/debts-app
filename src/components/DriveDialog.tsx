import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirmAction, notify } from '../confirm';
import type { DriveFile } from '../drive/api';
import type { useDrive } from '../drive/useDrive';
import { formatDate, formatTime } from '../format';
import { colors } from '../theme';
import { Dialog, DialogButton, dialogStyles } from './Dialog';

type Drive = ReturnType<typeof useDrive>;

type Props = {
  visible: boolean;
  drive: Drive;
  onClose: () => void;
};

const dateTime = (ts: number) => `${formatDate(ts)}, ${formatTime(ts)}`;

/** «Google Диск» из меню «☰»: подключение, копия по кнопке, восстановление, отключение. */
export function DriveDialog({ visible, drive, onClose }: Props) {
  // null — главный экран; массив — список копий для восстановления
  const [backups, setBackups] = useState<DriveFile[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const close = () => {
    setBackups(null);
    onClose();
  };

  const openList = async () => {
    setLoadingList(true);
    try {
      setBackups(await drive.listBackups());
    } catch (e) {
      notify('Не удалось получить список копий', String((e as Error)?.message ?? e));
    } finally {
      setLoadingList(false);
    }
  };

  const restore = (file: DriveFile) =>
    confirmAction(
      'Восстановить из копии?',
      `${dateTime(Date.parse(file.createdTime))}\nВсе текущие данные будут заменены данными из этой копии.`,
      'Восстановить',
      async () => {
        setBackups(null);
        const missing = await drive.restore(file.id);
        if (missing === null) return;
        notify('Данные восстановлены', missing ? `Не нашлось фото: ${missing}.` : undefined);
        close();
      },
      true,
    );

  const disconnect = () =>
    confirmAction(
      'Отключить Google Диск?',
      'Автоматические копии прекратятся. Уже сохранённые копии останутся в папке «Долги» на Диске.',
      'Отключить',
      () => drive.disconnect(),
      true,
    );

  const busy = drive.busy !== null;

  return (
    <Dialog visible={visible} onClose={busy ? () => {} : close} title="Google Диск">
      {drive.unavailable ? (
        <Text style={styles.text}>{drive.unavailable}</Text>
      ) : drive.checking ? (
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      ) : backups ? (
        <BackupList backups={backups} onPick={restore} onBack={() => setBackups(null)} />
      ) : (
        <>
          {drive.account ? (
            <>
              <Row label="Аккаунт" value={drive.account} />
              <Row
                label="Последняя копия"
                value={drive.lastBackupAt ? dateTime(drive.lastBackupAt) : 'ещё не было'}
              />
              <Text style={styles.hint}>
                Копия делается сама раз в сутки — вместе с фото и паспортами. Все копии хранятся в папке «Долги» на Диске.
              </Text>
            </>
          ) : (
            <Text style={styles.text}>
              Подключите Google Диск, и приложение будет раз в сутки сохранять туда копию: контакты, всю историю, фото и паспорта.
              Приложение получит доступ только к своей папке «Долги», а не ко всему Диску.
            </Text>
          )}

          {drive.lastError ? <Text style={styles.error}>{drive.lastError}</Text> : null}

          {drive.busy ? (
            <View style={styles.progress}>
              <Text style={styles.hint}>{drive.busy.label}</Text>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${Math.round(drive.busy.progress * 100)}%` }]} />
              </View>
            </View>
          ) : drive.account ? (
            <View style={styles.actions}>
              <Action label="Сохранить сейчас" onPress={() => drive.backupNow()} />
              <Action label={loadingList ? 'Загрузка списка…' : 'Восстановить из копии…'} onPress={openList} disabled={loadingList} />
              <Action label="Отключить" color={colors.red} onPress={disconnect} />
            </View>
          ) : null}
        </>
      )}

      {!backups ? (
        <View style={[dialogStyles.buttons, { justifyContent: 'flex-end', gap: 16 }]}>
          <DialogButton label="ЗАКРЫТЬ" color={colors.teal} onPress={close} disabled={busy} />
          {!drive.unavailable && !drive.checking && !drive.account ? (
            <DialogButton label="ПОДКЛЮЧИТЬ" color={colors.green} onPress={() => drive.connect()} disabled={busy} />
          ) : null}
        </View>
      ) : null}
    </Dialog>
  );
}

function BackupList({ backups, onPick, onBack }: { backups: DriveFile[]; onPick: (f: DriveFile) => void; onBack: () => void }) {
  return (
    <>
      {backups.length ? (
        <ScrollView style={styles.list} nestedScrollEnabled>
          {backups.map((f, i) => (
            <Pressable key={f.id} style={styles.item} onPress={() => onPick(f)}>
              <Text style={styles.itemText}>
                {dateTime(Date.parse(f.createdTime))}
                {i === 0 ? '  · последняя' : ''}
              </Text>
              {f.size ? <Text style={styles.hint}>{Math.max(1, Math.round(Number(f.size) / 1024))} КБ</Text> : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.text}>На Диске пока нет копий.</Text>
      )}
      <View style={[dialogStyles.buttons, { justifyContent: 'flex-end' }]}>
        <DialogButton label="НАЗАД" color={colors.teal} onPress={onBack} />
      </View>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Action({ label, onPress, color, disabled }: { label: string; onPress: () => void; color?: string; disabled?: boolean }) {
  return (
    <Pressable style={styles.item} onPress={onPress} disabled={disabled}>
      <Text style={[styles.itemText, color ? { color } : null, disabled && { opacity: 0.5 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: 15, lineHeight: 21 },
  hint: { color: colors.muted, fontSize: 13, marginTop: 6, lineHeight: 18 },
  error: { color: colors.red, fontSize: 14, marginTop: 12 },
  spinner: { paddingVertical: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  label: { color: colors.muted, fontSize: 15 },
  value: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  actions: { marginTop: 8 },
  item: { paddingVertical: 12 },
  itemText: { color: colors.text, fontSize: 17 },
  list: { maxHeight: 360 },
  progress: { marginTop: 12, gap: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.bg, overflow: 'hidden' },
  bar: { height: 6, backgroundColor: colors.accent },
});
