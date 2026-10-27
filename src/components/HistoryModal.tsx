import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type ComponentRef, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confirmAction } from '../confirm';
import { formatAmount, formatDate, formatTime } from '../format';
import { balanceOf } from '../store';
import { amountColor, colors } from '../theme';
import type { Contact, Operation } from '../types';
import { EditOperationDialog } from './EditOperationDialog';
import { type Anchor, PopupMenu } from './PopupMenu';

type OpAction = 'edit' | 'delete';

const OP_MENU: { action: OpAction; label: string }[] = [
  { action: 'edit', label: 'Редактировать' },
  { action: 'delete', label: 'Удалить' },
];

type Props = {
  contact: Contact | null;
  suggestions: string[];
  onClose: () => void;
  onDeleteOperation: (contactId: string, opId: string) => void;
  onUpdateOperation: (contactId: string, opId: string, patch: Omit<Operation, 'id'>) => void;
};

export function HistoryModal({ contact, suggestions, onClose, onDeleteOperation, onUpdateOperation }: Props) {
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState<{ opId: string; anchor: Anchor } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  // Новые сверху, с остатком после каждой операции
  const rows = useMemo(() => {
    if (!contact) return [];
    let running = 0;
    const withBalance = contact.operations.map((op) => {
      running = Math.round((running + op.amount) * 100) / 100;
      return { ...op, after: running };
    });
    return withBalance.reverse();
  }, [contact]);

  if (!contact) return null;
  const balance = balanceOf(contact);
  const findOp = (id: string | null) => contact.operations.find((op) => op.id === id) ?? null;

  const onMenuAction = (action: OpAction) => {
    const op = findOp(menu?.opId ?? null);
    if (!op) return;
    if (action === 'edit') return setEditId(op.id);
    confirmAction(
      'Удалить операцию?',
      `${formatAmount(op.amount)} будет убрано из истории, баланс пересчитается.`,
      'Удалить',
      () => onDeleteOperation(contact.id, op.id),
      true,
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.back}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {contact.name}
            </Text>
            <Text style={styles.subtitle}>История операций</Text>
          </View>
          <Text style={[styles.balance, { color: amountColor(balance) }]}>{formatAmount(balance)}</Text>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(op) => op.id}
          contentContainerStyle={{ padding: 8 }}
          ListEmptyComponent={<Text style={styles.empty}>Операций нет</Text>}
          renderItem={({ item }) => (
            <HistoryRow op={item} after={item.after} onMenu={(anchor) => setMenu({ opId: item.id, anchor })} />
          )}
        />
      </View>

      <PopupMenu items={OP_MENU} anchor={menu?.anchor ?? null} onSelect={onMenuAction} onClose={() => setMenu(null)} />
      <EditOperationDialog
        contact={contact}
        operation={findOp(editId)}
        suggestions={suggestions}
        onClose={() => setEditId(null)}
        onSubmit={onUpdateOperation}
      />
    </Modal>
  );
}

function HistoryRow({ op, after, onMenu }: { op: Operation; after: number; onMenu: (anchor: Anchor) => void }) {
  const dotsRef = useRef<ComponentRef<typeof View>>(null);
  const openMenu = () => dotsRef.current?.measureInWindow((x, y, _w, height) => onMenu({ x, y, height }));

  return (
    <Pressable style={styles.row} android_ripple={{ color: 'rgba(255,255,255,0.08)' }} onLongPress={openMenu}>
      <View style={{ flex: 1 }}>
        <Text style={styles.date}>
          {formatDate(op.date)}, {formatTime(op.date)}
        </Text>
        {op.comment ? <Text style={styles.comment}>{op.comment}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.amount, { color: amountColor(op.amount) }]}>{formatAmount(op.amount)}</Text>
        <Text style={styles.after}>итого {formatAmount(after)}</Text>
      </View>
      <Pressable ref={dotsRef} onPress={openMenu} hitSlop={10} style={styles.dots} testID="op-dots">
        <MaterialCommunityIcons name="dots-vertical" size={24} color={colors.text} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.header, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 12 },
  back: { padding: 4 },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 10 },
  subtitle: { color: colors.muted, fontSize: 13 },
  balance: { fontSize: 18, fontWeight: '700', marginTop: 10 },
  row: { backgroundColor: colors.card, borderRadius: 3, paddingLeft: 14, paddingVertical: 14, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { color: colors.muted, fontSize: 13 },
  comment: { color: colors.text, fontSize: 16, marginTop: 4 },
  amount: { fontSize: 18, fontWeight: '700' },
  after: { color: colors.muted, fontSize: 12, marginTop: 4 },
  dots: { paddingHorizontal: 6, paddingVertical: 8 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
