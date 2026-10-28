import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type ComponentRef, useRef } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../ui/Text';
import { colors } from '../theme';

export type Anchor = { x: number; y: number; height: number };

const ITEM_HEIGHT = 52;

type Props<T extends string> = {
  items: { action: T; label: string }[];
  /** Позиция кнопки «⋮» на экране; null — меню закрыто. */
  anchor: Anchor | null;
  onSelect: (action: T) => void;
  onClose: () => void;
  /** К какому краю экрана прижать меню: «⋮» справа, «☰» слева. */
  align?: 'left' | 'right';
};

export function PopupMenu<T extends string>({ items, anchor, onSelect, onClose, align = 'right' }: Props<T>) {
  const { height: winHeight } = useWindowDimensions();
  if (!anchor) return null;

  // Открываем под кнопкой, а если не влезает — над ней
  const menuHeight = items.length * ITEM_HEIGHT + 16;
  let top = anchor.y + anchor.height - 8;
  if (top + menuHeight > winHeight - 16) top = Math.max(16, anchor.y - menuHeight + 8);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.menu, align === 'left' ? styles.left : styles.right, { top }]}>
        {items.map((item) => (
          <Pressable
            key={item.action}
            style={styles.item}
            android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
            onPress={() => {
              onClose();
              onSelect(item.action);
            }}
          >
            <Text style={styles.text}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

/** Кнопка-иконка, которая открывает меню прямо под собой. */
export function MenuButton({
  onOpen,
  icon = 'dots-vertical',
  color = colors.text,
  size = 24,
  style,
}: {
  onOpen: (anchor: Anchor) => void;
  icon?: 'dots-vertical' | 'menu';
  color?: string;
  size?: number;
  style?: object;
}) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  return (
    <Pressable
      ref={ref}
      hitSlop={10}
      style={style}
      onPress={() => ref.current?.measureInWindow((x, y, _w, height) => onOpen({ x, y, height }))}
    >
      <MaterialCommunityIcons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    minWidth: 230,
    backgroundColor: '#3a3a3a',
    paddingVertical: 8,
    elevation: 10,
    borderRadius: 2,
  },
  left: { left: 8 },
  right: { right: 8 },
  item: { height: ITEM_HEIGHT, justifyContent: 'center', paddingHorizontal: 22 },
  text: { color: colors.text, fontSize: 17 },
});
