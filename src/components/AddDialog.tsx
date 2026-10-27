import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { evalExpression, withCurrentTime } from '../format';
import { colors } from '../theme';
import type { Contact } from '../types';
import { AmountFields } from './AmountFields';
import { Dialog, DialogButton, dialogStyles } from './Dialog';

type Props = {
  visible: boolean;
  contacts: Contact[];
  suggestions: string[];
  onClose: () => void;
  onSubmit: (name: string, amount: number, date: number, comment: string) => void;
};

export function AddDialog({ visible, contacts, suggestions, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(new Date());
  const [comment, setComment] = useState('');
  const [nameFocused, setNameFocused] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setAmountText('');
      setDate(new Date());
      setComment('');
    }
  }, [visible]);

  const amount = evalExpression(amountText);
  const valid = name.trim().length > 0 && amount !== null && amount > 0;

  // Подсказки существующих контактов, чтобы не плодить дубли
  const matches = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (q.length < 2) return [];
    return contacts.filter((c) => c.name.toLowerCase().includes(q) && c.name.toLowerCase() !== q).slice(0, 4);
  }, [name, contacts]);

  const submit = (sign: 1 | -1) => {
    if (!valid) return;
    onSubmit(name, sign * amount!, withCurrentTime(date), comment.trim());
    onClose();
  };

  return (
    <Dialog visible={visible} onClose={onClose} title="Добавление">
      <TextInput
        style={[dialogStyles.input, nameFocused && { borderBottomColor: colors.accent }]}
        value={name}
        onChangeText={setName}
        placeholder="Имя контакта"
        placeholderTextColor={colors.muted}
        autoFocus
        onFocus={() => setNameFocused(true)}
        onBlur={() => setNameFocused(false)}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
      />
      {nameFocused && matches.length ? (
        <View style={styles.matches}>
          {matches.map((c) => (
            <Pressable key={c.id} style={styles.match} onPress={() => setName(c.name)}>
              <Text style={styles.matchText} numberOfLines={1}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ height: 24 }} />
      <AmountFields
        amountText={amountText}
        onAmountText={setAmountText}
        date={date}
        onDate={setDate}
        comment={comment}
        onComment={setComment}
        suggestions={suggestions}
      />

      <View style={dialogStyles.buttons}>
        <DialogButton label="ОТМЕНА" color={colors.teal} onPress={onClose} />
        <View style={styles.right}>
          <DialogButton label="МИНУС" color={colors.red} onPress={() => submit(-1)} disabled={!valid} />
          <DialogButton label="ПЛЮС" color={colors.green} onPress={() => submit(1)} disabled={!valid} />
        </View>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  right: { flexDirection: 'row', gap: 24 },
  matches: { backgroundColor: '#383838', borderRadius: 4, marginTop: 4 },
  match: { paddingVertical: 10, paddingHorizontal: 12 },
  matchText: { color: colors.text, fontSize: 15 },
});
