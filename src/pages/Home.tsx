import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Headphones,
  Star,
  Leaf,
  LockKeyhole,
  Puzzle,
  PencilLine,
  AudioLines,
  CircleHelp,
} from 'lucide-react';
import { Brand, Owl } from '../components/Brand';
import { OfflineNotice } from '../components/OfflineNotice';
import { useApp } from '../AppContext';
import { summarize } from '../core/analytics';
import { eligibleWords } from '../core/engine';
import { modeInfo, type Mode } from '../core/types';
const icons = {
  spelling: AudioLines,
  missing: CircleHelp,
  build: Puzzle,
  correct: PencilLine,
};
export function Home() {
  const { profile, words, history, refresh } = useApp(),
    stats = summarize(history);
  const [error, setError] = useState('');
  useEffect(() => {
    void refresh().catch(() => setError('Не удалось обновить историю. Перезагрузи приложение.'));
  }, []);
  const paused = history.sessions
    .filter((s) => s.status !== 'completed')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  return (
    <div className="app-shell">
      <header className="header">
        <Brand />
        <div className="header-right">
          <span className="profile-badge">
            <span className="avatar">
              <Leaf size={18} />
            </span>
            {profile.name}
          </span>
          <Link className="parent-link" to="/parent">
            <LockKeyhole size={17} />
            Для родителей
          </Link>
        </div>
      </header>
      <main className="home-main">
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-leaf">✦</span> УЧИМСЯ В СВОЁМ ТЕМПЕ
            </span>
            <h1>
              Каждая буква —<br />
              маленькое открытие<span>.</span>
            </h1>
            <p>
              Слушай, пробуй и играй со словами.
              <br />
              Здесь можно попробовать столько раз, сколько нужно.
            </p>
            <div className="hero-chips">
              <span>
                <Headphones size={16} />
                Слушаем
              </span>
              <span>
                <Puzzle size={16} />
                Играем
              </span>
              <span>
                <Leaf size={16} />
                Растём
              </span>
            </div>
          </div>
          <div className="hero-art">
            <span className="floating-letter letter-a">А</span>
            <span className="floating-letter letter-b">Б</span>
            <span className="floating-letter letter-v">В</span>
            <Owl />
            <span className="owl-caption">Маленькие шаги. Большие открытия.</span>
          </div>
        </section>
        <section className="today-strip" aria-label="Прогресс сегодня">
          <div className="today-label">
            <span className="star-circle">
              <Star size={23} />
            </span>
            <div>
              <strong>Сегодня в саду</strong>
              <small>
                {stats.today
                  ? 'Каждое решённое слово — новый шаг'
                  : 'Начнём с одного маленького шага'}
              </small>
            </div>
          </div>
          <div className="today-number">
            <strong>{stats.today}</strong>
            <span>вопросов решено</span>
          </div>
          <div className="today-number">
            <strong>{stats.firstAccuracy === null ? '—' : `${stats.firstAccuracy}%`}</strong>
            <span>с первой попытки · за всё время</span>
          </div>
          <div className="gentle-note">
            Без спешки.
            <br />
            Всё получится 🌱
          </div>
        </section>
        {paused && (
          <Link className="resume-banner" to={`/practice/${paused.mode}`}>
            <span>
              <strong>Продолжим?</strong> Незаконченное занятие сохранено ·{' '}
              {modeInfo[paused.mode].title}
            </span>
            <ArrowRight size={22} />
          </Link>
        )}
        <section className="games">
          <div className="section-heading">
            <div>
              <span className="eyebrow muted">ТВОЯ ПРАКТИКА</span>
              <h2>Во что будем играть?</h2>
            </div>
            <span className="session-pill">
              {profile.settings.sessionLength} вопросов в занятии
            </span>
          </div>
          <div className="game-grid">
            {(Object.keys(modeInfo) as Mode[])
              .filter((mode) => profile.settings.modes.includes(mode))
              .map((mode, index) => {
                const info = modeInfo[mode],
                  Icon = icons[mode],
                  eligible = eligibleWords(words, profile.settings, mode).length;
                return (
                  <article
                    key={mode}
                    className={`game-card ${info.color} ${index === 0 ? 'featured' : ''}`}
                  >
                    <div className="card-top">
                      <span className="game-icon">
                        <Icon size={27} />
                      </span>
                      {mode === 'spelling' && <span className="recommended">Начни отсюда</span>}
                      <span className="game-no">0{index + 1}</span>
                    </div>
                    <h3>{info.title}</h3>
                    <p>{info.description}</p>
                    <div className="game-card-bottom">
                      {eligible ? (
                        <Link
                          className={`play-link ${mode === 'spelling' ? 'solid' : ''}`}
                          to={`/practice/${mode}`}
                        >
                          Играть
                          <ArrowRight size={20} />
                        </Link>
                      ) : (
                        <span className="small-muted">
                          Нет слов для этих настроек. Открой кабинет родителя.
                        </span>
                      )}
                      <span className="card-decoration" aria-hidden="true">
                        {mode === 'spelling'
                          ? 'Аа'
                          : mode === 'missing'
                            ? '_'
                            : mode === 'build'
                              ? 'Б А'
                              : '✓'}
                      </span>
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
        <section className="comfort-note">
          <ShieldCheck size={22} />
          <p>
            <strong>Место, где можно ошибаться.</strong> Каждая попытка помогает учиться. Следующий
            вопрос появится, когда ты справишься с этим.
          </p>
        </section>
      </main>
      <footer className="footer">
        <Brand />
        <span>Слова растут вместе с тобой.</span>
        <OfflineNotice />
      </footer>
    </div>
  );
}
