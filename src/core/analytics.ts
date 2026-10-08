import type { History, Question, Attempt } from './types';
export const dayKey = (stamp: string) => {
  const d = new Date(stamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const percent = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);
export function summarize(history: History) {
  const done = history.questions.filter((q) => q.solved),
    times = done.map((q) => q.elapsedMs).sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0),
    mid = Math.floor(times.length / 2);
  return {
    completed: done.length,
    attempts: history.attempts.length,
    mistakes: history.attempts.filter((a) => !a.correct).length,
    unfinished: history.questions.filter((q) => !q.solved).length,
    firstAccuracy: percent(done.filter((q) => q.firstAttemptCorrect).length, done.length),
    attemptAccuracy: percent(
      history.attempts.filter((a) => a.correct).length,
      history.attempts.length,
    ),
    avgAttempts: done.length ? done.reduce((n, q) => n + q.attemptCount, 0) / done.length : null,
    avgMs: done.length ? sum / done.length : null,
    medianMs: times.length
      ? times.length % 2
        ? times[mid]
        : (times[mid - 1] + times[mid]) / 2
      : null,
    activeMs: history.sessions.reduce((n, s) => n + s.activeMs, 0),
    today: done.filter((q) => dayKey(q.completedAt!) === dayKey(new Date().toISOString())).length,
  };
}
export function groups(questions: Question[], by: (q: Question) => string) {
  const map = new Map<string, Question[]>();
  for (const q of questions.filter((q) => q.solved)) {
    const key = by(q);
    map.set(key, [...(map.get(key) || []), q]);
  }
  return [...map].map(([name, qs]) => ({
    name,
    completed: qs.length,
    first: qs.filter((q) => q.firstAttemptCorrect).length,
    accuracy: percent(qs.filter((q) => q.firstAttemptCorrect).length, qs.length),
    attempts: qs.reduce((n, q) => n + q.attemptCount, 0) / qs.length,
  }));
}
export function csvExport(attempts: Attempt[]) {
  const keys: (keyof Attempt)[] = [
    'id',
    'profileId',
    'sessionId',
    'questionId',
    'wordId',
    'mode',
    'difficulty',
    'prompt',
    'options',
    'number',
    'answer',
    'correct',
    'errorKind',
    'confusionPair',
    'blankIndex',
    'elapsedMs',
    'sincePreviousMs',
    'timestamp',
    'hinted',
    'assisted',
  ];
  const quote = (value: unknown) => {
    let s = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
    if (/^[=+\-@\t\r]/u.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    '\uFEFF' +
    keys.join(',') +
    '\r\n' +
    attempts.map((a) => keys.map((k) => quote(a[k])).join(',')).join('\r\n')
  );
}
export const errorLabels: Record<string, string> = {
  missing: 'Пропуск буквы',
  extra: 'Лишняя буква',
  repeated: 'Повтор буквы',
  swapped: 'Порядок букв',
  vowel: 'Гласные',
  consonant: 'Согласные',
  'и/й': 'И и Й',
  'ы/и': 'Ы и И',
  other: 'Другие ошибки',
};
export function questionCsvExport(questions: Question[]) {
  const headers = [
    'questionId',
    'profileId',
    'sessionId',
    'wordId',
    'target',
    'mode',
    'difficulty',
    'prompt',
    'status',
    'attempts',
    'mistakes',
    'firstAttemptCorrect',
    'activeMs',
    'presentedAt',
    'completedAt',
    'hinted',
    'assisted',
  ];
  const quote = (value: unknown) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  return (
    '\uFEFF' +
    headers.join(',') +
    '\r\n' +
    questions
      .map((q) =>
        [
          q.id,
          q.profileId,
          q.sessionId,
          q.wordId,
          q.target,
          q.mode,
          q.difficulty,
          q.prompt,
          q.solved ? 'completed' : 'incomplete',
          q.attemptCount,
          q.mistakeCount,
          q.firstAttemptCorrect,
          q.elapsedMs,
          q.presentedAt,
          q.completedAt,
          q.hinted,
          q.assisted,
        ]
          .map(quote)
          .join(','),
      )
      .join('\r\n')
  );
}
