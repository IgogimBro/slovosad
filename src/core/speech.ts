import { useEffect, useRef, useState } from 'react';
import type { Settings } from './types';
export function useSpeech(settings: Settings) {
  const recording = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [error, setError] = useState(''),
    [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!supported) return;
    const update = () =>
      setVoices(
        window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ru')),
      );
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    const timer = setTimeout(update, 1200);
    return () => {
      clearTimeout(timer);
      window.speechSynthesis.removeEventListener('voiceschanged', update);
      window.speechSynthesis.cancel();
      recording.current?.pause();
    };
  }, [supported]);
  function speak(text: string, audioRef?: string) {
    const current = ++generation.current;
    recording.current?.pause();
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
    setError('');
    if (audioRef) {
      const audio = new Audio(audioRef);
      recording.current = audio;
      audio.volume = settings.volume;
      audio.onplaying = () => {
        if (current === generation.current) setSpeaking(true);
      };
      audio.onended = () => {
        if (current === generation.current) setSpeaking(false);
      };
      void audio
        .play()
        .catch(() => setError('Запись недоступна. Попроси взрослого произнести слово.'));
      return;
    }
    if (!supported || !voices.length) {
      setError('Русский голос недоступен. Попроси взрослого помочь с озвучкой.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text.toLocaleLowerCase('ru-RU'));
    utterance.lang = 'ru-RU';
    utterance.voice = voices.find((v) => v.localService) ?? voices[0];
    utterance.rate = settings.rate;
    utterance.volume = settings.volume;
    utterance.onstart = () => {
      if (current === generation.current) setSpeaking(true);
    };
    utterance.onend = () => {
      if (current === generation.current) setSpeaking(false);
    };
    utterance.onerror = (event) => {
      if (
        current !== generation.current ||
        event.error === 'canceled' ||
        event.error === 'interrupted'
      )
        return;
      setSpeaking(false);
      setError('Озвучка не сработала. Повтори или попроси взрослого помочь.');
    };
    window.speechSynthesis.speak(utterance);
  }
  return {
    speak,
    stop: () => {
      generation.current++;
      recording.current?.pause();
      if (supported) window.speechSynthesis.cancel();
      setSpeaking(false);
    },
    speaking,
    error,
    available: supported && voices.length > 0,
  };
}
