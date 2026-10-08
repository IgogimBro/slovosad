import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole, ArrowLeft } from 'lucide-react';
import { Brand } from './Brand';
export function ParentGate({ unlock }: { unlock: () => void }) {
  const [a] = useState(() => 20 + Math.floor(Math.random() * 50)),
    [b] = useState(() => 20 + Math.floor(Math.random() * 50)),
    [answer, setAnswer] = useState(''),
    [error, setError] = useState('');
  return (
    <div className="app-shell">
      <header className="header">
        <Brand />
        <Link className="secondary" to="/">
          <ArrowLeft size={18} />В сад
        </Link>
      </header>
      <main className="gate-card">
        <div className="gate-icon">
          <LockKeyhole size={30} />
        </div>
        <span className="eyebrow">ДЛЯ ВЗРОСЛЫХ</span>
        <h1>Кабинет родителя</h1>
        <p>
          Здесь живут настройки и история занятий.
          <br />
          Решите пример, чтобы открыть кабинет.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(answer) === a + b && answer.trim()) unlock();
            else setError('Ответ не совпал. Попробуйте ещё раз.');
          }}
        >
          <label className="challenge-label" htmlFor="gate-answer">
            {a} + {b} = ?
          </label>
          <input
            id="gate-answer"
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Ответ"
            autoComplete="off"
            required
          />
          <button className="primary" type="submit">
            Открыть кабинет
            <LockKeyhole size={17} />
          </button>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
        </form>
        <p className="small-muted">
          Этот вход снижает случайный доступ ребёнка. Это локальная преграда, а не защита учётной
          записи.
        </p>
      </main>
    </div>
  );
}
