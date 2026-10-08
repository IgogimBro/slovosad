import type { Question, Word } from './types';
export function wordProgress(wordId: string, questions: Question[]) {
  const done = questions
    .filter((q) => q.wordId === wordId && q.solved)
    .sort((a, b) => (a.completedAt ?? a.presentedAt).localeCompare(b.completedAt ?? b.presentedAt));
  let streak = 0;
  const successfulSessions = new Set<string>();
  for (let i = done.length - 1; i >= 0; i--) {
    const q = done[i];
    if (!q.firstAttemptCorrect || q.hinted || q.assisted) break;
    if (!successfulSessions.has(q.sessionId)) {
      streak++;
      successfulSessions.add(q.sessionId);
    }
  }
  const spacing = [0, 1, 3, 7, 14, 30][Math.min(streak, 5)];
  const dueAt = done.length
    ? new Date(new Date(done[done.length - 1].completedAt!).getTime() + spacing * 86400000)
    : null;
  return { done, streak, dueAt, retentionSessions: successfulSessions.size };
}
export function reviewScore(word: Word, questions: Question[], now = Date.now()) {
  const { done, streak, dueAt } = wordProgress(word.id, questions);
  if (!done.length) return 3;
  const recent = done.slice(-5);
  const effort =
    recent.reduce((n, q) => n + q.mistakeCount + Number(q.hinted || q.assisted), 0) / recent.length;
  const durations = questions
    .filter((q) => q.solved)
    .map((q) => q.elapsedMs)
    .sort((a, b) => a - b);
  const baseline = durations[Math.floor(durations.length / 2)] || Infinity;
  const slow =
    recent.filter((q) => q.elapsedMs > Math.max(15000, baseline * 1.5)).length / recent.length;
  return (
    1 +
    Math.min(effort, 5) * 2 +
    slow +
    (dueAt && dueAt.getTime() <= now ? 3 : 0) +
    1 / (streak + 1)
  );
}
export function chooseReview(
  words: Word[],
  questions: Question[],
  recentWordIds: string[],
  random = Math.random,
): Word {
  if (!words.length)
    throw new Error('Нет подходящих слов. Измените сложность или категории в настройках.');
  const candidates =
    words.length > 2
      ? words.filter((w) => !recentWordIds.slice(-2).includes(w.id))
      : words.length > 1
        ? words.filter((w) => w.id !== recentWordIds.at(-1))
        : words;
  const pool = candidates.length ? candidates : words;
  const weights = pool.map((w) => reviewScore(w, questions));
  let ticket = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    ticket -= weights[i];
    if (ticket < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
