import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { type Backup, parseBackup } from '../backup';
import { confirmAction, notify } from '../confirm';
import { colors } from '../theme';
import { TextInput } from '../ui/Text';
import { Dialog, DialogButton, dialogStyles } from './Dialog';

type Props = {
  visible: boolean;
  /** Сколько контактов сейчас — для предупреждения о замене. */
  contactsCount: number;
  onClose: () => void;
  onImport: (backup: Backup) => void;
};

/**
 * Восстановление из текста копии, которую раньше отправили через «Экспорт (поделиться)».
 * Поле сбрасывается за счёт нового `key` при каждом открытии.
 */
export function TextImportDialog({ visible, contactsCount, onClose, onImport }: Props) {
  const [text, setText] = useState('');

  const importData = () => {
    const parsed = parseBackup(text);
    if (!parsed) {
      notify('Ошибка', 'Не удалось прочитать данные. Вставьте текст резервной копии целиком.');
      return;
    }
    confirmAction(
      'Заменить все данные?',
      `Текущие контакты (${contactsCount}) будут заменены на ${parsed.contacts.length} из копии.`,
      'Заменить',
      () => {
        onImport(parsed);
        onClose();
      },
      true,
    );
  };

  return (
    <Dialog visible={visible} onClose={onClose} title="Импорт из текста">
      <TextInput
        style={[dialogStyles.input, styles.input]}
        value={text}
        onChangeText={setText}
        placeholder="Вставьте сюда текст резервной копии"
        placeholderTextColor={colors.muted}
        multiline
        autoFocus
      />
      <View style={dialogStyles.buttons}>
        <DialogButton label="ОТМЕНА" color={colors.teal} onPress={onClose} />
        <DialogButton label="ИМПОРТ" color={colors.green} onPress={importData} disabled={!text.trim()} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 13, maxHeight: 220, minHeight: 100, textAlignVertical: 'top' },
});
