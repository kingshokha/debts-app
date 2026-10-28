import { useCallback, useEffect, useState } from 'react';
import { authenticateBiometric, checkPin } from '../lock';
import { PinScreen } from './PinScreen';

type Props = {
  biometric: boolean;
  onUnlock: () => void;
};

/** Экран входа: сразу предлагает отпечаток (если включён), иначе — код. */
export function LockScreen({ biometric, onUnlock }: Props) {
  const [error, setError] = useState<string | null>(null);

  const tryBiometric = useCallback(async () => {
    try {
      if (await authenticateBiometric()) onUnlock();
    } catch (e) {
      console.warn('Отпечаток недоступен', e);
    }
  }, [onUnlock]);

  useEffect(() => {
    if (biometric) tryBiometric();
  }, [biometric, tryBiometric]);

  const submit = async (pin: string) => {
    if (await checkPin(pin)) onUnlock();
    else setError('Неверный код');
  };

  return (
    <PinScreen title="Введите код" error={error} onComplete={submit} onBiometric={biometric ? tryBiometric : undefined} />
  );
}
