import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatAmount, formatDate, parseAmount } from '../format';
import { colors } from '../theme';
import { dialogStyles } from './Dialog';

type Props = {
  amountText: string;
  onAmountText: (s: string) => void;
  date: Date;
  onDate: (d: Date) => void;
  comment: string;
  onComment: (s: string) => void;
  suggestions: string[];
  autoFocusAmount?: boolean;
};

/** Поля «Сумма + дата» и «Комментарий» с выпадающим списком прошлых комментариев. */
export function AmountFields(p: Props) {
  // Калькулятор переключает клавиатуру на ту, где есть + - * /
  const [calcMode, setCalcMode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const value = parseAmount(p.amountText);
  const isExpression = /[-+*/×÷()]/.test(p.amountText.replace(/^\s*-/, ''));

  const pickDate = () => {
    if (Platform.OS !== 'android') return;
    DateTimePickerAndroid.open({
      value: p.date,
      mode: 'date',
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) p.onDate(selected);
      },
    });
  };

  return (
    <View>
      <View style={styles.row}>
        <Pressable onPress={() => setCalcMode((m) => !m)} hitSlop={8}>
          <MaterialCommunityIcons name="calculator" size={26} color={calcMode ? colors.accent : colors.muted} />
        </Pressable>
        <TextInput
          key={calcMode ? 'calc' : 'num'}
          style={[dialogStyles.input, styles.amount]}
          value={p.amountText}
          onChangeText={p.onAmountText}
          placeholder="Сумма"
          placeholderTextColor={colors.muted}
          keyboardType={calcMode ? 'phone-pad' : 'decimal-pad'}
          autoFocus={p.autoFocusAmount || calcMode}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
        />
        <Pressable onPress={pickDate} hitSlop={8}>
          <Text style={styles.date}>{formatDate(p.date.getTime())}</Text>
        </Pressable>
      </View>
      {isExpression ? (
        <Text style={styles.result}>= {value === null ? '?' : formatAmount(value, false)}</Text>
      ) : null}

      <View style={[styles.row, { marginTop: 20 }]}>
        <TextInput
          style={[dialogStyles.input, styles.comment]}
          value={p.comment}
          onChangeText={p.onComment}
          placeholder="Комментарий"
          placeholderTextColor={colors.muted}
          multiline
          selectionColor={colors.accent}
          cursorColor={colors.accent}
        />
        <Pressable onPress={() => setShowSuggestions((s) => !s)} hitSlop={10} disabled={!p.suggestions.length}>
          <MaterialCommunityIcons
            name={showSuggestions ? 'menu-up' : 'menu-down'}
            size={32}
            color={p.suggestions.length ? colors.muted : colors.divider}
          />
        </Pressable>
      </View>
      {showSuggestions ? (
        <ScrollView style={styles.suggestions} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {p.suggestions.map((s) => (
            <Pressable
              key={s}
              style={styles.suggestion}
              android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
              onPress={() => {
                p.onComment(s);
                setShowSuggestions(false);
              }}
            >
              <Text style={styles.suggestionText} numberOfLines={1}>
                {s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amount: { flex: 1, minWidth: 0 },
  date: { color: colors.text, fontSize: 15, flexShrink: 0 },
  result: { color: colors.muted, fontSize: 14, marginLeft: 38, marginTop: 4 },
  comment: { flex: 1, minWidth: 0, fontSize: 16, maxHeight: 110 },
  suggestions: { maxHeight: 180, marginTop: 6, backgroundColor: '#383838', borderRadius: 4 },
  suggestion: { paddingVertical: 10, paddingHorizontal: 12 },
  suggestionText: { color: colors.text, fontSize: 15 },
});
