import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { colors } from '../theme';
import type { Contact } from '../types';
import { Dialog, DialogButton, dialogStyles } from './Dialog';

type Props = {
  contact: Contact | null;
  onClose: () => void;
  onSubmit: (contactId: string, name: string) => void;
};

export function RenameDialog({ contact, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (contact) setName(contact.name);
  }, [contact?.id]);

  if (!contact) return null;
  const valid = name.trim().length > 0;

  return (
    <Dialog visible onClose={onClose} title="Переименовать">
      <TextInput
        style={[dialogStyles.input, { borderBottomColor: colors.accent }]}
        value={name}
        onChangeText={setName}
        autoFocus
        selectionColor={colors.accent}
        cursorColor={colors.accent}
      />
      <View style={dialogStyles.buttons}>
        <DialogButton label="ОТМЕНА" color={colors.teal} onPress={onClose} />
        <DialogButton
          label="СОХРАНИТЬ"
          color={colors.green}
          disabled={!valid}
          onPress={() => {
            onSubmit(contact.id, name);
            onClose();
          }}
        />
      </View>
    </Dialog>
  );
}
