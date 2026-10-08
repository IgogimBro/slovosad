import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ChartNoAxesCombined,
  History as HistoryIcon,
  BookOpen,
  SlidersHorizontal,
  Download,
  Check,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../AppContext';
import { Brand } from '../components/Brand';
import { ParentGate } from '../components/ParentGate';
import {
  csvExport,
  questionCsvExport,
  dayKey,
  errorLabels,
  groups,
  summarize,
} from '../core/analytics';
import { wordProgress, reviewScore } from '../core/adaptive';
import {
  defaultSettings,
  modeInfo,
  normalize,
  uid,
  type Word,
  type Profile,
  type Difficulty,
  type Mode,
  type Settings,
} from '../core/types';
import { classifyError, categoryEmoji } from '../core/words';
import { hideWord, saveWord, saveProfile, resetLearning } from '../core/storage';
import { useSpeech } from '../core/speech';
const fmt = (n: number | null, unit = '') => (n === null ? '—' : `${Number(n.toFixed(1))}${unit}`);
const dateLabel = (stamp: string) =>
  new Date(stamp).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
const chartTooltip = {
  contentStyle: { borderRadius: 14, border: '1px solid #e1e8e1' },
  cursor: { fill: '#eaf1ed' },
};
export function Parent() {
  const app = useApp(),
    location = useLocation(),
    tab = location.pathname.split('/')[2] || 'overview';
  const [error, setError] = useState('');
  useEffect(() => {
    if (app.parentOpen)
      void app
        .refresh()
        .catch(() => setError('Не удалось прочитать историю. Перезагрузите приложение.'));
  }, [app.parentOpen]);
  if (!app.parentOpen) return <ParentGate unlock={() => app.setParentOpen(true)} />;
  return (
    <div className="app-shell parent-shell">
      <header className="header">
        <Brand />
        <Link className="secondary" to="/" onClick={() => app.setParentOpen(false)}>
          <ArrowLeft size={18} />
          Вернуться в сад
        </Link>
      </header>
      <main className="parent-main">
        <div className="parent-title">
          <div>
            <span className="eyebrow">КАБИНЕТ РОДИТЕЛЯ</span>
            <h1>
              Маленькие шаги видны<span>.</span>
            </h1>
            <p>История и настройки · {app.profile.name}</p>
          </div>
          <button
            className="secondary"
            onClick={() =>
              download(
                'slovosad-attempts.csv',
                csvExport(app.history.attempts),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download size={18} />
            Попытки CSV
          </button>
          <button
            className="secondary"
            onClick={() =>
              download(
                'slovosad-questions.csv',
                questionCsvExport(app.history.questions),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download size={18} />
            Вопросы CSV
          </button>
        </div>
        <nav className="parent-tabs" aria-label="Кабинет родителя">
          {[
            ['overview', 'Обзор', ChartNoAxesCombined],
            ['history', 'История', HistoryIcon],
            ['words', 'Словарь', BookOpen],
            ['settings', 'Настройки', SlidersHorizontal],
          ].map(([id, label, Icon]) => {
            const I = Icon as typeof BookOpen;
            return (
              <NavLink key={String(id)} className={tab === id ? 'active' : ''} to={`/parent/${id}`}>
                <I size={18} />
                {String(label)}
              </NavLink>
            );
          })}
        </nav>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {tab === 'overview' ? (
          <Overview />
        ) : tab === 'history' ? (
          <PracticeHistory />
        ) : tab === 'words' ? (
          <Vocabulary />
        ) : (
          <ParentSettings />
        )}
        <p className="parent-privacy">
          <ShieldCheck size={17} />
          Данные хранятся только в этом браузере. У каждого профиля своя история. CSV содержит
          данные выбранного профиля.
        </p>
      </main>
    </div>
  );
}
function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Overview() {
  const { history, words } = useApp(),
    stats = summarize(history);
  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    const key = dayKey(d.toISOString()),
      qs = history.questions.filter((q) => q.solved && dayKey(q.completedAt!) === key);
    return {
      name: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      completed: qs.length,
    };
  });
  const weekly = groups(history.questions, (q) => {
    const d = new Date(q.completedAt!);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return dayKey(d.toISOString());
  })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(-8)
    .map((g) => ({
      ...g,
      name: new Date(g.name + 'T12:00:00').toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
      }),
    }));
  const modes = groups(history.questions, (q) => modeInfo[q.mode].title),
    levels = groups(
      history.questions,
      (q) => ['', 'Начальный', 'Средний', 'Продвинутый'][q.difficulty],
    ),
    assistance = groups(history.questions, (q) =>
      q.hinted || q.assisted ? 'С помощью' : 'Самостоятельно',
    );
  const errors = Object.entries(
    history.attempts
      .filter((a) => !a.correct)
      .reduce<Record<string, number>>((r, a) => {
        const name = errorLabels[a.errorKind ?? 'other'];
        r[name] = (r[name] || 0) + 1;
        return r;
      }, {}),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const pairs = Object.entries(
    history.attempts
      .filter((a) => a.confusionPair)
      .reduce<Record<string, number>>((r, a) => {
        r[a.confusionPair!] = (r[a.confusionPair!] || 0) + 1;
        return r;
      }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const practiced = words.filter((w) =>
      history.questions.some((q) => q.wordId === w.id && q.solved),
    ),
    difficult = practiced
      .filter((w) =>
        history.questions.some(
          (q) => q.wordId === w.id && q.solved && (q.mistakeCount || q.hinted || q.assisted),
        ),
      )
      .sort((a, b) => reviewScore(b, history.questions) - reviewScore(a, history.questions))
      .slice(0, 5);
  const retained = practiced.filter((w) => wordProgress(w.id, history.questions).streak >= 3);
  const improved = practiced.filter((w) => {
    const qs = wordProgress(w.id, history.questions).done.slice(-6);
    return (
      qs.length === 6 &&
      new Set(qs.map((q) => q.sessionId)).size >= 3 &&
      qs.slice(-3).filter((q) => q.firstAttemptCorrect && !q.hinted && !q.assisted).length >
        qs.slice(0, 3).filter((q) => q.firstAttemptCorrect && !q.hinted && !q.assisted).length
    );
  });
  const due = practiced
    .filter((w) => {
      const d = wordProgress(w.id, history.questions).dueAt;
      return d && d.getTime() <= Date.now();
    })
    .sort((a, b) => reviewScore(b, history.questions) - reviewScore(a, history.questions))
    .slice(0, 8);
  return (
    <>
      <div className="metric-grid">
        {[
          ['Решено сегодня', stats.today, 'Все завершённые вопросы'],
          [
            'С первой попытки',
            fmt(stats.firstAccuracy, '%'),
            `${stats.completed} завершённых вопросов · за всё время`,
          ],
          ['Попыток на вопрос', fmt(stats.avgAttempts), 'Среднее среди завершённых'],
          ['Время занятий', fmt(stats.activeMs / 60000, ' мин'), 'Видимое активное время'],
        ].map(([label, value, caption]) => (
          <article className="metric-card" key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{caption}</small>
          </article>
        ))}
      </div>
      {!stats.attempts && (
        <div className="empty-state">
          <span>🌱</span>
          <h2>Первое занятие — начало истории</h2>
          <p>После практики здесь появятся результаты. Сейчас данных ещё нет.</p>
          <Link className="primary" to="/">
            Начать практику
          </Link>
        </div>
      )}
      {stats.completed > 0 && stats.completed < 20 && (
        <p className="sample-note">
          Пока завершено {stats.completed} вопросов. Это небольшая выборка: смотрите на отдельные
          попытки и повторение в разные дни, прежде чем делать выводы.
        </p>
      )}
      <div className="dashboard-grid">
        <ChartCard title="День за днём" subtitle="Завершённые вопросы · последние 14 дней">
          <ResponsiveContainer width="100%" height={225}>
            <BarChart data={daily}>
              <CartesianGrid vertical={false} stroke="#edf0ea" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={2} />
              <YAxis allowDecimals={false} width={25} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="completed" name="Решено" fill="#6c9b86" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="С первой попытки" subtitle="По неделям · только завершённые вопросы">
          {weekly.length ? (
            <ResponsiveContainer width="100%" height={225}>
              <LineChart data={weekly}>
                <CartesianGrid vertical={false} stroke="#edf0ea" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" width={45} />
                <Tooltip {...chartTooltip} />
                <Line
                  dataKey="accuracy"
                  name="С первой попытки, %"
                  stroke="#6c9b86"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </ChartCard>
        <ChartCard
          title="Какие ошибки встречаются"
          subtitle="Все неверные попытки, включая повторные"
        >
          {errors.length ? (
            <ResponsiveContainer width="100%" height={225}>
              <BarChart data={errors} layout="vertical">
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 11 }} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="count" name="Ошибки" fill="#d1a174" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </ChartCard>
        <ChartCard
          title="Усилия по упражнениям"
          subtitle="Среднее число попыток на завершённый вопрос"
        >
          {modes.length ? (
            <ResponsiveContainer width="100%" height={225}>
              <BarChart data={modes} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={116} tick={{ fontSize: 10 }} />
                <Tooltip {...chartTooltip} />
                <Bar
                  dataKey="attempts"
                  name="Среднее попыток"
                  fill="#aa9ac4"
                  radius={[0, 5, 5, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </ChartCard>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Слова для спокойного повторения</h2>
          <p className="small-muted">Больше попыток или использована помощь</p>
          {difficult.length ? (
            difficult.map((w) => {
              const qs = wordProgress(w.id, history.questions).done;
              return (
                <div className="word-insight" key={w.id}>
                  <strong>{w.spelling}</strong>
                  <span>
                    {qs.reduce((n, q) => n + q.mistakeCount, 0)} ошибок · {qs.length} вопросов
                  </span>
                </div>
              );
            })
          ) : (
            <p className="small-muted">Пока нет слов, требующих дополнительного повторения.</p>
          )}
          <h3>Повторение по расписанию</h3>
          <p>
            {due.length
              ? due.map((w) => w.spelling).join(' · ')
              : 'Пока нет слов с наступившим сроком повторения.'}
          </p>
        </section>
        <section className="panel">
          <h2>Что уже получается</h2>
          <p className="small-muted">
            Устойчивый результат: без ошибок и помощи в трёх разных занятиях подряд
          </p>
          <p>
            {retained.length
              ? retained.map((w) => w.spelling).join(' · ')
              : 'Нужно больше самостоятельных повторений в разных занятиях.'}
          </p>
          <h3>Недавнее улучшение</h3>
          <p>
            {improved.length
              ? improved.map((w) => w.spelling).join(' · ')
              : 'Пока недостаточно данных для сравнения.'}
          </p>
          <p className="small-muted">
            Сравниваем последние 3 вопроса с предыдущими 3; нужны минимум 3 разных занятия. Это
            наблюдение, а не доказательство усвоения.
          </p>
        </section>
      </div>
      <section className="panel stats-detail">
        <h2>Все результаты</h2>
        <dl>
          {[
            ['Завершено вопросов', stats.completed],
            ['Всего попыток', stats.attempts],
            ['Неверных попыток', stats.mistakes],
            ['Точность попыток', fmt(stats.attemptAccuracy, '%')],
            ['Незаконченных вопросов', stats.unfinished],
            [
              'Среднее время до решения',
              fmt(stats.avgMs === null ? null : stats.avgMs / 1000, ' с'),
            ],
            [
              'Медианное время до решения',
              fmt(stats.medianMs === null ? null : stats.medianMs / 1000, ' с'),
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="small-muted">
          Точность попыток считает все нажатия. Точность с первой попытки — вопросы без ошибок при
          первом ответе на каждую часть. В задании с двумя пропусками нужны как минимум две попытки.
          Паузы и скрытая вкладка исключаются из времени.
        </p>
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Помощь и сложность</h2>
          <ResultsTable rows={[...assistance, ...levels, ...modes]} />
        </section>
        <section className="panel">
          <h2>Буквы, которые путаются</h2>
          {pairs.length ? (
            pairs.slice(0, 10).map(([pair, count]) => (
              <div className="word-insight" key={pair}>
                <strong>{pair}</strong>
                <span>{count} неверных попыток</span>
              </div>
            ))
          ) : (
            <p className="small-muted">Пока нет ошибок с заменой одной буквы.</p>
          )}
          <p className="small-muted">
            Время ответа не оценивает способности ребёнка. Длинный ответ лишь немного повышает
            приоритет повторения.
          </p>
        </section>
      </div>
      <IndividualProgress />
    </>
  );
}
function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel chart-panel">
      <h2>{title}</h2>
      <p className="small-muted">{subtitle}</p>
      {children}
    </section>
  );
}
function ChartEmpty() {
  return <div className="chart-empty">Данные появятся после практики</div>;
}
function ResultsTable({ rows }: { rows: ReturnType<typeof groups> }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Группа</th>
            <th>Решено</th>
            <th>С первой попытки</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.name + i}>
              <td>{row.name}</td>
              <td>{row.completed}</td>
              <td>
                {row.accuracy}% ({row.first}/{row.completed})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="small-muted">Результатов пока нет.</p>}
    </div>
  );
}
function IndividualProgress() {
  const { history, words } = useApp(),
    practiced = words.filter((w) => history.questions.some((q) => q.wordId === w.id));
  const [id, setId] = useState(''),
    selected = id || practiced[0]?.id,
    progress = wordProgress(selected ?? '', history.questions);
  const data = progress.done.map((q, i) => ({
    name: String(i + 1),
    attempts: q.attemptCount,
    first: q.firstAttemptCorrect ? 100 : 0,
  }));
  return (
    <section className="panel">
      <h2>История одного слова</h2>
      <select
        aria-label="Слово для просмотра прогресса"
        value={selected ?? ''}
        onChange={(e) => setId(e.target.value)}
        disabled={!practiced.length}
      >
        {!practiced.length && <option>Пока нет слов</option>}
        {practiced.map((w) => (
          <option key={w.id} value={w.id}>
            {w.spelling}
          </option>
        ))}
      </select>
      {data.length ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid vertical={false} stroke="#edf0ea" />
              <XAxis
                dataKey="name"
                label={{
                  value: 'Порядок завершённых вопросов',
                  position: 'insideBottom',
                  offset: -1,
                }}
                height={40}
              />
              <YAxis allowDecimals={false} width={30} />
              <Tooltip {...chartTooltip} />
              <Line dataKey="attempts" name="Попыток до решения" stroke="#6c9b86" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
          <p className="small-muted">
            {progress.done.length} завершений ·{' '}
            {new Set(progress.done.map((q) => q.sessionId)).size} разных занятий ·{' '}
            {progress.retentionSessions} самостоятельных занятий подряд. Следующее повторение:{' '}
            {progress.dueAt?.toLocaleDateString('ru-RU')}.
          </p>
        </>
      ) : (
        <ChartEmpty />
      )}
    </section>
  );
}
function PracticeHistory() {
  const { history } = useApp(),
    [mode, setMode] = useState('all'),
    [status, setStatus] = useState('all');
  const qs = history.questions
    .filter(
      (q) =>
        (mode === 'all' || q.mode === mode) &&
        (status === 'all' || (status === 'done' ? q.solved : !q.solved)),
    )
    .sort((a, b) => b.presentedAt.localeCompare(a.presentedAt));
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Каждая попытка имеет значение</h2>
          <p className="small-muted">Откройте вопрос, чтобы увидеть все ответы по порядку.</p>
        </div>
        <div className="filter-row">
          <select
            aria-label="Фильтр упражнений"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="all">Все упражнения</option>
            {Object.entries(modeInfo).map(([id, m]) => (
              <option key={id} value={id}>
                {m.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Статус вопроса"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Все вопросы</option>
            <option value="done">Завершённые</option>
            <option value="incomplete">Незаконченные</option>
          </select>
        </div>
      </div>
      {!qs.length && <ChartEmpty />}
      {qs.map((q) => {
        const attempts = history.attempts
          .filter((a) => a.questionId === q.id)
          .sort((a, b) => a.number - b.number);
        return (
          <details className="question-history" key={q.id}>
            <summary>
              <div>
                <strong>{q.target}</strong>
                <small>
                  {modeInfo[q.mode].title} · {dateLabel(q.presentedAt)}
                </small>
              </div>
              <span className={`result-pill ${q.solved ? 'done' : 'incomplete'}`}>
                {q.solved ? 'Решено' : 'Не завершён'}
              </span>
              <span>{q.attemptCount} попыток</span>
            </summary>
            <div className="history-details">
              <div className="history-meta">
                <span>Задание: {q.prompt}</span>
                <span>Сложность: {q.difficulty}</span>
                <span>
                  Первая попытка:{' '}
                  {q.solved
                    ? q.firstAttemptCorrect
                      ? 'без ошибок'
                      : 'с ошибкой'
                    : 'пока не завершён'}
                </span>
                <span>Время: {fmt(q.elapsedMs / 1000, ' с')}</span>
                <span>
                  Подсказка: {q.hinted ? 'да' : 'нет'} · взрослый: {q.assisted ? 'да' : 'нет'}
                </span>
              </div>
              {attempts.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Ответ</th>
                        <th>Результат</th>
                        <th>С начала</th>
                        <th>После предыдущей</th>
                        <th>Помощь до ответа</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attempts.map((a) => (
                        <tr key={a.id}>
                          <td>{a.number}</td>
                          <td>
                            <strong>{a.answer}</strong>
                            {a.blankIndex !== undefined && (
                              <small> · позиция {a.blankIndex + 1}</small>
                            )}
                          </td>
                          <td>{a.correct ? 'Верно' : errorLabels[a.errorKind ?? 'other']}</td>
                          <td>{fmt(a.elapsedMs / 1000, ' с')}</td>
                          <td>{fmt(a.sincePreviousMs / 1000, ' с')}</td>
                          <td>
                            {a.hinted ? 'подсказка ' : ''}
                            {a.assisted ? 'взрослый' : ''}
                            {!a.hinted && !a.assisted ? 'без помощи' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small-muted">Ответов пока нет. Вопрос сохранён как незаконченный.</p>
              )}
            </div>
          </details>
        );
      })}
    </section>
  );
}
function Vocabulary() {
  const { words, refresh } = useApp(),
    [edit, setEdit] = useState<Word | null>(null),
    [adding, setAdding] = useState(false),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [archived, setArchived] = useState(false),
    [error, setError] = useState('');
  const categories = [...new Set(words.map((w) => w.category))].sort();
  const list = words.filter(
    (w) =>
      Boolean(w.hidden) === archived &&
      w.spelling.includes(normalize(query)) &&
      (category === 'all' || w.category === category),
  );
  async function toggle(word: Word) {
    try {
      await hideWord(word.id, !word.hidden);
      await refresh();
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Словарь для практики</h2>
          <p className="small-muted">
            {words.filter((w) => !w.hidden).length} активных слов · Ё и Е считаются разными буквами
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setAdding(true);
            setEdit(null);
          }}
        >
          <Plus size={18} />
          Добавить слово
        </button>
      </div>
      <div className="filter-row">
        <input
          aria-label="Поиск слова"
          placeholder="Найти слово…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Категория слов"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Все категории</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="check-label">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Архив
        </label>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {(adding || edit) && (
        <WordEditor
          word={edit}
          onClose={() => {
            setAdding(false);
            setEdit(null);
          }}
          onSave={async () => {
            await refresh();
            setAdding(false);
            setEdit(null);
          }}
        />
      )}
      <div className="table-scroll">
        <table className="vocabulary-table">
          <thead>
            <tr>
              <th>Слово</th>
              <th>Категория</th>
              <th>Сложность</th>
              <th>Режимов</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {list.map((w) => (
              <tr key={w.id}>
                <td>
                  <span>{w.illustration || '🌱'}</span> <strong>{w.spelling}</strong>
                  {w.custom && <small> своё</small>}
                </td>
                <td>{w.category}</td>
                <td>{['', 'Начальная', 'Средняя', 'Продвинутая'][w.difficulty]}</td>
                <td>{w.modes.length}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`Редактировать ${w.spelling}`}
                      onClick={() => {
                        setEdit(w);
                        setAdding(false);
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`${w.hidden ? 'Восстановить' : 'Убрать'} ${w.spelling}`}
                      onClick={() => void toggle(w)}
                    >
                      {w.hidden ? <RotateCcw size={17} /> : <Archive size={17} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <ChartEmpty />}
      </div>
      <p className="small-muted">
        Удалённые из практики слова остаются в архиве: история ответов сохраняется. Неверные
        варианты проверяет взрослый; автоматическая проверка исключает только слова, уже известные
        этому словарю.
      </p>
    </section>
  );
}
function WordEditor({
  word,
  onClose,
  onSave,
}: {
  word: Word | null;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const { words } = useApp(),
    [spelling, setSpelling] = useState(word?.spelling ?? ''),
    [category, setCategory] = useState(word?.category ?? 'Мои слова'),
    [difficulty, setDifficulty] = useState<Difficulty>(word?.difficulty ?? 1),
    [wrong, setWrong] = useState(word?.distractors.map((d) => d.text).join(', ') ?? ''),
    [modes, setModes] = useState<Mode[]>(word?.modes ?? ['build', 'missing']),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="word-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const target = normalize(spelling),
            distractors = wrong
              .split(',')
              .map(normalize)
              .filter(Boolean)
              .map((text) => ({ text, kind: classifyError(target, text) }));
          const result: Word = {
            id: word?.id ?? uid(),
            spelling: target,
            category: category.trim(),
            difficulty,
            distractors,
            modes,
            confusions: [...new Set(distractors.map((d) => d.kind))],
            illustration: categoryEmoji[category] ?? '🌱',
            custom: word?.custom ?? true,
            hidden: word?.hidden ?? false,
          };
          await saveWord(result);
          await onSave();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{word ? 'Редактировать слово' : 'Новое слово'}</h3>
      <div className="form-grid">
        <label>
          Правильное написание
          <input
            value={spelling}
            onChange={(e) => setSpelling(e.target.value)}
            required
            maxLength={16}
          />
        </label>
        <label>
          Категория
          <input
            list="categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          />
          <datalist id="categories">
            {[...new Set(words.map((w) => w.category))].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          Сложность
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value) as Difficulty)}
          >
            <option value={1}>Начальная</option>
            <option value={2}>Средняя</option>
            <option value={3}>Продвинутая</option>
          </select>
        </label>
        <label>
          Неверные написания через запятую
          <input
            value={wrong}
            onChange={(e) => setWrong(e.target.value)}
            placeholder="Три разных неверных варианта"
          />
        </label>
      </div>
      <p className="small-muted">
        Для выбора написания и исправления нужны три проверенных неверных варианта. Не добавляйте
        другие настоящие слова, имена или допустимые формы слова.
      </p>
      <div className="filter-row">
        {(Object.keys(modeInfo) as Mode[]).map((m) => (
          <label className="check-label" key={m}>
            <input
              type="checkbox"
              checked={modes.includes(m)}
              onChange={(e) =>
                setModes(e.target.checked ? [...modes, m] : modes.filter((x) => x !== m))
              }
            />
            {modeInfo[m].title}
          </label>
        ))}
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="edit-controls">
        <button className="primary" type="submit" disabled={busy}>
          <Check size={17} />
          Сохранить
        </button>
        <button className="secondary" type="button" onClick={onClose}>
          Отмена
        </button>
      </div>
    </form>
  );
}
function ParentSettings() {
  const { profile, profiles, words, history, updateProfile, switchProfile, refresh } = useApp(),
    [settings, setSettings] = useState<Settings>({ ...profile.settings }),
    [name, setName] = useState(profile.name),
    [newName, setNewName] = useState(''),
    [saved, setSaved] = useState(''),
    [error, setError] = useState(''),
    [reset, setReset] = useState(false),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false);
  const speech = useSpeech(settings),
    categories = [...new Set(words.filter((w) => !w.hidden).map((w) => w.category))].sort();
  useEffect(() => {
    setSettings({ ...profile.settings });
    setName(profile.name);
    setSaved('');
  }, [profile.id]);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings({ ...settings, [key]: value });
    setSaved('');
  };
  const activeQuestions = history.questions
    .filter((q) => !q.solved && q.assisted)
    .sort((a, b) => b.presentedAt.localeCompare(a.presentedAt));
  async function addProfile() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const p: Profile = {
        id: uid(),
        name: newName.trim().slice(0, 30),
        settings: { ...defaultSettings },
        createdAt: new Date().toISOString(),
      };
      await saveProfile(p);
      await switchProfile(p.id);
      setNewName('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form
        className="panel settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          if (!settings.modes.length) {
            setError('Оставьте хотя бы один режим.');
            setBusy(false);
            return;
          }
          try {
            await updateProfile({
              ...profile,
              name: name.trim() || 'Ученик',
              settings,
            });
            setSaved('Настройки сохранены. Новые вопросы будут использовать эти настройки.');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Практика в подходящем темпе</h2>
        <p className="small-muted">
          Уровень выбирается по навыкам, а не по возрасту. Незаконченные вопросы сохраняют свои
          варианты.
        </p>
        <div className="form-grid">
          <label>
            Имя или псевдоним
            <input maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Уровень
            <select
              value={settings.difficulty}
              onChange={(e) => set('difficulty', Number(e.target.value) as Difficulty)}
            >
              <option value={1}>Начальный · короткие слова</option>
              <option value={2}>Средний · до 6 букв</option>
              <option value={3}>Продвинутый · два пропуска</option>
            </select>
          </label>
          <label>
            Количество вариантов
            <select
              value={settings.choices}
              onChange={(e) => set('choices', Number(e.target.value) as Settings['choices'])}
            >
              <option value={0}>По уровню: 2 / 3 / 4</option>
              <option value={2}>2 варианта</option>
              <option value={3}>3 варианта</option>
              <option value={4}>4 варианта</option>
            </select>
          </label>
          <label>
            Вопросов в новом занятии
            <select
              value={settings.sessionLength}
              onChange={(e) => set('sessionLength', Number(e.target.value))}
            >
              {[3, 5, 8, 10, 15].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Скорость речи: {settings.rate}
            <input
              type="range"
              min="0.5"
              max="1.2"
              step="0.1"
              value={settings.rate}
              onChange={(e) => set('rate', Number(e.target.value))}
            />
          </label>
          <label>
            Громкость: {Math.round(settings.volume * 100)}%
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.volume}
              onChange={(e) => set('volume', Number(e.target.value))}
            />
          </label>
        </div>
        <button
          className="secondary"
          type="button"
          onClick={() => speech.speak('Привет! Давай играть со словами.')}
        >
          Проверить русский голос
        </button>
        {speech.error && (
          <p className="small-muted" role="status">
            {speech.error}
          </p>
        )}
        <fieldset>
          <legend>Доступные игры</legend>
          <div className="filter-row">
            {(Object.keys(modeInfo) as Mode[]).map((m) => (
              <label className="check-label" key={m}>
                <input
                  type="checkbox"
                  checked={settings.modes.includes(m)}
                  onChange={(e) =>
                    set(
                      'modes',
                      e.target.checked
                        ? [...settings.modes, m]
                        : settings.modes.filter((x) => x !== m),
                    )
                  }
                />
                {modeInfo[m].title}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Категории · ничего не выбрано = все</legend>
          <div className="filter-row">
            {categories.map((c) => (
              <label className="check-label" key={c}>
                <input
                  type="checkbox"
                  checked={settings.categories.includes(c)}
                  onChange={(e) =>
                    set(
                      'categories',
                      e.target.checked
                        ? [...settings.categories, c]
                        : settings.categories.filter((x) => x !== c),
                    )
                  }
                />
                {c}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="filter-row">
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.hints}
              onChange={(e) => set('hints', e.target.checked)}
            />
            Разрешить подсказки
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.rewards}
              onChange={(e) => set('rewards', e.target.checked)}
            />
            Мягкие награды и анимации
          </label>
        </div>
        <p className="small-muted">
          Адаптация повторяет трудные слова чаще, избегая двух последних слов при достаточном
          словаре. Самостоятельные решения в разных занятиях увеличивают интервал: 1, 3, 7, 14 и 30
          дней. Произношение не всегда определяет написание: безударные гласные требуют знакомства
          со словом. Подсказки не раскрывают ответ.
        </p>
        <button className="primary" type="submit" disabled={busy}>
          <Check size={18} />
          Сохранить настройки
        </button>
        {saved && (
          <p className="saved-message" role="status">
            {saved}
          </p>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </form>
      {activeQuestions.length > 0 && (
        <section className="panel">
          <h2>Озвучка с помощью взрослого</h2>
          <p className="small-muted">
            Незаконченные вопросы, где ребёнок запросил помощь. Произнесите слово, не показывая
            написание; помощь уже отмечена.
          </p>
          {activeQuestions.map((q) => (
            <div className="word-insight" key={q.id}>
              <strong>{q.target}</strong>
              <span>{modeInfo[q.mode].title}</span>
            </div>
          ))}
        </section>
      )}
      <section className="panel">
        <h2>Профили на этом устройстве</h2>
        <p className="small-muted">
          Псевдонима достаточно. Словарь общий, история и настройки разделены.
        </p>
        <div className="profile-selector">
          {profiles.map((p) => (
            <button
              className={`secondary ${p.id === profile.id ? 'selected-profile' : ''}`}
              key={p.id}
              disabled={busy}
              onClick={() => void switchProfile(p.id).catch((e) => setError(String(e)))}
            >
              {p.name}
              {p.id === profile.id && <Check size={16} />}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <input
            aria-label="Имя нового профиля"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Новый псевдоним"
            maxLength={30}
          />
          <button
            className="secondary"
            disabled={busy || !newName.trim()}
            onClick={() => void addProfile()}
          >
            <Plus size={18} />
            Создать профиль
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>Сохранение и удаление</h2>
        <p>
          История доступна только на этом устройстве и в этом браузере. Очистка данных сайта или
          удаление браузера может удалить её. Регулярно сохраняйте CSV через кнопку вверху.
        </p>
        <p className="small-muted">
          Приложение не отправляет историю на сервер. Доступность и работа русского голоса офлайн
          зависят от системы; браузер может использовать сетевой голос. Обновление приложения
          предлагается на главной странице, чтобы не прерывать упражнение.
        </p>
        <button className="secondary danger" onClick={() => setReset(!reset)}>
          Удалить историю профиля «{profile.name}»
        </button>
        {reset && (
          <div className="reset-confirm">
            <p>
              Будут удалены все занятия, вопросы и попытки только этого профиля. Настройки и словарь
              сохранятся. Для подтверждения введите <strong>УДАЛИТЬ</strong>.
            </p>
            <input
              aria-label="Подтверждение удаления истории"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
            <button
              className="secondary danger"
              disabled={confirmation !== 'УДАЛИТЬ' || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await resetLearning(profile.id);
                  await refresh();
                  setReset(false);
                  setConfirmation('');
                  setSaved('История выбранного профиля удалена.');
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Подтвердить удаление
            </button>
          </div>
        )}
      </section>
    </>
  );
}
