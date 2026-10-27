import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notify } from '../confirm';
import { type PhotoSource, persistPhotos, pickImages } from '../photos';
import { colors } from '../theme';
import { PhotoViewer } from './PhotoViewer';

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
};

const SOURCES: { source: PhotoSource; label: string; icon: 'camera' | 'image-multiple' }[] = [
  { source: 'camera', label: 'Камера', icon: 'camera' },
  { source: 'library', label: 'Галерея', icon: 'image-multiple' },
];

/** Фото к операции: миниатюры с удалением и кнопки «Камера» / «Галерея». */
export function PhotoAttachments({ photos, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  const add = async (source: PhotoSource) => {
    setBusy(true);
    try {
      const picked = await pickImages(source, { multiple: true });
      if (picked === 'denied') notify('Нет доступа к камере', 'Разрешите приложению доступ к камере в настройках телефона.');
      else if (picked.length) onChange([...photos, ...picked]);
    } catch (e) {
      console.warn(e);
      notify('Не удалось получить фото', source === 'camera' ? 'Камера недоступна.' : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {photos.map((uri, i) => (
          // Ключ по индексу: в вебе одна и та же картинка даёт одинаковый data:-uri
          <Pressable key={i} onPress={() => setViewIndex(i)}>
            <Image source={{ uri }} style={styles.thumb} />
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
        ) : (
          SOURCES.map(({ source, label, icon }) => (
            <Pressable key={source} style={styles.tile} onPress={() => add(source)}>
              <MaterialCommunityIcons name={icon} size={24} color={colors.accent} />
              <Text style={styles.tileText}>{label}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
      <PhotoViewer photos={photos} index={viewIndex} onClose={() => setViewIndex(null)} />
    </View>
  );
}

/**
 * Черновик фото в диалоге. commit копирует новые снимки в папку приложения
 * и передаёт итоговый список в onSaved; повторные нажатия, пока идёт сохранение, игнорируются.
 */
export function usePhotoDraft(initial: string[] = []) {
  const [photos, setPhotos] = useState(initial);
  const [saving, setSaving] = useState(false);

  const commit = async (onSaved: (photos: string[]) => void) => {
    if (saving) return;
    setSaving(true);
    try {
      onSaved(await persistPhotos(photos));
    } catch (e) {
      console.warn(e);
      notify('Не удалось сохранить фото');
      setSaving(false);
    }
  };

  return { photos, setPhotos, saving, commit };
}

const THUMB = 60;

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  strip: { gap: 8, paddingTop: 6, paddingRight: 6 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 4, backgroundColor: colors.bg },
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
