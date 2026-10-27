import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text } from 'react-native';
import type { PhotoSource } from '../photos';
import { colors } from '../theme';
import type { Contact } from '../types';
import { Dialog } from './Dialog';

type Props = {
  contact: Contact | null;
  onClose: () => void;
  /** Получает фото из камеры/галереи; диалог ждёт результата и закрывается сам. */
  onPick: (contactId: string, source: PhotoSource) => Promise<void>;
  onRemove: (contact: Contact) => void;
};

const SOURCES: { source: PhotoSource; label: string; icon: 'camera' | 'image-multiple' }[] = [
  { source: 'camera', label: 'Сделать снимок', icon: 'camera' },
  { source: 'library', label: 'Выбрать из галереи', icon: 'image-multiple' },
];

/** Просмотр фото контакта и выбор источника: камера или галерея. */
export function PhotoDialog({ contact, onClose, onPick, onRemove }: Props) {
  const [busy, setBusy] = useState(false);
  if (!contact) return null;

  // Диалог остаётся открытым, пока открыт пикер: на iOS пикер не показывается поверх закрывающегося Modal
  const pick = async (source: PhotoSource) => {
    setBusy(true);
    try {
      await onPick(contact.id, source);
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    // Закрытие не блокируем: в браузере отмена выбора файла может не прийти, и спиннер завис бы
    <Dialog visible onClose={onClose} title={contact.name}>
      {contact.photo ? <Image source={{ uri: contact.photo }} style={styles.photo} /> : null}
      {busy ? (
        <ActivityIndicator color={colors.accent} style={styles.busy} />
      ) : (
        <>
          {SOURCES.map(({ source, label, icon }) => (
            <Pressable key={source} style={styles.item} onPress={() => pick(source)}>
              <MaterialCommunityIcons name={icon} size={24} color={colors.accent} />
              <Text style={styles.itemText}>{label}</Text>
            </Pressable>
          ))}
          {contact.photo ? (
            <Pressable
              style={styles.item}
              onPress={() => {
                onClose();
                onRemove(contact);
              }}
            >
              <MaterialCommunityIcons name="delete-outline" size={24} color={colors.red} />
              <Text style={[styles.itemText, { color: colors.red }]}>Удалить фото</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 1, borderRadius: 4, marginBottom: 8, backgroundColor: colors.bg },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 },
  itemText: { color: colors.text, fontSize: 17 },
  busy: { paddingVertical: 24 },
});
