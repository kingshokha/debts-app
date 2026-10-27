import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { confirmAction, notify } from '../confirm';
import { type Backup, parseBackup } from '../store';
import { colors } from '../theme';
import type { Contact, Group } from '../types';
import { Dialog, DialogButton, dialogStyles } from './Dialog';

type Props = {
  visible: boolean;
  contacts: Contact[];
  groups: Group[];
  onClose: () => void;
  onImport: (backup: Backup) => void;
};

/** Меню «☰»: резервная копия через «Поделиться» и восстановление из вставленного текста. */
export function BackupDialog({ visible, contacts, groups, onClose, onImport }: Props) {
  const [importMode, setImportMode] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) {
      setImportMode(false);
      setText('');
    }
  }, [visible]);

  const exportData = async () => {
    onClose();
    await Share.share({ message: JSON.stringify({ app: 'debts', version: 2, contacts, groups }) });
  };

  const importData = () => {
    const parsed = parseBackup(text);
    if (!parsed) {
      notify('Ошибка', 'Не удалось прочитать данные. Вставьте текст резервной копии целиком.');
      return;
    }
    confirmAction(
      'Заменить все данные?',
      `Текущие контакты (${contacts.length}) будут заменены на ${parsed.contacts.length} из копии.`,
      'Заменить',
      () => {
        onImport(parsed);
        onClose();
      },
      true,
    );
  };

  return (
    <Dialog visible={visible} onClose={onClose} title={importMode ? 'Импорт данных' : 'Резервная копия'}>
      {importMode ? (
        <>
          <TextInput
            style={[dialogStyles.input, styles.importInput]}
            value={text}
            onChangeText={setText}
            placeholder="Вставьте сюда текст резервной копии"
            placeholderTextColor={colors.muted}
            multiline
            autoFocus
          />
          <View style={dialogStyles.buttons}>
            <DialogButton label="НАЗАД" color={colors.teal} onPress={() => setImportMode(false)} />
            <DialogButton label="ИМПОРТ" color={colors.green} onPress={importData} disabled={!text.trim()} />
          </View>
        </>
      ) : (
        <>
          <Pressable style={styles.item} onPress={exportData}>
            <Text style={styles.text}>Экспорт (поделиться)</Text>
            <Text style={styles.hint}>Отправьте копию себе в Telegram или сохраните в заметки</Text>
          </Pressable>
          <Pressable style={styles.item} onPress={() => setImportMode(true)}>
            <Text style={styles.text}>Импорт из текста</Text>
            <Text style={styles.hint}>Восстановить данные из ранее сохранённой копии</Text>
          </Pressable>
        </>
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  item: { paddingVertical: 12 },
  text: { color: colors.text, fontSize: 17 },
  hint: { color: colors.muted, fontSize: 13, marginTop: 2 },
  importInput: { fontSize: 13, maxHeight: 220, minHeight: 100, textAlignVertical: 'top' },
});
