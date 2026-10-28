import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { notify } from '../confirm';
import { type PhotoSource, pickImages } from '../photos';
import { colors } from '../theme';
import { PhotoViewer } from './PhotoViewer';

type Props = {
  label: string;
  photos: string[];
  onChange: (photos: string[]) => void;
  /** Сколько фото можно добавить; когда лимит достигнут, кнопки добавления скрываются. */
  limit?: number;
  /** Квадратная обрезка (для фото контакта); выбор из галереи тогда по одному. */
  crop?: boolean;
};

const SOURCES: { source: PhotoSource; label: string; icon: 'camera' | 'image-multiple' }[] = [
  { source: 'camera', label: 'Камера', icon: 'camera' },
  { source: 'library', label: 'Галерея', icon: 'image-multiple' },
];

/** Миниатюры с удалением и кнопки «Камера» / «Галерея». Новые снимки — временные, их сохраняет persistPhotos. */
export function PhotoAttachments({ label, photos, onChange, limit = Infinity, crop = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  const add = async (source: PhotoSource) => {
    setBusy(true);
    try {
      const picked = await pickImages(source, { crop, multiple: limit > 1 });
      if (picked === 'denied') notify('Нет доступа к камере', 'Разрешите приложению доступ к камере в настройках телефона.');
      else if (picked.length) onChange([...photos, ...picked].slice(0, limit));
    } catch (e) {
      console.warn(e);
      notify('Не удалось получить фото', source === 'camera' ? 'Камера недоступна.' : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {photos.map((uri, i) => (
          // Ключ по индексу: в вебе одна и та же картинка даёт одинаковый data:-uri
          <Pressable key={i} onPress={() => setViewIndex(i)}>
            <Image source={{ uri }} style={[styles.thumb, crop && styles.round]} />
            <Pressable
              style={styles.remove}
              hitSlop={6}
              onPress={() => onChange(photos.filter((_, j) => j !== i))}
              accessibilityLabel="Убрать фото"
            >
              <MaterialCommunityIcons name="close" size={14} color="#fff" />
            </Pressable>
          </Pressable>
        ))}
        {busy ? (
          <View style={styles.tile}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : photos.length < limit ? (
          SOURCES.map(({ source, label: text, icon }) => (
            <Pressable key={source} style={styles.tile} onPress={() => add(source)}>
              <MaterialCommunityIcons name={icon} size={24} color={colors.accent} />
              <Text style={styles.tileText}>{text}</Text>
            </Pressable>
          ))
        ) : null}
      </ScrollView>
      <PhotoViewer photos={photos} index={viewIndex} onClose={() => setViewIndex(null)} />
    </View>
  );
}

const THUMB = 60;

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 13, marginTop: 18, marginBottom: 2 },
  strip: { gap: 8, paddingTop: 6, paddingRight: 6 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 4, backgroundColor: colors.bg },
  round: { borderRadius: THUMB / 2 },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    width: THUMB,
    height: THUMB,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.divider,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tileText: { color: colors.muted, fontSize: 11 },
});
