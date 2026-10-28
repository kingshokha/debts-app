import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { colors } from '../theme';
import type { Contact } from '../types';
import { PhotoViewer } from './PhotoViewer';

/** Имя контакта с фото и миниатюрами паспорта; по нажатию фото открываются на весь экран. */
export function ContactHeader({ contact }: { contact: Contact }) {
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null);
  const passport = contact.passport ?? [];

  return (
    <View>
      <View style={styles.row}>
        {contact.photo ? (
          <Pressable onPress={() => setViewer({ photos: [contact.photo!], index: 0 })} accessibilityLabel="Фото контакта">
            <Image source={{ uri: contact.photo }} style={styles.avatar} />
          </Pressable>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>
          {contact.name}
        </Text>
      </View>
      {passport.length ? (
        <>
          <Text style={styles.label}>Паспорт</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {passport.map((uri, i) => (
              <Pressable key={i} onPress={() => setViewer({ photos: passport, index: i })} accessibilityLabel="Фото паспорта">
                <Image source={{ uri }} style={styles.page} />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
      <PhotoViewer photos={viewer?.photos ?? []} index={viewer?.index ?? null} onClose={() => setViewer(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.bg },
  name: { flex: 1, color: colors.text, fontSize: 15 },
  label: { color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 6 },
  strip: { gap: 8 },
  page: { width: 84, height: 60, borderRadius: 4, backgroundColor: colors.bg },
});
