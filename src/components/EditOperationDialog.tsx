import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { evalExpression, formatAmount, withTimeOf } from '../format';
import { colors } from '../theme';
import type { Contact, Operation } from '../types';
import { AmountFields } from './AmountFields';
import { Dialog, DialogButton, dialogStyles } from './Dialog';
import { PhotoAttachments, usePhotoDraft } from './PhotoAttachments';

type Props = {
  contact: Contact;
  operation: Operation | null;
  suggestions: string[];
  onClose: () => void;
  onSubmit: (contactId: string, opId: string, patch: Omit<Operation, 'id'>) => void;
};

// Форма монтируется заново при каждом открытии и берёт начальные значения из операции
export function EditOperationDialog({ operation, ...rest }: Props) {
  return operation ? <EditOperationForm key={operation.id} operation={operation} {...rest} /> : null;
}

function EditOperationForm({ contact, operation, suggestions, onClose, onSubmit }: Props & { operation: Operation }) {
  const [amountText, setAmountText] = useState(() => formatAmount(Math.abs(operation.amount), false).replace(/\s/g, ''));
  const [date, setDate] = useState(() => new Date(operation.date));
  const [comment, setComment] = useState(operation.comment);
  const [sign, setSign] = useState<1 | -1>(operation.amount < 0 ? -1 : 1);
  const draft = usePhotoDraft(operation.photos);

  const amount = evalExpression(amountText);
  const valid = amount !== null && amount > 0;

  const save = () => {
    if (!valid) return;
    draft.commit((photos) => {
      onSubmit(contact.id, operation.id, {
        amount: sign * amount!,
        date: withTimeOf(date, operation.date),
        comment: comment.trim(),
        photos,
      });
      onClose();
    });
  };

  return (
    <Dialog visible onClose={onClose} title="Редактирование">
      <Text style={styles.name} numberOfLines={1}>
        {contact.name}
      </Text>
      <View style={dialogStyles.divider} />

      <AmountFields
        amountText={amountText}
        onAmountText={setAmountText}
        date={date}
        onDate={setDate}
        comment={comment}
        onComment={setComment}
        suggestions={suggestions}
        autoFocusAmount
      />
      <PhotoAttachments photos={draft.photos} onChange={draft.setPhotos} />

      <View style={styles.radios}>
        <Radio label="Минус" color={colors.red} selected={sign === -1} onPress={() => setSign(-1)} />
        <Radio label="Плюс" color={colors.green} selected={sign === 1} onPress={() => setSign(1)} />
      </View>

      <View style={[dialogStyles.buttons, { justifyContent: 'flex-end', gap: 16 }]}>
        <DialogButton label="ОТМЕНА" color={colors.teal} onPress={onClose} />
        <DialogButton label="СОХРАНИТЬ" color={colors.teal} onPress={save} disabled={!valid || draft.saving} />
      </View>
    </Dialog>
  );
}

function Radio({ label, color, selected, onPress }: { label: string; color: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.radio} onPress={onPress} hitSlop={8}>
      <MaterialCommunityIcons
        name={selected ? 'radiobox-marked' : 'radiobox-blank'}
        size={26}
        color={selected ? colors.accent : colors.muted}
      />
      <Text style={[styles.radioLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 15 },
  radios: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioLabel: { fontSize: 16, fontWeight: '600' },
});
