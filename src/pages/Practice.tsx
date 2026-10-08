import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Volume2,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  HandHelping,
  Star,
  Check,
  Headphones,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { Brand, Owl } from '../components/Brand';
import { Spelling, Missing, Build, Correct } from '../components/Exercises';
import { ActiveClock } from '../core/clock';
import {
  advance,
  checkpoint,
  markHelp,
  recordAnswer,
  startSession,
  saveDraft,
} from '../core/storage';
import { modeInfo, type Mode, type Session, type Question } from '../core/types';
import { useSpeech } from '../core/speech';
const exercises = {
  spelling: Spelling,
  missing: Missing,
  build: Build,
  correct: Correct,
};
export function Practice() {
  const { mode: param } = useParams(),
    mode = param as Mode,
    { profile, words, refresh } = useApp(),
    navigate = useNavigate();
  const [state, setState] = useState<{
      session: Session;
      question: Question;
    } | null>(null),
    [feedback, setFeedback] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [hint, setHint] = useState(false),
    [help, setHelp] = useState(false);
  const speech = useSpeech(profile.settings),
    initial = useRef<{
      mode: Mode;
      promise: ReturnType<typeof startSession>;
    } | null>(null),
    clocks = useRef<{ q: ActiveClock; s: ActiveClock } | null>(null),
    latest = useRef(state),
    pending = useRef(false);
  latest.current = state;
  useEffect(() => {
    if (!modeInfo[mode]) {
      navigate('/', { replace: true });
      return;
    }
    let alive = true;
    if (!initial.current || initial.current.mode !== mode)
      initial.current = { mode, promise: startSession(profile, mode) };
    void initial.current.promise
      .then((next) => {
        if (!alive) return;
        clocks.current = {
          q: new ActiveClock(next.question.elapsedMs),
          s: new ActiveClock(next.session.activeMs),
        };
        if (next.question.solved) clocks.current.q.pause();
        setState(next);
        if (next.question.solved) setFeedback('Отлично! Ты справился!');
      })
      .catch((e) => {
        if (alive) setError(String(e.message));
      });
    return () => {
      alive = false;
    };
  }, [mode, profile, navigate]);
  useEffect(() => {
    const save = async (pause = false) => {
      const v = latest.current,
        c = clocks.current;
      if (v && c) await checkpoint(v.session.id, v.question.id, c.s.read(), c.q.read(), pause);
    };
    const onVisibility = () => {
      const c = clocks.current;
      if (!c) return;
      if (document.hidden) {
        c.q.pause();
        c.s.pause();
        void save(true).catch(() =>
          setError('Не удалось сохранить паузу. Попробуй вернуться домой.'),
        );
      } else {
        if (!latest.current?.question.solved) c.q.resume();
        c.s.resume();
      }
    };
    const timer = setInterval(() => {
      if (!document.hidden)
        void save().catch(() =>
          setError('Не удалось сохранить время. Проверь доступ к хранилищу.'),
        );
    }, 2000);
    document.addEventListener('visibilitychange', onVisibility);
    const onHide = () => {
      clocks.current?.q.pause();
      clocks.current?.s.pause();
      void save(true);
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      clocks.current?.q.pause();
      clocks.current?.s.pause();
      void save(true);
    };
  }, []);
  async function submit(answer: string, blank?: number) {
    if (!state || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await recordAnswer(
        state.question.id,
        answer,
        clocks.current!.q.read(),
        clocks.current!.s.read(),
        blank,
      );
      setState({ ...state, question: result.question });
      if (result.question.solved) clocks.current!.q.pause();
      setFeedback(
        result.question.solved
          ? 'Отлично! Ты справился!'
          : result.attempt.correct
            ? 'Буква на месте! Выбери следующую.'
            : result.attempt.number % 2
              ? 'Попробуй ещё раз!'
              : 'Не совсем. Давай попробуем ещё!',
      );
    } catch (e) {
      setError(`Ответ не сохранён: ${(e as Error).message}`);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function next() {
    if (!state || !state.question.solved || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await checkpoint(
        state.session.id,
        state.question.id,
        clocks.current!.s.read(),
        clocks.current!.q.read(),
      );
      const nextState = await advance(state.session.id, profile.settings);
      if (nextState) {
        clocks.current!.q = new ActiveClock(0);
        setState(nextState);
        setFeedback('');
        setHint(false);
        setHelp(false);
      } else {
        clocks.current!.s.pause();
        setDone(true);
        await refresh();
      }
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function exit() {
    if (pending.current) return;
    setBusy(true);
    speech.stop();
    try {
      if (state)
        await checkpoint(
          state.session.id,
          state.question.id,
          clocks.current!.s.read(),
          clocks.current!.q.read(),
          true,
        );
      await refresh();
      navigate('/');
    } catch (e) {
      setError(`Не удалось сохранить занятие: ${(e as Error).message}`);
      setBusy(false);
    }
  }
  async function assistance(kind: 'hinted' | 'assisted') {
    if (!state || busy) return;
    setBusy(true);
    try {
      const q = await markHelp(state.question.id, kind);
      setState({ ...state, question: q });
      if (kind === 'hinted') setHint(true);
      else setHelp(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!modeInfo[mode]) return null;
  if (done)
    return (
      <div className="app-shell">
        <header className="header">
          <Brand />
        </header>
        <main className="session-done">
          <Owl />
          <span className="eyebrow">ЕЩЁ ОДИН ШАГ ВПЕРЁД</span>
          <h1>Хорошая работа!</h1>
          <p>
            Ты решил {state?.session.length} вопросов.
            <br />
            Каждая попытка помогала учиться.
          </p>
          {profile.settings.rewards && (
            <div className="reward-stars" aria-label="Занятие завершено">
              <Star />
              <Star />
              <Star />
            </div>
          )}
          <Link className="primary" to="/">
            Вернуться в сад
            <ArrowRight size={20} />
          </Link>
        </main>
      </div>
    );
  const q = state?.question,
    Exercise = exercises[mode],
    completed = state ? state.session.questionIds.length - 1 + Number(q?.solved) : 0;
  return (
    <div className="app-shell practice-shell">
      <header className="header">
        <Brand />
        <button className="secondary exit-button" disabled={busy} onClick={() => void exit()}>
          <ArrowLeft size={18} />В сад
        </button>
      </header>
      <main className="practice-main">
        <div className="practice-topline">
          <span className={`mode-badge ${modeInfo[mode].color}`}>{modeInfo[mode].title}</span>
          <span>
            Вопрос {state?.session.questionIds.length ?? 1} из{' '}
            {state?.session.length ?? profile.settings.sessionLength}
          </span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Решено вопросов в занятии"
          aria-valuemin={0}
          aria-valuemax={state?.session.length ?? 5}
          aria-valuenow={completed}
        >
          <span
            style={{
              width: `${(completed / (state?.session.length ?? 5)) * 100}%`,
            }}
          />
        </div>
        <section className="question-card">
          <div className="question-heading">
            <span className="audio-circle">
              <Headphones size={24} />
            </span>
            <h1>{modeInfo[mode].instruction}</h1>
            <p>Можно пробовать столько раз, сколько нужно</p>
          </div>
          {q && (
            <>
              <button
                className={`audio-button ${speech.speaking ? 'playing' : ''}`}
                onClick={() =>
                  speech.speak(q.target, words.find((w) => w.id === q.wordId)?.audioRef)
                }
              >
                <Volume2 size={24} />
                {speech.speaking ? 'Слушаем слово…' : 'Послушать слово'}
              </button>
              {(!speech.available || speech.error) && (
                <p className="audio-fallback">
                  {speech.error ||
                    'Если озвучка недоступна, попроси взрослого произнести слово. Для помощи нажми кнопку ниже.'}
                </p>
              )}
              <div className="exercise-area">
                <Exercise
                  key={q.id}
                  question={q}
                  busy={busy}
                  submit={submit}
                  saveDraft={(draft) => {
                    void saveDraft(q.id, draft).catch(() =>
                      setError('Не удалось сохранить выбранные буквы. Попробуй ещё раз.'),
                    );
                  }}
                />
              </div>
              <div
                className={`feedback ${q.solved ? 'success' : ''}`}
                aria-live="polite"
                aria-atomic="true"
              >
                {feedback && (
                  <>
                    {q.solved ? <Check size={22} /> : <LeafMark />}
                    <span>{feedback}</span>
                  </>
                )}
                {q.solved && profile.settings.rewards && (
                  <Star className="success-star" size={23} />
                )}
              </div>
              {hint && (
                <div className="hint-panel">
                  <Lightbulb size={20} />
                  <span>
                    {mode === 'build'
                      ? 'Слушай слово медленно. Выбирай по одной букве. Если нужно, вернись на шаг назад.'
                      : mode === 'correct'
                        ? 'Сравни буквы по порядку. Можно убрать лишнюю, заменить букву или добавить пропущенную.'
                        : 'Послушай ещё раз. Рассмотри каждую букву по порядку и вспомни, как пишется слово.'}
                  </span>
                </div>
              )}
              {help && (
                <div className="hint-panel">
                  <HandHelping size={20} />
                  <span>
                    Позови взрослого. Помощь отмечена в истории.{' '}
                    {speech.available ? (
                      'Можно обсудить слово вместе.'
                    ) : (
                      <Link
                        to="/parent"
                        onClick={() =>
                          void checkpoint(
                            state.session.id,
                            q.id,
                            clocks.current!.s.read(),
                            clocks.current!.q.read(),
                            true,
                          )
                        }
                      >
                        Взрослый может открыть слово в кабинете.
                      </Link>
                    )}
                  </span>
                </div>
              )}
              <div className="question-support">
                {profile.settings.hints && !q.solved && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void assistance('hinted')}
                  >
                    <Lightbulb size={17} />
                    Подсказка
                  </button>
                )}
                {!q.solved && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void assistance('assisted')}
                  >
                    <HandHelping size={18} />
                    Помощь взрослого
                  </button>
                )}
                <button
                  className="text-button"
                  onClick={() =>
                    speech.speak(
                      modeInfo[mode].instruction + '. Нажми «Послушать слово». Затем выбери ответ.',
                    )
                  }
                >
                  <Volume2 size={17} />
                  Инструкция
                </button>
              </div>
              <button
                className="primary next-button"
                disabled={!q.solved || busy}
                onClick={() => void next()}
              >
                {state.session.questionIds.length >= state.session.length
                  ? 'Завершить занятие'
                  : 'Следующий вопрос'}
                <ArrowRight size={20} />
              </button>
              {!q.solved && <p className="next-note">Сначала решим этот вопрос 🌱</p>}
            </>
          )}
          {!q && !error && <p className="exercise-caption">Готовим упражнение…</p>}
          {error && (
            <div className="error-message" role="alert">
              {error}
              {!state && (
                <button className="text-button" onClick={() => void exit()}>
                  Вернуться в сад
                </button>
              )}
            </div>
          )}
        </section>
        <p className="practice-footer">У каждого слова свой рост. У каждого человека свой темп.</p>
      </main>
    </div>
  );
}
function LeafMark() {
  return <span aria-hidden="true">🌱</span>;
}
