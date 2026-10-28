import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type ComponentRef, memo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { formatAmount } from '../format';
import { balanceOf, lastCommentOf } from '../store';
import { amountColor, colors } from '../theme';
import type { Contact } from '../types';

type Props = {
  contact: Contact;
  onPress: (id: string) => void;
  onMenu: (id: string, anchor: { x: number; y: number; height: number }) => void;
  onPhoto: (id: string) => void;
};

export const ContactRow = memo(function ContactRow({ contact, onPress, onMenu, onPhoto }: Props) {
  const dotsRef = useRef<ComponentRef<typeof View>>(null);
  // Фото из копии с другого устройства может не открыться — тогда просто не показываем его
  const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
  const photo = contact.photo && contact.photo !== brokenPhoto ? contact.photo : null;
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
      {photo ? (
        <Pressable onPress={() => onPhoto(contact.id)} hitSlop={6} style={styles.avatarBtn}>
          <Image source={{ uri: photo }} style={styles.avatar} onError={() => setBrokenPhoto(photo)} />
        </Pressable>
      ) : null}
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
  avatarBtn: { marginLeft: -6, marginRight: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg },
  texts: { flex: 1, paddingVertical: 10 },
  name: { color: colors.text, fontSize: 19 },
  comment: { color: colors.muted, fontSize: 15, fontStyle: 'italic', marginTop: 2 },
  amount: { fontSize: 19, fontWeight: '700', marginLeft: 10 },
  dots: { paddingHorizontal: 10, paddingVertical: 18 },
});
