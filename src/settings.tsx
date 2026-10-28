import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const KEY = 'debts/settings/v1';

export type FontSize = 'small' | 'normal' | 'large' | 'xlarge';

/** Масштаб шрифта относительно размеров в стилях компонентов. */
export const FONT_SIZES: { key: FontSize; label: string; scale: number }[] = [
  { key: 'small', label: 'Мелкий', scale: 0.7 },
  { key: 'normal', label: 'Обычный', scale: 0.8 },
  { key: 'large', label: 'Крупный', scale: 0.9 },
  { key: 'xlarge', label: 'Очень крупный', scale: 1 },
];

export type Settings = {
  fontSize: FontSize;
  /** Вход по 4-значному коду; сам код хранится в SecureStore (см. lock.ts). */
  lockEnabled: boolean;
  /** Разблокировка отпечатком пальца вместо кода. */
  biometric: boolean;
};

const DEFAULT_SETTINGS: Settings = { fontSize: 'normal', lockEnabled: false, biometric: false };

type SettingsContextValue = {
  settings: Settings;
  /** false, пока настройки читаются при запуске. */
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  update: () => {},
});

/** Масштаб шрифта для обёрток Text/TextInput. */
export const FontScaleContext = createContext(FONT_SIZES[1].scale);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(settings);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        if (!saved) return;
        ref.current = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        setSettings(ref.current);
      })
      .catch((e) => console.warn('Не удалось прочитать настройки', e))
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    ref.current = { ...ref.current, ...patch };
    setSettings(ref.current);
    AsyncStorage.setItem(KEY, JSON.stringify(ref.current)).catch((e) => console.warn(e));
  }, []);

  const value = useMemo(() => ({ settings, loaded, update }), [settings, loaded, update]);
  const scale = FONT_SIZES.find((f) => f.key === settings.fontSize)?.scale ?? FONT_SIZES[1].scale;

  return (
    <SettingsContext.Provider value={value}>
      <FontScaleContext.Provider value={scale}>{children}</FontScaleContext.Provider>
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
