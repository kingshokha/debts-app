import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { colors } from '../theme';
import type { Contact, Group } from '../types';
import { Dialog, DialogButton, dialogStyles } from './Dialog';
import { GroupSelect } from './GroupSelect';

type Props = {
  contact: Contact | null;
  groups: Group[];
  onClose: () => void;
  onCreateGroup: (name: string) => string;
  onSubmit: (contactId: string, groupId: string | null) => void;
};

/** «Изменить группу» из меню контакта: выбор чипа сразу сохраняет и закрывает окно. */
export function ContactGroupDialog({ contact, groups, onClose, onCreateGroup, onSubmit }: Props) {
  if (!contact) return null;

  return (
    <Dialog visible onClose={onClose} title="Группа контакта">
      <Text style={styles.name} numberOfLines={1}>
        {contact.name}
      </Text>
      <View style={dialogStyles.divider} />
      <GroupSelect
        groups={groups}
        value={contact.groupId ?? null}
        onCreate={onCreateGroup}
        onChange={(groupId) => {
          onSubmit(contact.id, groupId);
          onClose();
        }}
      />
      <View style={[dialogStyles.buttons, { justifyContent: 'flex-end' }]}>
        <DialogButton label="ЗАКРЫТЬ" color={colors.teal} onPress={onClose} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 15 },
});
