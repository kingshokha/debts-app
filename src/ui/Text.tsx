import { useContext } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  StyleSheet,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { FontScaleContext } from '../settings';

// Обёртки над Text и TextInput: размер шрифта из стилей умножается на масштаб из настроек.
// Во всём приложении текст импортируется отсюда, а не из react-native.

function scaled(style: StyleProp<TextStyle>, scale: number): StyleProp<TextStyle> {
  if (scale === 1) return style;
  const flat = StyleSheet.flatten(style);
  // Без fontSize не трогаем: вложенный текст должен наследовать размер родителя
  if (!flat?.fontSize && !flat?.lineHeight) return style;
  return [
    style,
    {
      ...(flat.fontSize ? { fontSize: flat.fontSize * scale } : {}),
      ...(flat.lineHeight ? { lineHeight: flat.lineHeight * scale } : {}),
    },
  ];
}

export function Text({ style, ...rest }: TextProps) {
  const scale = useContext(FontScaleContext);
  return <RNText {...rest} style={scaled(style, scale)} />;
}

export function TextInput({ style, ...rest }: TextInputProps) {
  const scale = useContext(FontScaleContext);
  return <RNTextInput {...rest} style={scaled(style, scale)} />;
}
