import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { ParentGate } from '../src/components/ParentGate';
import { useSpeech } from '../src/core/speech';
import { defaultSettings, uid, type Profile, type Session } from '../src/core/types';
import { createQuestion, submitAnswer } from '../src/core/engine';
import { seedWords, editDistance } from '../src/core/words';
import {
  initialize,
  saveProfile,
  startSession,
  recordAnswer,
  getHistory,
  advance,
  saveDraft,
} from '../src/core/storage';
import { questionCsvExport } from '../src/core/analytics';
const session: Session = {
  id: 's',
  profileId: 'p',
  mode: 'correct',
  length: 3,
  questionIds: [],
  status: 'active',
  activeMs: 0,
  startedAt: new Date().toISOString(),
};
it('drafts survive exit without counting unsubmitted work as attempts', async () => {
  await initialize();
  const p: Profile = {
    id: uid(),
    name: 'Draft test',
    createdAt: new Date().toISOString(),
    settings: { ...defaultSettings },
  };
  await saveProfile(p);
  const build = await startSession(p, 'build'),
    tiles = build.question.tiles.slice(0, 2).map((t) => t.id);
  await saveDraft(build.question.id, { draftTiles: tiles });
  const resumed = await startSession(p, 'build');
  expect(resumed.question.draftTiles).toEqual(tiles);
  expect(resumed.question.solved).toBe(false);
  const correction = await startSession(p, 'correct');
  await saveDraft(correction.question.id, { draftCorrection: correction.question.target });
  expect((await startSession(p, 'correct')).question.draftCorrection).toBe(
    correction.question.target,
  );
  expect((await getHistory(p.id)).attempts).toHaveLength(0);
});
it('question CSV includes unfinished questions even when no answer has been submitted', () => {
  const q = createQuestion(seedWords[0], session, defaultSettings),
    csv = questionCsvExport([q]);
  expect(csv).toContain('incomplete');
  expect(csv).toContain(q.id);
  expect(csv).toContain(q.target);
  expect(csv.split('\r\n')).toHaveLength(2);
});
it('beginners see a single correction error; advanced exercises can contain multiple curated errors', () => {
  for (const word of seedWords) {
    const q = createQuestion(word, session, defaultSettings);
    expect(editDistance(word.spelling, q.initialCorrection)).toBe(1);
  }
  const q = createQuestion(seedWords.find((w) => w.spelling === 'МАЛЕНЬКИЙ')!, session, {
    ...defaultSettings,
    difficulty: 3,
  });
  expect(editDistance(q.target, q.initialCorrection)).toBe(2);
  const forbidden = ['СЕРИЙ', 'ПИНАЛ', 'СИСТРА'];
  expect(
    seedWords.flatMap((w) => w.distractors.map((d) => d.text)).filter((w) => forbidden.includes(w)),
  ).toEqual([]);
});
it('records repeat mistakes on each blank and captures the currently displayed prompt', () => {
  let q = createQuestion(
    seedWords.find((w) => w.spelling === 'СИНИЙ')!,
    { ...session, mode: 'missing' },
    { ...defaultSettings, difficulty: 3 },
  );
  const index = q.blanks[0],
    wrong = q.blankOptions[0].find((l) => l !== q.target[index])!;
  q = submitAnswer(q, wrong, 1000, index).question;
  q = submitAnswer(q, wrong, 2000, index).question;
  q = submitAnswer(q, q.target[index], 3000, index).question;
  const final = submitAnswer(q, q.target[q.blanks[1]], 5000, q.blanks[1]);
  expect(final.question.attemptCount).toBe(4);
  expect(final.question.firstAttemptCorrect).toBe(false);
  expect(final.attempt.prompt[index]).toBe(q.target[index]);
  expect(final.attempt.prompt[q.blanks[1]]).toBe('_');
});
it('parent gate rejects a wrong result and opens only after the adult challenge', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.2);
  const unlock = vi.fn(),
    user = userEvent.setup();
  render(
    <MemoryRouter>
      <ParentGate unlock={unlock} />
    </MemoryRouter>,
  );
  await user.type(screen.getByRole('textbox'), '12');
  await user.click(screen.getByRole('button', { name: 'Открыть кабинет' }));
  expect(unlock).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toBeVisible();
  await user.clear(screen.getByRole('textbox'));
  await user.type(screen.getByRole('textbox'), '60');
  await user.click(screen.getByRole('button', { name: 'Открыть кабинет' }));
  expect(unlock).toHaveBeenCalledTimes(1);
});
it('speech picks Russian, honors rate and volume, cancels replay and ignores cancellation errors', () => {
  const voice = { lang: 'ru-RU', localService: true },
    speak = vi.fn(),
    cancel = vi.fn();
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [voice, { lang: 'en-US' }],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    speak,
    cancel,
  });
  class Utterance {
    text: string;
    constructor(text: string) {
      this.text = text;
    }
  }
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  const hook = renderHook(() => useSpeech({ ...defaultSettings, rate: 0.7, volume: 0.6 }));
  act(() => hook.result.current.speak('СИНИЙ'));
  const first = speak.mock.calls[0][0];
  expect(first.lang).toBe('ru-RU');
  expect(first.voice).toBe(voice);
  expect(first.rate).toBe(0.7);
  expect(first.volume).toBe(0.6);
  act(() => hook.result.current.speak('СИНИЙ'));
  expect(cancel).toHaveBeenCalledTimes(2);
  act(() => first.onerror({ error: 'interrupted' }));
  expect(hook.result.current.error).toBe('');
  hook.unmount();
  vi.unstubAllGlobals();
});
it('speech gives a useful fallback when Russian voices are missing', () => {
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    cancel: vi.fn(),
  });
  const hook = renderHook(() => useSpeech(defaultSettings));
  act(() => hook.result.current.speak('СИНИЙ'));
  expect(hook.result.current.available).toBe(false);
  expect(hook.result.current.error).toMatch(/Русский голос недоступен/);
  hook.unmount();
  vi.unstubAllGlobals();
});
it('concurrent submissions receive distinct consecutive numbers and sessions finish only after their last solution', async () => {
  await initialize();
  const profile: Profile = {
    id: uid(),
    name: 'Concurrency',
    createdAt: new Date().toISOString(),
    settings: { ...defaultSettings, sessionLength: 3 },
  };
  await saveProfile(profile);
  let state = await startSession(profile, 'spelling');
  const wrong = state.question.options.find((x) => x !== state.question.target)!;
  await Promise.all([
    recordAnswer(state.question.id, wrong, 1000, 1000),
    recordAnswer(state.question.id, wrong, 2000, 2000),
  ]);
  expect((await getHistory(profile.id)).attempts.map((a) => a.number)).toEqual([1, 2]);
  for (let i = 0; i < 3; i++) {
    await recordAnswer(state.question.id, state.question.target, 3000, 5000 * (i + 1));
    const next = await advance(state.session.id, profile.settings);
    if (i < 2) {
      expect(next).not.toBeNull();
      state = next!;
    } else expect(next).toBeNull();
  }
  const h = await getHistory(profile.id);
  expect(h.questions.filter((q) => q.solved)).toHaveLength(3);
  expect(h.sessions[0].status).toBe('completed');
});
