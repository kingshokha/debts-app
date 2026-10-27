import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatAmount, formatDate, formatTime } from '../format';
import { type BookSummary, type DebtBook, DebtBookError, readDebtBook, summarize } from '../import/debtBook';
import type { ImportPlan, ImportStats } from '../import/merge';
import type { PickedText } from '../import/pickFile';
import { colors } from '../theme';
import { Dialog, DialogButton, dialogStyles } from './Dialog';

type Props = {
  file: PickedText | null;
  onClose: () => void;
  onPlan: (book: DebtBook) => ImportPlan;
  onImport: (plan: ImportPlan, onProgress: (fraction: number) => void) => Promise<void>;
};

type Stage =
  | { kind: 'checking'; progress: number }
  | { kind: 'invalid'; problems: string[] }
  | { kind: 'preview'; summary: BookSummary; plan: ImportPlan }
  | { kind: 'importing'; progress: number }
  | { kind: 'failed'; message: string }
  | { kind: 'done'; stats: ImportStats };

/** Импорт резервной копии «долговой книги»: проверка → предпросмотр → запись → итог. */
export function DebtBookImportDialog({ file, ...rest }: Props) {
  return file ? <ImportFlow key={`${file.name}:${file.text.length}`} file={file} {...rest} /> : null;
}

function ImportFlow({ file, onClose, onPlan, onImport }: Props & { file: PickedText }) {
  const [stage, setStage] = useState<Stage>({ kind: 'checking', progress: 0 });

  useEffect(() => {
    let cancelled = false;
    readDebtBook(file.text, (progress) => !cancelled && setStage({ kind: 'checking', progress }))
      .then((book) => {
        if (!cancelled) setStage({ kind: 'preview', summary: summarize(book), plan: onPlan(book) });
      })
      .catch((e) => {
        if (cancelled) return;
        const problems = e instanceof DebtBookError ? e.problems : [`Не удалось прочитать файл: ${(e as Error)?.message ?? e}`];
        setStage({ kind: 'invalid', problems });
      });
    return () => {
      cancelled = true;
    };
  }, [file, onPlan]);

  const runImport = async (plan: ImportPlan) => {
    setStage({ kind: 'importing', progress: 0 });
    try {
      await onImport(plan, (progress) => setStage({ kind: 'importing', progress }));
      setStage({ kind: 'done', stats: plan.stats });
    } catch (e) {
      console.warn(e);
      setStage({ kind: 'failed', message: String((e as Error)?.message ?? e) });
    }
  };

  const busy = stage.kind === 'checking' || stage.kind === 'importing';

  return (
    <Dialog visible onClose={busy ? () => {} : onClose} title="Импорт из файла">
      <Text style={styles.file} numberOfLines={1}>
        {file.name}
      </Text>

      {stage.kind === 'checking' ? <ProgressBlock label="Проверка файла…" progress={stage.progress} /> : null}

      {stage.kind === 'invalid' ? (
        <>
          <Text style={styles.errorTitle}>Файл не прошёл проверку. Ничего не записано.</Text>
          <ScrollView style={styles.problems} nestedScrollEnabled>
            {stage.problems.map((p, i) => (
              <Text key={i} style={styles.problem}>
                {p}
              </Text>
            ))}
          </ScrollView>
        </>
      ) : null}

      {stage.kind === 'preview' ? <Preview summary={stage.summary} stats={stage.plan.stats} /> : null}

      {stage.kind === 'importing' ? <ProgressBlock label="Запись в базу…" progress={stage.progress} /> : null}

      {stage.kind === 'failed' ? (
        <>
          <Text style={styles.errorTitle}>Ошибка записи. Изменения отменены, данные остались прежними.</Text>
          <Text style={styles.problem}>{stage.message}</Text>
        </>
      ) : null}

      {stage.kind === 'done' ? <Done stats={stage.stats} /> : null}

      <View style={[dialogStyles.buttons, { justifyContent: 'flex-end', gap: 16 }]}>
        {stage.kind === 'preview' && hasChanges(stage.plan.stats) ? (
          <>
            <DialogButton label="ОТМЕНА" color={colors.teal} onPress={onClose} />
            <DialogButton label="ИМПОРТИРОВАТЬ" color={colors.green} onPress={() => runImport(stage.plan)} />
          </>
        ) : (
          <DialogButton label={stage.kind === 'done' ? 'ГОТОВО' : 'ЗАКРЫТЬ'} color={colors.teal} onPress={onClose} disabled={busy} />
        )}
      </View>
    </Dialog>
  );
}

const hasChanges = (s: ImportStats) => s.contactsAdded + s.operationsAdded + s.templatesAdded + s.groupsAdded > 0;

const count = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const dateTime = (ts: number) => `${formatDate(ts)}, ${formatTime(ts)}`;

function Preview({ summary, stats }: { summary: BookSummary; stats: ImportStats }) {
  return (
    <View>
      <Row label="Бэкап от" value={dateTime(summary.backupTime)} />
      <Row label="Клиентов" value={count(summary.clients)} />
      <Row label="Операций" value={count(summary.operations)} />
      {summary.firstDate !== null && summary.lastDate !== null ? (
        <Row label="Период" value={`${formatDate(summary.firstDate)} — ${formatDate(summary.lastDate)}`} />
      ) : null}
      <Row label="Должны всего" value={`${formatAmount(summary.positive, false)} сомони`} color={colors.green} />
      <Row label="Переплаты" value={`${formatAmount(summary.negative)} сомони`} color={colors.red} />

      <View style={dialogStyles.divider} />
      {hasChanges(stats) ? (
        <>
          <Row label="Новых клиентов" value={count(stats.contactsAdded)} />
          {stats.contactsMatched ? <Row label="Уже есть в приложении" value={count(stats.contactsMatched)} /> : null}
          <Row label="Новых операций" value={count(stats.operationsAdded)} />
          {stats.operationsSkipped ? <Row label="Дубли (пропустим)" value={count(stats.operationsSkipped)} /> : null}
          {stats.templatesAdded ? <Row label="Шаблонов заметок" value={count(stats.templatesAdded)} /> : null}
        </>
      ) : (
        <Text style={styles.note}>Всё из этого файла уже есть в приложении — добавлять нечего.</Text>
      )}
    </View>
  );
}

function Done({ stats }: { stats: ImportStats }) {
  return (
    <View>
      <Text style={styles.doneTitle}>Импорт завершён</Text>
      <Row label="Добавлено клиентов" value={count(stats.contactsAdded)} />
      <Row label="Добавлено операций" value={count(stats.operationsAdded)} />
      {stats.templatesAdded ? <Row label="Добавлено шаблонов" value={count(stats.templatesAdded)} /> : null}
      <Row label="Пропущено дублей" value={count(stats.operationsSkipped)} />
    </View>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function ProgressBlock({ label, progress }: { label: string; progress: number }) {
  return (
    <View style={styles.progressBlock}>
      <Text style={styles.label}>
        {label} {Math.round(progress * 100)}%
      </Text>
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  file: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  label: { color: colors.muted, fontSize: 15 },
  value: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  note: { color: colors.text, fontSize: 15 },
  doneTitle: { color: colors.green, fontSize: 17, fontWeight: '600', marginBottom: 8 },
  errorTitle: { color: colors.red, fontSize: 15, fontWeight: '600', marginBottom: 8 },
  problems: { maxHeight: 300 },
  problem: { color: colors.text, fontSize: 14, marginBottom: 6 },
  progressBlock: { paddingVertical: 8, gap: 10 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.bg, overflow: 'hidden' },
  bar: { height: 6, backgroundColor: colors.accent },
});
