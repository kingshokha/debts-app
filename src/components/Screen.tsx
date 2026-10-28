import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { Text } from '../ui/Text';

type Props = {
  onClose: () => void;
  /** Строка — обычный заголовок; узел — своя разметка (например, выбор фильтра). */
  title: ReactNode;
  /** Кнопки справа в шапке. */
  right?: ReactNode;
  children: ReactNode;
};

/** Полноэкранный раздел поверх главного экрана: шапка со стрелкой «назад» и содержимое. */
export function Screen({ onClose, title, right, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.back} accessibilityLabel="Назад">
            <MaterialCommunityIcons name="arrow-left" size={26} color="#fff" />
          </Pressable>
          <View style={styles.titleBox}>
            {typeof title === 'string' ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : (
              title
            )}
          </View>
          {right}
        </View>
        {children}
      </View>
    </Modal>
  );
}

export const screenStyles = StyleSheet.create({
  /** Иконка-кнопка в шапке. */
  headerButton: { paddingHorizontal: 8, paddingVertical: 4 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.header,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 12,
  },
  back: { padding: 4 },
  titleBox: { flex: 1 },
  title: { color: colors.accent, fontSize: 20, fontWeight: '600' },
});
