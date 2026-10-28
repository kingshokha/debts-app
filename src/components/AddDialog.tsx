import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { notify } from '../confirm';
import { parseAmount, withCurrentTime } from '../format';
import { persistPhotos } from '../photos';
import { colors } from '../theme';
import type { Contact, Group } from '../types';
import { AmountFields } from './AmountFields';
import { Dialog, DialogButton, dialogStyles } from './Dialog';
import { GroupSelect } from './GroupSelect';
import { PhotoAttachments } from './PhotoAttachments';

type Props = {
  visible: boolean;
  contacts: Contact[];
  groups: Group[];
  /** Группа, выбранная по умолчанию (текущая в режиме «По группам»). */
  defaultGroupId: string | null;
  suggestions: string[];
  onClose: () => void;
  onCreateGroup: (name: string) => string;
  onSubmit: (
    name: string,
    amount: number,
    date: number,
    comment: string,
    groupId: string | null,
    photo: string | null,
    passport: string[],
  ) => void;
};

/** Поля сбрасываются за счёт нового `key` при каждом открытии (см. App). */
export function AddDialog(p: Props) {
  const { visible, contacts, suggestions, onClose } = p;
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [comment, setComment] = useState('');
  const [groupId, setGroupId] = useState(p.defaultGroupId);
  const [nameFocused, setNameFocused] = useState(false);
  const [photo, setPhoto] = useState<string[]>([]);
  const [passport, setPassport] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const amount = parseAmount(amountText);
  const valid = name.trim().length > 0 && amount !== null && amount > 0;

  // Подсказки существующих контактов, чтобы не плодить дубли
  const matches = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (q.length < 2) return [];
    return contacts.filter((c) => c.name.toLowerCase().includes(q) && c.name.toLowerCase() !== q).slice(0, 4);
  }, [name, contacts]);

  const submit = async (sign: 1 | -1) => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      // Снимки из пикера временные — переносим в папку приложения только при сохранении
      const [savedPhoto] = await persistPhotos(photo);
      const savedPassport = await persistPhotos(passport);
      p.onSubmit(name, sign * amount!, withCurrentTime(date), comment.trim(), groupId, savedPhoto ?? null, savedPassport);
      onClose();
    } catch (e) {
      console.warn(e);
      notify('Не удалось сохранить фото');
      setSaving(false);
    }
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
            <Pressable
              key={c.id}
              style={styles.match}
              onPress={() => {
                setName(c.name);
                if (c.groupId) setGroupId(c.groupId);
              }}
            >
              <Text style={styles.matchText} numberOfLines={1}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.label}>Группа</Text>
      <GroupSelect groups={p.groups} value={groupId} onChange={setGroupId} onCreate={p.onCreateGroup} />

      <PhotoAttachments label="Фото контакта" photos={photo} onChange={setPhoto} limit={1} crop />
      <PhotoAttachments label="Паспорт" photos={passport} onChange={setPassport} />

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
          <DialogButton label="МИНУС" color={colors.red} onPress={() => submit(-1)} disabled={!valid || saving} />
          <DialogButton label="ПЛЮС" color={colors.green} onPress={() => submit(1)} disabled={!valid || saving} />
        </View>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  right: { flexDirection: 'row', gap: 24 },
  label: { color: colors.muted, fontSize: 13, marginTop: 18, marginBottom: 8 },
  matches: { backgroundColor: '#383838', borderRadius: 4, marginTop: 4 },
  match: { paddingVertical: 10, paddingHorizontal: 12 },
  matchText: { color: colors.text, fontSize: 15 },
});
