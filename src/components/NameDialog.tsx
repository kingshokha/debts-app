import { useState } from 'react';
import { View } from 'react-native';
import { TextInput } from '../ui/Text';
import { colors } from '../theme';
import { Dialog, DialogButton, dialogStyles } from './Dialog';

type Props = {
  title: string;
  /** Начальное значение; null — диалог закрыт. */
  initialValue: string | null;
  placeholder?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

/** Диалог ввода названия: переименование контакта, создание и переименование группы. */
export function NameDialog({ initialValue, ...rest }: Props) {
  return initialValue !== null ? <NameForm initialValue={initialValue} {...rest} /> : null;
}

function NameForm({ title, initialValue, placeholder, onClose, onSubmit }: Props & { initialValue: string }) {
  const [name, setName] = useState(initialValue);
  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    onSubmit(name.trim());
    onClose();
  };

  return (
    <Dialog visible onClose={onClose} title={title}>
      <TextInput
        style={[dialogStyles.input, { borderBottomColor: colors.accent }]}
        value={name}
        onChangeText={setName}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoFocus
        onSubmitEditing={save}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
      />
      <View style={dialogStyles.buttons}>
        <DialogButton label="ОТМЕНА" color={colors.teal} onPress={onClose} />
        <DialogButton label="СОХРАНИТЬ" color={colors.green} disabled={!valid} onPress={save} />
      </View>
    </Dialog>
  );
}
