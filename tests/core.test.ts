import { describe, it, expect } from 'vitest';
import { seedWords, validateWord, classifyError } from '../src/core/words';
import { defaultSettings, uid, type Profile, type Session, type Word } from '../src/core/types';
import { createQuestion, submitAnswer, letterTiles, canAdvance } from '../src/core/engine';
import { ActiveClock } from '../src/core/clock';
import { chooseReview, wordProgress } from '../src/core/adaptive';
import { csvExport, summarize } from '../src/core/analytics';
import {
  initialize,
  startSession,
  recordAnswer,
  database,
  getHistory,
  advance,
  saveProfile,
  saveWord,
  selectProfile,
  checkpoint,
  markHelp,
  resetLearning,
} from '../src/core/storage';
const baseSession: Session = {
  id: 'session',
  profileId: 'learner',
  mode: 'spelling',
  length: 5,
  questionIds: [],
  status: 'active',
  activeMs: 0,
  startedAt: new Date().toISOString(),
};
const word = seedWords.find((w) => w.spelling === 'СИНИЙ')!;
describe('content and question generation', () => {
  it('contains 110 unique curated words in ten categories with safe unique distractors', () => {
    expect(seedWords).toHaveLength(110);
    expect(new Set(seedWords.map((w) => w.category)).size).toBe(10);
    expect(new Set(seedWords.map((w) => w.spelling)).size).toBe(110);
    for (const w of seedWords) {
      expect(validateWord(w, seedWords)).toBeNull();
      expect(w.distractors).toHaveLength(3);
    }
  });
  it('every question has exactly one correct answer and the requested number of distinct choices', () => {
    for (const w of seedWords)
      for (const choices of [2, 3, 4] as const) {
        const q = createQuestion(w, baseSession, {
          ...defaultSettings,
          choices,
        });
        expect(q.options).toHaveLength(choices);
        expect(new Set(q.options).size).toBe(choices);
        expect(q.options.filter((a) => a === w.spelling)).toHaveLength(1);
      }
  });
  it('correct position is randomized', () => {
    const positions = new Set(
      Array.from({ length: 40 }, () =>
        createQuestion(word, baseSession, {
          ...defaultSettings,
          choices: 4,
        }).options.indexOf(word.spelling),
      ),
    );
    expect(positions.size).toBeGreaterThan(1);
  });
  it('preserves repeated letter identities and never displays the original word when an alternative exists', () => {
    for (const w of seedWords) {
      const tiles = letterTiles(w.spelling, () => 0.999);
      expect(tiles.map((t) => t.letter).sort()).toEqual([...w.spelling].sort());
      expect(new Set(tiles.map((t) => t.id)).size).toBe(w.spelling.length);
      if (new Set(w.spelling).size > 1)
        expect(tiles.map((t) => t.letter).join('')).not.toBe(w.spelling);
    }
    expect(
      letterTiles('ААА')
        .map((t) => t.letter)
        .join(''),
    ).toBe('ААА');
  });
  it('uses separate blank interactions without exposing answers in the prompt', () => {
    const q = createQuestion(
      word,
      { ...baseSession, mode: 'missing' },
      { ...defaultSettings, difficulty: 3 },
    );
    expect(q.blanks).toHaveLength(2);
    expect(q.prompt.match(/_/g)).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      expect(q.prompt[q.blanks[i]]).toBe('_');
      expect(q.blankOptions[i].filter((x) => x === q.target[q.blanks[i]])).toHaveLength(1);
    }
    const first = submitAnswer(q, q.target[q.blanks[0]], 4000, q.blanks[0]);
    expect(first.question.solved).toBe(false);
    expect(canAdvance(first.question)).toBe(false);
    const second = submitAnswer(first.question, q.target[q.blanks[1]], 9000, q.blanks[1]);
    expect(second.question.solved).toBe(true);
    expect(second.question.firstAttemptCorrect).toBe(true);
    expect(second.question.attemptCount).toBe(2);
  });
  it('keeps Е and Ё distinct', () => {
    expect(classifyError('ЖЁЛТЫЙ', 'ЖЕЛТЫЙ')).toBe('vowel');
    expect(
      submitAnswer(
        createQuestion(
          seedWords.find((w) => w.spelling === 'ЖЁЛТЫЙ')!,
          { ...baseSession, mode: 'correct' },
          defaultSettings,
        ),
        'ЖЕЛТЫЙ',
        1000,
      ).attempt.correct,
    ).toBe(false);
  });
  it('supports correction submissions without revealing or replacing the answer on a mistake', () => {
    const q = createQuestion(word, { ...baseSession, mode: 'correct' }, defaultSettings);
    const wrong = submitAnswer(q, q.initialCorrection, 1000);
    expect(wrong.question.prompt).toBe(q.initialCorrection);
    expect(wrong.question.solved).toBe(false);
    expect(submitAnswer(wrong.question, q.target, 3000).question.solved).toBe(true);
  });
  it('validates custom words and known legitimate distractors', () => {
    const custom: Word = {
      ...word,
      id: 'custom',
      spelling: 'РАДУГА',
      category: 'Мои слова',
      distractors: [],
      modes: ['build', 'missing'],
    };
    expect(validateWord(custom, seedWords)).toBeNull();
    expect(validateWord({ ...custom, modes: ['spelling'] }, seedWords)).toMatch(/три/);
    expect(
      validateWord({ ...custom, distractors: [{ text: 'КОТ', kind: 'other' }] }, seedWords),
    ).toMatch(/настоящими/);
    expect(validateWord({ ...custom, spelling: 'ABC' }, seedWords)).toMatch(/русское/);
    expect(validateWord({ ...custom, spelling: 'КОТ' }, seedWords)).toMatch(/уже/);
  });
});
describe('unlimited attempts and measurement', () => {
  it('keeps the next question locked through 100 identical incorrect attempts and records each separately', () => {
    let q = createQuestion(word, baseSession, {
      ...defaultSettings,
      choices: 4,
    });
    const wrong = q.options.find((a) => a !== q.target)!,
      attempts = [];
    for (let i = 1; i <= 100; i++) {
      const result = submitAnswer(q, wrong, i * 1000);
      q = result.question;
      attempts.push(result.attempt);
      expect(canAdvance(q)).toBe(false);
      expect(q.options).toContain(wrong);
    }
    expect(new Set(attempts.map((a) => a.id)).size).toBe(100);
    expect(attempts.map((a) => a.number)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    const result = submitAnswer(q, q.target, 105000);
    expect(canAdvance(result.question)).toBe(true);
    expect(result.question.firstAttemptCorrect).toBe(false);
    expect(result.attempt.sincePreviousMs).toBe(5000);
    expect(result.question.elapsedMs).toBe(105000);
    expect(() => submitAnswer(result.question, q.target, 106000)).toThrow(/уже/);
  });
  it('distinguishes completion, first-attempt accuracy, attempt accuracy, and assistance', () => {
    const first = createQuestion(word, baseSession, defaultSettings),
      one = submitAnswer(first, first.options.find((x) => x !== first.target)!, 1000),
      two = submitAnswer({ ...one.question, hinted: true }, first.target, 6000),
      other = submitAnswer(createQuestion(word, baseSession, defaultSettings), word.spelling, 2000);
    const stats = summarize({
      questions: [two.question, other.question, createQuestion(word, baseSession, defaultSettings)],
      attempts: [one.attempt, two.attempt, other.attempt],
      sessions: [],
    });
    expect(stats.completed).toBe(2);
    expect(stats.firstAccuracy).toBe(50);
    expect(stats.attemptAccuracy).toBe(67);
    expect(stats.avgAttempts).toBe(1.5);
    expect(stats.medianMs).toBe(4000);
    expect(stats.unfinished).toBe(1);
    expect(two.attempt.hinted).toBe(true);
  });
  it('uses a monotonic clock and excludes hidden time', () => {
    let now = 100;
    const clock = new ActiveClock(2000, () => now);
    now = 600;
    expect(clock.read()).toBe(2500);
    clock.pause();
    now = 50000;
    expect(clock.read()).toBe(2500);
    clock.resume();
    now = 50300;
    expect(clock.read()).toBe(2800);
  });
  it('exports every field with safe CSV quoting and repeated answers', () => {
    const q = createQuestion(word, baseSession, defaultSettings),
      r1 = submitAnswer(q, q.options.find((a) => a !== q.target)!, 1000),
      r2 = submitAnswer(r1.question, r1.attempt.answer, 2000);
    const csv = csvExport([r1.attempt, { ...r2.attempt, prompt: '=SUM(A1)', answer: 'А"Б' }]);
    expect(csv.split('\r\n')).toHaveLength(3);
    expect(csv).toContain('sincePreviousMs');
    expect(csv).toContain('"А""Б"');
    expect(csv).toContain("' =".replace(' ', ''));
    expect(csvExport([])).toContain('hinted,assisted');
  });
  it('avoids two recently practiced words and only counts independent sessions for retention', () => {
    const selected = chooseReview(seedWords, [], [seedWords[0].id, seedWords[1].id], () => 0);
    expect([seedWords[0].id, seedWords[1].id]).not.toContain(selected.id);
    const qs = [0, 1, 2].map(
      () =>
        submitAnswer(createQuestion(word, baseSession, defaultSettings), word.spelling, 1000)
          .question,
    );
    expect(wordProgress(word.id, qs).retentionSessions).toBe(1);
    expect(
      wordProgress(
        word.id,
        qs.map((q, i) => ({ ...q, sessionId: String(i) })),
      ).retentionSessions,
    ).toBe(3);
    expect(
      wordProgress(word.id, [
        ...qs,
        {
          ...qs[0],
          hinted: true,
          completedAt: new Date(Date.now() + 1000).toISOString(),
          presentedAt: new Date(Date.now() + 1000).toISOString(),
        },
      ]).retentionSessions,
    ).toBe(0);
  });
});
describe('IndexedDB persistence and profile isolation', () => {
  it('atomically records repeated answers, resumes incomplete work, locks advance, and isolates profiles', async () => {
    const initial = await initialize(),
      profile: Profile = {
        id: uid(),
        name: 'Test learner',
        createdAt: new Date().toISOString(),
        settings: { ...defaultSettings, sessionLength: 3 },
      };
    await saveProfile(profile);
    const started = await startSession(profile, 'spelling'),
      wrong = started.question.options.find((x) => x !== started.question.target)!;
    await expect(advance(started.session.id, profile.settings)).rejects.toThrow(/Сначала/);
    await recordAnswer(started.question.id, wrong, 4000, 4000);
    await recordAnswer(started.question.id, wrong, 8000, 8000);
    await markHelp(started.question.id, 'assisted');
    await checkpoint(started.session.id, started.question.id, 10000, 10000, true);
    const resumed = await startSession(profile, 'spelling');
    expect(resumed.question.id).toBe(started.question.id);
    expect(resumed.question.attemptCount).toBe(2);
    expect(resumed.question.elapsedMs).toBe(10000);
    const result = await recordAnswer(started.question.id, started.question.target, 12000, 12000);
    expect(result.attempt.number).toBe(3);
    expect(result.attempt.assisted).toBe(true);
    expect(result.attempt.sincePreviousMs).toBe(4000);
    const freshHistory = await getHistory(profile.id);
    expect(freshHistory.attempts).toHaveLength(3);
    expect(freshHistory.questions[0].solved).toBe(true);
    expect((await getHistory(initial.active.id)).attempts).toHaveLength(0);
    const next = await advance(started.session.id, profile.settings);
    expect(next?.question.id).not.toBe(started.question.id);
    expect(next?.question.solved).toBe(false);
    expect(next?.question.wordId).not.toBe(started.question.wordId);
    await selectProfile(profile.id);
    expect((await initialize()).active.id).toBe(profile.id);
    const db = await database();
    expect(await db.get('attempts', result.attempt.id)).toEqual(result.attempt);
    await resetLearning(profile.id);
    expect((await getHistory(profile.id)).attempts).toHaveLength(0);
    await expect((await database()).getAll('words')).resolves.toHaveLength(110);
  });
  it('persists custom vocabulary and rejects duplicate spelling', async () => {
    const custom: Word = {
      ...word,
      id: uid(),
      spelling: 'РАДУГА',
      category: 'Мои слова',
      custom: true,
      distractors: [],
      modes: ['build', 'missing'],
    };
    await saveWord(custom);
    expect(await (await database()).get('words', custom.id)).toEqual({ ...custom, modified: true });
    await expect(saveWord({ ...custom, id: uid() })).rejects.toThrow(/уже/);
  });
});
