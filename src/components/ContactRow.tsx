import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type ComponentRef, memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../format';
import { balanceOf, lastCommentOf } from '../store';
import { amountColor, colors } from '../theme';
import type { Contact } from '../types';

type Props = {
  contact: Contact;
  onPress: (id: string) => void;
  onMenu: (id: string, anchor: { x: number; y: number; height: number }) => void;
};

export const ContactRow = memo(function ContactRow({ contact, onPress, onMenu }: Props) {
  const dotsRef = useRef<ComponentRef<typeof View>>(null);
  const balance = balanceOf(contact);
  const comment = lastCommentOf(contact);

  const openMenu = () =>
    dotsRef.current?.measureInWindow((x, y, _w, height) => onMenu(contact.id, { x, y, height }));

  return (
    <Pressable
      style={styles.row}
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
      onPress={() => onPress(contact.id)}
      onLongPress={openMenu}
    >
      <View style={styles.texts}>
        <Text style={styles.name} numberOfLines={1}>
          {contact.name}
        </Text>
        {comment ? (
          <Text style={styles.comment} numberOfLines={1}>
            {comment}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.amount, { color: amountColor(balance) }]}>{formatAmount(balance)}</Text>
      <Pressable ref={dotsRef} onPress={openMenu} hitSlop={10} style={styles.dots}>
        <MaterialCommunityIcons name="dots-vertical" size={24} color={colors.text} />
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: 3,
    marginHorizontal: 6,
    marginBottom: 7,
    minHeight: 64,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  texts: { flex: 1, paddingVertical: 10 },
  name: { color: colors.text, fontSize: 19 },
  comment: { color: colors.muted, fontSize: 15, fontStyle: 'italic', marginTop: 2 },
  amount: { fontSize: 19, fontWeight: '700', marginLeft: 10 },
  dots: { paddingHorizontal: 10, paddingVertical: 18 },
});
