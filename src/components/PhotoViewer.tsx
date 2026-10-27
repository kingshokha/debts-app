import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  photos: string[];
  /** С какого фото открыть; null — просмотр закрыт. */
  index: number | null;
  onClose: () => void;
};

/** Полноэкранный просмотр фото с листанием влево-вправо. */
export function PhotoViewer({ photos, index, onClose }: Props) {
  if (index === null || !photos.length) return null;
  return <ViewerScreen photos={photos} initialIndex={Math.min(index, photos.length - 1)} onClose={onClose} />;
}

function ViewerScreen({ photos, initialIndex, onClose }: { photos: string[]; initialIndex: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(initialIndex);

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.screen}>
        <FlatList
          data={photos}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height }} resizeMode="contain" />}
        />
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Закрыть">
            <MaterialCommunityIcons name="close" size={28} color="#fff" />
          </Pressable>
          {photos.length > 1 ? (
            <Text style={styles.counter}>
              {current + 1} / {photos.length}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  counter: { color: '#fff', fontSize: 16 },
});
