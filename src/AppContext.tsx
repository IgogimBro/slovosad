import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initialize, getHistory, selectProfile, saveProfile } from './core/storage';
import type { History, Profile, Word } from './core/types';
interface Context {
  profile: Profile;
  profiles: Profile[];
  words: Word[];
  history: History;
  refresh: () => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  updateProfile: (p: Profile) => Promise<void>;
  parentOpen: boolean;
  setParentOpen: (v: boolean) => void;
}
const AppContext = createContext<Context | null>(null);
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('Application not ready');
  return ctx;
};
export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof initialize>> | null>(null),
    [history, setHistory] = useState<History>({
      questions: [],
      attempts: [],
      sessions: [],
    }),
    [error, setError] = useState(''),
    [parentOpen, setParentOpen] = useState(false);
  async function refresh() {
    const next = await initialize();
    const h = await getHistory(next.active.id);
    setData(next);
    setHistory(h);
  }
  useEffect(() => {
    void refresh().catch(() =>
      setError(
        'Не удалось открыть локальное хранилище. Разрешите хранение данных сайта и перезагрузите страницу. Практика начнётся только после успешного открытия IndexedDB.',
      ),
    );
  }, []);
  if (error)
    return (
      <main className="loading">
        <h1>Нужно разрешить сохранение</h1>
        <p>{error}</p>
        <button className="primary" onClick={() => location.reload()}>
          Попробовать снова
        </button>
      </main>
    );
  if (!data)
    return (
      <main className="loading">
        <div className="sprout-mark">🌱</div>
        <p>Открываем Словосад…</p>
      </main>
    );
  return (
    <AppContext.Provider
      value={{
        profile: data.active,
        profiles: data.profiles,
        words: data.words,
        history,
        refresh,
        switchProfile: async (id) => {
          await selectProfile(id);
          await refresh();
        },
        updateProfile: async (p) => {
          await saveProfile(p);
          await refresh();
        },
        parentOpen,
        setParentOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
