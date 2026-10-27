import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAmount, parseAmount, withCurrentTime } from '../format';
import { balanceOf } from '../store';
import { amountColor, colors } from '../theme';
import type { Contact } from '../types';
import { AmountFields } from './AmountFields';
import { ContactHeader } from './ContactHeader';
import { Dialog, DialogButton, dialogStyles } from './Dialog';

type Props = {
  contact: Contact | null;
  suggestions: string[];
  onClose: () => void;
  onSubmit: (contactId: string, amount: number, date: number, comment: string) => void;
  onHistory: (contactId: string) => void;
};

// Форма монтируется заново при каждом открытии, поэтому поля всегда начинаются пустыми
export function BalanceDialog({ contact, ...rest }: Props) {
  return contact ? <BalanceForm key={contact.id} contact={contact} {...rest} /> : null;
}

function BalanceForm({ contact, suggestions, onClose, onSubmit, onHistory }: Props & { contact: Contact }) {
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [comment, setComment] = useState('');

  const balance = balanceOf(contact);
  const amount = parseAmount(amountText);
  const valid = amount !== null && amount > 0;
  const delta = valid ? amount! : 0;
  const ifMinus = balance - delta;
  const ifPlus = balance + delta;

  const submit = (sign: 1 | -1) => {
    if (!valid) return;
    onSubmit(contact.id, sign * amount!, withCurrentTime(date), comment.trim());
    onClose();
  };

  return (
    <Dialog visible onClose={onClose} title="Изменение баланса">
      <ContactHeader contact={contact} />
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

      <View style={styles.actions}>
        <DialogButton label="МИНУС" color={colors.red} onPress={() => submit(-1)} disabled={!valid} />
        <DialogButton label="ПЛЮС" color={colors.green} onPress={() => submit(1)} disabled={!valid} />
      </View>
      <View style={styles.preview}>
        <Text style={[styles.previewValue, { color: amountColor(ifMinus) }]}>{formatAmount(ifMinus)}</Text>
        <Text style={styles.previewLabel}>←  будет  →</Text>
        <Text style={[styles.previewValue, { color: amountColor(ifPlus) }]}>{formatAmount(ifPlus)}</Text>
      </View>

      <View style={dialogStyles.divider} />
      <Pressable
        style={styles.history}
        android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
        onPress={() => {
          onClose();
          onHistory(contact.id);
        }}
      >
        <Text style={styles.historyText}>ИСТОРИЯ ОПЕРАЦИЙ</Text>
      </Pressable>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  preview: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 4 },
  previewValue: { fontSize: 14, minWidth: 80, textAlign: 'center' },
  previewLabel: { color: colors.muted, fontSize: 14 },
  history: { alignItems: 'center', paddingVertical: 10 },
  historyText: { color: colors.muted, fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
});
