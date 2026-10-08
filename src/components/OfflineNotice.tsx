import { useRegisterSW } from 'virtual:pwa-register/react';
import { useState, useEffect } from 'react';
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function OfflineNotice() {
  const {
    offlineReady: [ready],
    needRefresh: [update],
    updateServiceWorker,
  } = useRegisterSW();
  const [install, setInstall] = useState<InstallEvent | null>(null),
    [help, setHelp] = useState(false),
    [cached, setCached] = useState(() => Boolean(navigator.serviceWorker?.controller));
  useEffect(() => {
    const listener = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', listener);
    const controller = () => setCached(Boolean(navigator.serviceWorker?.controller));
    navigator.serviceWorker?.addEventListener('controllerchange', controller);
    return () => {
      window.removeEventListener('beforeinstallprompt', listener);
      navigator.serviceWorker?.removeEventListener('controllerchange', controller);
    };
  }, []);
  return (
    <div className="offline-note">
      <span className="status-dot" />
      {ready || cached ? 'Офлайн-версия готова' : 'История сохраняется на этом устройстве'}
      <button
        className="text-button"
        onClick={async () => {
          if (install) {
            await install.prompt();
            await install.userChoice;
            setInstall(null);
          } else setHelp(!help);
        }}
      >
        Установить приложение
      </button>
      {update && (
        <button className="text-button" onClick={() => void updateServiceWorker(true)}>
          Обновить приложение
        </button>
      )}
      {help && (
        <p className="install-help">
          На iPhone: открой в Safari → «Поделиться» → «На экран Домой». Для первого открытия нужен
          интернет и HTTPS. Озвучка офлайн зависит от голосов устройства.
        </p>
      )}
    </div>
  );
}
