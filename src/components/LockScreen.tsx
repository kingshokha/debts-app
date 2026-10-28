import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticateBiometric, cancelBiometric, checkPin } from '../lock';
import { PinScreen } from './PinScreen';

type Props = {
  biometric: boolean;
  onUnlock: () => void;
};

/** Экран входа: сразу предлагает отпечаток (если включён), иначе — код. */
export function LockScreen({ biometric, onUnlock }: Props) {
  const [error, setError] = useState<string | null>(null);
  const onUnlockRef = useRef(onUnlock);
  useEffect(() => {
    onUnlockRef.current = onUnlock;
  });
  // Окно отпечатка уже открыто — второе не показываем (иначе после входа оно всплывало снова)
  const prompting = useRef(false);

  const tryBiometric = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticateBiometric()) onUnlockRef.current();
    } catch (e) {
      console.warn('Отпечаток недоступен', e);
    } finally {
      prompting.current = false;
    }
  }, []);

  // Отпечаток запрашиваем один раз при появлении экрана; повторно — кнопкой на клавиатуре
  useEffect(() => {
    if (biometric) tryBiometric();
    return cancelBiometric;
  }, [biometric, tryBiometric]);

  const submit = async (pin: string) => {
    if (await checkPin(pin)) onUnlockRef.current();
    else setError('Неверный код');
  };

  return (
    <PinScreen title="Введите код" error={error} onComplete={submit} onBiometric={biometric ? tryBiometric : undefined} />
  );
}
