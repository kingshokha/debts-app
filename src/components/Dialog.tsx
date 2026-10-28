import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function Dialog({ visible, onClose, title, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.box}>
          {/* Прокрутка нужна высоким формам на маленьких экранах */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type ButtonProps = { label: string; color: string; onPress: () => void; disabled?: boolean };

export function DialogButton({ label, color, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
      style={[styles.button, disabled && { opacity: 0.4 }]}
    >
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export const dialogStyles = StyleSheet.create({
  buttons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: 12 },
  input: {
    color: colors.text,
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
    paddingVertical: 6,
    outlineWidth: 0, // убирает рамку фокуса в веб-версии
  },
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', padding: 24 },
  box: { backgroundColor: colors.dialog, borderRadius: 4, elevation: 12, maxHeight: '100%' },
  scroll: { flexGrow: 0 },
  content: { padding: 24, paddingBottom: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: 16 },
  button: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 2 },
  buttonText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
});
