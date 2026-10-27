import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { notify } from '../confirm';
import { persistPhotos } from '../photos';
import { colors } from '../theme';
import type { Contact } from '../types';
import { Dialog, DialogButton, dialogStyles } from './Dialog';
import { PhotoAttachments } from './PhotoAttachments';

type Props = {
  contact: Contact | null;
  onClose: () => void;
  onSubmit: (contactId: string, passport: string[]) => void;
};

/** «Фото паспорта» из меню контакта: добавить или убрать страницы. */
export function PassportDialog({ contact, ...rest }: Props) {
  return contact ? <PassportForm key={contact.id} contact={contact} {...rest} /> : null;
}

function PassportForm({ contact, onClose, onSubmit }: Props & { contact: Contact }) {
  const [photos, setPhotos] = useState(contact.passport ?? []);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      onSubmit(contact.id, await persistPhotos(photos));
      onClose();
    } catch (e) {
      console.warn(e);
      notify('Не удалось сохранить фото');
      setSaving(false);
    }
  };

  return (
    <Dialog visible onClose={onClose} title="Паспорт">
      <Text style={styles.name} numberOfLines={1}>
        {contact.name}
      </Text>
      <PhotoAttachments label="Фото страниц" photos={photos} onChange={setPhotos} />
      <View style={[dialogStyles.buttons, { justifyContent: 'flex-end', gap: 16 }]}>
        <DialogButton label="ОТМЕНА" color={colors.teal} onPress={onClose} />
        <DialogButton label="СОХРАНИТЬ" color={colors.green} onPress={save} disabled={saving} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 15 },
});
