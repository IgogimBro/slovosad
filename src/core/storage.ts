import { openDB, type DBSchema } from 'idb';
import {
  defaultSettings,
  uid,
  type Word,
  type Profile,
  type Session,
  type Question,
  type Attempt,
  type History,
  type Mode,
} from './types';
import { seedWords, validateWord } from './words';
import { createQuestion, eligibleWords, submitAnswer } from './engine';
import { chooseReview } from './adaptive';
interface Data extends DBSchema {
  profiles: { key: string; value: Profile };
  words: { key: string; value: Word };
  sessions: { key: string; value: Session; indexes: { profileId: string } };
  questions: { key: string; value: Question; indexes: { profileId: string } };
  attempts: {
    key: string;
    value: Attempt;
    indexes: { profileId: string; questionId: string };
  };
  preferences: { key: string; value: { key: string; value: string } };
}
const connection = () =>
  openDB<Data>('slovosad-local', 1, {
    upgrade(db) {
      db.createObjectStore('profiles', { keyPath: 'id' });
      db.createObjectStore('words', { keyPath: 'id' });
      db.createObjectStore('preferences', { keyPath: 'key' });
      for (const name of ['sessions', 'questions'] as const) {
        const s = db.createObjectStore(name, { keyPath: 'id' });
        s.createIndex('profileId', 'profileId');
      }
      const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
      attempts.createIndex('profileId', 'profileId');
      attempts.createIndex('questionId', 'questionId');
    },
  });
let dbPromise: ReturnType<typeof connection> | undefined;
export const database = () => (dbPromise ??= connection());
export async function initialize() {
  const db = await database();
  const tx = db.transaction(['words', 'profiles', 'preferences'], 'readwrite');
  if ((await tx.objectStore('preferences').get('contentRevision'))?.value !== '2026-10-08-2') {
    for (const word of seedWords) {
      const existing = await tx.objectStore('words').get(word.id);
      if (!existing?.modified)
        await tx.objectStore('words').put({ ...word, hidden: existing?.hidden ?? false });
    }
    await tx.objectStore('preferences').put({ key: 'contentRevision', value: '2026-10-08-2' });
  }
  if ((await tx.objectStore('profiles').count()) === 0) {
    const p: Profile = {
      id: uid(),
      name: 'Ученик',
      settings: { ...defaultSettings },
      createdAt: new Date().toISOString(),
    };
    await tx.objectStore('profiles').put(p);
    await tx.objectStore('preferences').put({ key: 'activeProfile', value: p.id });
  }
  await tx.done;
  const profiles = await db.getAll('profiles'),
    words = await db.getAll('words'),
    activeId = (await db.get('preferences', 'activeProfile'))?.value;
  return {
    profiles,
    words,
    active: profiles.find((p) => p.id === activeId) ?? profiles[0],
  };
}
export async function getHistory(profileId: string): Promise<History> {
  const db = await database();
  const [questions, attempts, sessions] = await Promise.all([
    db.getAllFromIndex('questions', 'profileId', profileId),
    db.getAllFromIndex('attempts', 'profileId', profileId),
    db.getAllFromIndex('sessions', 'profileId', profileId),
  ]);
  return {
    questions,
    attempts: attempts.sort(
      (a, b) => a.timestamp.localeCompare(b.timestamp) || a.number - b.number,
    ),
    sessions,
  };
}
export async function saveProfile(profile: Profile) {
  await (await database()).put('profiles', profile);
}
export async function selectProfile(id: string) {
  await (await database()).put('preferences', { key: 'activeProfile', value: id });
}
export async function saveWord(word: Word) {
  const db = await database(),
    others = await db.getAll('words');
  const error = validateWord(word, others);
  if (error) throw new Error(error);
  await db.put('words', { ...word, modified: true });
}
export async function hideWord(id: string, hidden = true) {
  const db = await database(),
    word = await db.get('words', id);
  if (word) await db.put('words', { ...word, hidden });
}
export async function startSession(
  profile: Profile,
  mode: Mode,
): Promise<{ session: Session; question: Question }> {
  const db = await database(),
    tx = db.transaction(['sessions', 'questions', 'words'], 'readwrite');
  const sessions = await tx.objectStore('sessions').index('profileId').getAll(profile.id);
  const old = sessions
    .filter((s) => s.mode === mode && s.status !== 'completed')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  for (const other of sessions.filter((s) => s.status === 'active' && s.id !== old?.id))
    await tx.objectStore('sessions').put({ ...other, status: 'paused' });
  if (old?.currentQuestionId) {
    const question = await tx.objectStore('questions').get(old.currentQuestionId);
    if (question) {
      const session = { ...old, status: 'active' as const };
      await tx.objectStore('sessions').put(session);
      await tx.done;
      return { session, question };
    }
  }
  const words = await tx.objectStore('words').getAll(),
    history = await tx.objectStore('questions').index('profileId').getAll(profile.id);
  const session: Session = {
    id: uid(),
    profileId: profile.id,
    mode,
    length: profile.settings.sessionLength,
    questionIds: [],
    status: 'active',
    activeMs: 0,
    startedAt: new Date().toISOString(),
  };
  const word = chooseReview(eligibleWords(words, profile.settings, mode), history, []);
  const question = createQuestion(word, session, profile.settings);
  session.questionIds.push(question.id);
  session.currentQuestionId = question.id;
  await tx.objectStore('sessions').put(session);
  await tx.objectStore('questions').put(question);
  await tx.done;
  return { session, question };
}
export async function recordAnswer(
  questionId: string,
  answer: string,
  elapsedMs: number,
  sessionMs: number,
  blankIndex?: number,
) {
  const db = await database(),
    tx = db.transaction(['questions', 'attempts', 'sessions'], 'readwrite');
  const q = await tx.objectStore('questions').get(questionId);
  if (!q) throw new Error('Вопрос не найден.');
  const result = submitAnswer(q, answer, elapsedMs, blankIndex);
  await tx.objectStore('attempts').add(result.attempt);
  await tx.objectStore('questions').put(result.question);
  const session = await tx.objectStore('sessions').get(q.sessionId);
  if (session)
    await tx
      .objectStore('sessions')
      .put({ ...session, activeMs: Math.max(session.activeMs, sessionMs) });
  await tx.done;
  return result;
}
export async function markHelp(id: string, kind: 'hinted' | 'assisted') {
  const db = await database(),
    tx = db.transaction('questions', 'readwrite');
  const q = await tx.store.get(id);
  if (!q) throw new Error('Вопрос не найден.');
  const result = { ...q, [kind]: true };
  await tx.store.put(result);
  await tx.done;
  return result;
}
export async function saveDraft(
  id: string,
  draft: Pick<Question, 'draftTiles' | 'draftCorrection'>,
) {
  const db = await database(),
    tx = db.transaction('questions', 'readwrite'),
    q = await tx.store.get(id);
  if (!q || q.solved) {
    await tx.done;
    return;
  }
  if (
    draft.draftTiles &&
    (new Set(draft.draftTiles).size !== draft.draftTiles.length ||
      draft.draftTiles.some((id) => !q.tiles.some((t) => t.id === id)))
  )
    throw new Error('Некорректные плитки.');
  if (draft.draftCorrection !== undefined && !/^[А-ЯЁ]{1,18}$/u.test(draft.draftCorrection))
    throw new Error('Некорректная правка.');
  await tx.store.put({ ...q, ...draft });
  await tx.done;
}
export async function checkpoint(
  sessionId: string,
  questionId: string,
  sessionMs: number,
  questionMs: number,
  pause = false,
) {
  const db = await database(),
    tx = db.transaction(['sessions', 'questions'], 'readwrite');
  const s = await tx.objectStore('sessions').get(sessionId),
    q = await tx.objectStore('questions').get(questionId);
  if (s && s.status !== 'completed')
    await tx.objectStore('sessions').put({
      ...s,
      activeMs: Math.max(s.activeMs, sessionMs),
      status: pause ? 'paused' : 'active',
    });
  if (q && !q.solved)
    await tx.objectStore('questions').put({ ...q, elapsedMs: Math.max(q.elapsedMs, questionMs) });
  await tx.done;
}
export async function advance(sessionId: string, settings: Profile['settings']) {
  const db = await database(),
    tx = db.transaction(['sessions', 'questions', 'words'], 'readwrite'),
    session = await tx.objectStore('sessions').get(sessionId);
  if (!session?.currentQuestionId) throw new Error('Занятие не найдено.');
  const current = await tx.objectStore('questions').get(session.currentQuestionId);
  if (!current?.solved) throw new Error('Сначала реши текущий вопрос.');
  if (session.questionIds.length >= session.length) {
    await tx.objectStore('sessions').put({
      ...session,
      status: 'completed',
      endedAt: new Date().toISOString(),
    });
    await tx.done;
    return null;
  }
  const history = await tx.objectStore('questions').index('profileId').getAll(session.profileId),
    words = await tx.objectStore('words').getAll();
  const recent = session.questionIds.map((id) => history.find((q) => q.id === id)?.wordId ?? '');
  const word = chooseReview(eligibleWords(words, settings, session.mode), history, recent),
    question = createQuestion(word, session, settings);
  const updated = {
    ...session,
    currentQuestionId: question.id,
    questionIds: [...session.questionIds, question.id],
  };
  await tx.objectStore('questions').put(question);
  await tx.objectStore('sessions').put(updated);
  await tx.done;
  return { session: updated, question };
}
export async function resetLearning(profileId: string) {
  const db = await database(),
    tx = db.transaction(['questions', 'attempts', 'sessions'], 'readwrite');
  for (const name of ['questions', 'attempts', 'sessions'] as const) {
    const keys = await tx.objectStore(name).index('profileId').getAllKeys(profileId);
    for (const key of keys) await tx.objectStore(name).delete(key);
  }
  await tx.done;
}
