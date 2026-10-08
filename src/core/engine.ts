import {
  uid,
  type Attempt,
  type Question,
  type Word,
  type Settings,
  type Session,
  type Mode,
} from './types';
import { classifyError, editDistance } from './words';
export function shuffle<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function letterTiles(word: string, random = Math.random) {
  const original = [...word].map((letter, i) => ({ id: `tile-${i}`, letter }));
  const tiles = shuffle(original, random);
  if (tiles.map((t) => t.letter).join('') === word) {
    const other = tiles.findIndex((t) => t.letter !== tiles[0].letter);
    if (other >= 0) [tiles[0], tiles[other]] = [tiles[other], tiles[0]];
  }
  return tiles;
}
function letterOptions(letter: string, count: number, random: () => number) {
  const groups: Record<string, string> = {
    И: 'ЙЫЕ',
    Й: 'ИЫЬ',
    Ы: 'ИЕЙ',
    А: 'ОЯУ',
    О: 'АЁУ',
    Е: 'ИЭЁ',
    Ё: 'ЕОЭ',
    Ш: 'ЩЖЧ',
    Щ: 'ШЧЖ',
    Б: 'ВПЬ',
    В: 'БФЬ',
    Н: 'ПИМ',
    П: 'НЛТ',
    Ь: 'ЪЫЙ',
  };
  const pool = [...(groups[letter] ?? 'АИОНСТ')].filter((l) => l !== letter);
  return shuffle([letter, ...[...new Set(pool)].slice(0, count - 1)], random);
}
export function createQuestion(
  word: Word,
  session: Session,
  settings: Settings,
  random = Math.random,
): Question {
  const count = settings.choices || settings.difficulty + 1;
  const mode = session.mode;
  if (!word.modes.includes(mode)) throw new Error('Слово не поддерживает выбранный режим.');
  const wrong = [
    ...new Map(
      word.distractors.filter((d) => d.text !== word.spelling).map((d) => [d.text, d]),
    ).values(),
  ];
  if ((mode === 'spelling' && wrong.length < count - 1) || (mode === 'correct' && !wrong.length))
    throw new Error('Недостаточно проверенных неверных вариантов.');
  const focused = [...word.spelling]
    .map((c, i) => ('ИЙЫАОЕ'.includes(c) ? i : -1))
    .filter((i) => i >= 0);
  const positions = shuffle(focused.length ? focused : [...word.spelling].map((_, i) => i), random);
  const n = mode === 'missing' && settings.difficulty === 3 && word.spelling.length >= 5 ? 2 : 1;
  const blanks = positions.slice(0, n);
  if (blanks.length < n)
    blanks.push(
      ...[...word.spelling]
        .map((_, i) => i)
        .filter((i) => !blanks.includes(i))
        .slice(0, n - blanks.length),
    );
  blanks.sort((a, b) => a - b);
  const spellingOptions = shuffle(
    [
      word.spelling,
      ...shuffle(wrong, random)
        .slice(0, count - 1)
        .map((d) => d.text),
    ],
    random,
  );
  const simple = wrong.filter((d) => editDistance(word.spelling, d.text) === 1);
  const correctionPool =
    settings.difficulty === 3 && word.advancedCorrections?.length
      ? word.advancedCorrections
      : simple.length
        ? simple
        : wrong;
  const initialCorrection =
    correctionPool[Math.floor(random() * correctionPool.length)]?.text ?? '';
  return {
    id: uid(),
    profileId: session.profileId,
    sessionId: session.id,
    wordId: word.id,
    target: word.spelling,
    category: word.category,
    mode,
    difficulty: settings.difficulty,
    prompt:
      mode === 'missing'
        ? [...word.spelling].map((c, i) => (blanks.includes(i) ? '_' : c)).join('')
        : mode === 'correct'
          ? initialCorrection
          : mode === 'build'
            ? 'Собери услышанное слово'
            : 'Выбери правильное написание',
    options: mode === 'spelling' ? spellingOptions : [],
    optionErrors: Object.fromEntries(wrong.map((d) => [d.text, d.kind])),
    blanks: mode === 'missing' ? blanks : [],
    blankOptions:
      mode === 'missing' ? blanks.map((i) => letterOptions(word.spelling[i], count, random)) : [],
    blankAnswers: {},
    tiles: mode === 'build' ? letterTiles(word.spelling, random) : [],
    initialCorrection,
    attemptCount: 0,
    mistakeCount: 0,
    solved: false,
    firstAttemptCorrect: null,
    hinted: false,
    assisted: false,
    elapsedMs: 0,
    lastAttemptElapsedMs: 0,
    presentedAt: new Date().toISOString(),
  };
}
export function submitAnswer(
  question: Question,
  answer: string,
  elapsedMs: number,
  blankIndex?: number,
): { question: Question; attempt: Attempt } {
  if (question.solved) throw new Error('Этот вопрос уже решён.');
  if (!answer) throw new Error('Сначала выбери ответ.');
  if (question.mode === 'spelling' && !question.options.includes(answer))
    throw new Error('Выбери один из вариантов.');
  if (question.mode === 'build' && answer.length !== question.target.length)
    throw new Error('Используй все буквы.');
  const missing = question.mode === 'missing';
  if (
    missing &&
    (blankIndex === undefined ||
      !question.blanks.includes(blankIndex) ||
      question.blankAnswers[blankIndex] ||
      !question.blankOptions[question.blanks.indexOf(blankIndex)].includes(answer))
  )
    throw new Error('Выбери букву для активного пропуска.');
  const correct = missing ? answer === question.target[blankIndex!] : answer === question.target;
  const blankAnswers =
    correct && missing
      ? { ...question.blankAnswers, [blankIndex!]: answer }
      : question.blankAnswers;
  const solved = correct && (!missing || question.blanks.every((i) => Boolean(blankAnswers[i])));
  const duration = Math.max(question.elapsedMs, elapsedMs, question.lastAttemptElapsedMs);
  const target = missing ? question.target[blankIndex!] : question.target;
  const diffs = [...target].filter((c, i) => c !== answer[i]);
  const pair =
    !correct && target.length === answer.length && diffs.length === 1
      ? [
          target[[...target].findIndex((c, i) => c !== answer[i])],
          answer[[...target].findIndex((c, i) => c !== answer[i])],
        ]
          .sort()
          .join(' ↔ ')
      : undefined;
  const attempt: Attempt = {
    id: uid(),
    profileId: question.profileId,
    sessionId: question.sessionId,
    questionId: question.id,
    wordId: question.wordId,
    mode: question.mode,
    difficulty: question.difficulty,
    prompt: missing
      ? [...question.prompt].map((c, i) => question.blankAnswers[i] ?? c).join('')
      : question.prompt,
    options: missing
      ? question.blankOptions[question.blanks.indexOf(blankIndex!)]
      : question.mode === 'build'
        ? question.tiles.map((t) => t.letter)
        : question.options,
    number: question.attemptCount + 1,
    answer,
    correct,
    errorKind: correct
      ? undefined
      : (question.optionErrors[answer] ?? classifyError(target, answer)),
    confusionPair: pair,
    blankIndex: missing ? blankIndex : undefined,
    elapsedMs: duration,
    sincePreviousMs: duration - question.lastAttemptElapsedMs,
    timestamp: new Date().toISOString(),
    hinted: question.hinted,
    assisted: question.assisted,
  };
  const updated: Question = {
    ...question,
    blankAnswers,
    attemptCount: attempt.number,
    mistakeCount: question.mistakeCount + (correct ? 0 : 1),
    solved,
    elapsedMs: duration,
    lastAttemptElapsedMs: duration,
    firstAttemptCorrect: solved ? question.mistakeCount === 0 && correct : null,
    completedAt: solved ? attempt.timestamp : undefined,
  };
  return { question: updated, attempt };
}
export const canAdvance = (q: Question) => q.solved;
export function eligibleWords(words: Word[], settings: Settings, mode: Mode) {
  const count = settings.choices || settings.difficulty + 1;
  return words.filter(
    (w) =>
      !w.hidden &&
      w.difficulty <= settings.difficulty &&
      w.modes.includes(mode) &&
      (!settings.categories.length || settings.categories.includes(w.category)) &&
      (mode !== 'spelling' || w.distractors.length >= count - 1),
  );
}
