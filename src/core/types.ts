export type Mode = 'spelling' | 'missing' | 'build' | 'correct';
export type Difficulty = 1 | 2 | 3;
export type ErrorKind =
  | 'missing'
  | 'extra'
  | 'repeated'
  | 'swapped'
  | 'vowel'
  | 'consonant'
  | 'и/й'
  | 'ы/и'
  | 'other';
export interface Distractor {
  text: string;
  kind: ErrorKind;
}
export interface Word {
  id: string;
  spelling: string;
  category: string;
  difficulty: Difficulty;
  illustration?: string;
  audioRef?: string;
  distractors: Distractor[];
  advancedCorrections?: Distractor[];
  modes: Mode[];
  confusions: string[];
  custom?: boolean;
  modified?: boolean;
  hidden?: boolean;
}
export interface Settings {
  difficulty: Difficulty;
  choices: 0 | 2 | 3 | 4;
  modes: Mode[];
  categories: string[];
  hints: boolean;
  rewards: boolean;
  sessionLength: number;
  rate: number;
  volume: number;
}
export interface Profile {
  id: string;
  name: string;
  settings: Settings;
  createdAt: string;
}
export interface Tile {
  id: string;
  letter: string;
}
export interface Question {
  draftTiles?: string[];
  draftCorrection?: string;
  id: string;
  profileId: string;
  sessionId: string;
  wordId: string;
  target: string;
  category: string;
  mode: Mode;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  optionErrors: Record<string, ErrorKind>;
  blanks: number[];
  blankOptions: string[][];
  blankAnswers: Record<number, string>;
  tiles: Tile[];
  initialCorrection: string;
  attemptCount: number;
  mistakeCount: number;
  solved: boolean;
  firstAttemptCorrect: boolean | null;
  hinted: boolean;
  assisted: boolean;
  elapsedMs: number;
  lastAttemptElapsedMs: number;
  presentedAt: string;
  completedAt?: string;
}
export interface Attempt {
  id: string;
  profileId: string;
  sessionId: string;
  questionId: string;
  wordId: string;
  mode: Mode;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  number: number;
  answer: string;
  correct: boolean;
  errorKind?: ErrorKind;
  confusionPair?: string;
  blankIndex?: number;
  elapsedMs: number;
  sincePreviousMs: number;
  timestamp: string;
  hinted: boolean;
  assisted: boolean;
}
export interface Session {
  id: string;
  profileId: string;
  mode: Mode;
  length: number;
  questionIds: string[];
  currentQuestionId?: string;
  status: 'active' | 'paused' | 'completed';
  activeMs: number;
  startedAt: string;
  endedAt?: string;
}
export interface History {
  questions: Question[];
  attempts: Attempt[];
  sessions: Session[];
}
export const modeInfo: Record<
  Mode,
  { title: string; instruction: string; description: string; color: string }
> = {
  spelling: {
    title: 'Найди верное слово',
    instruction: 'Послушай и выбери слово',
    description: 'Учимся замечать правильное написание',
    color: 'mint',
  },
  missing: {
    title: 'Какая буква спряталась?',
    instruction: 'Послушай и вставь букву',
    description: 'Находим недостающие буквы',
    color: 'peach',
  },
  build: {
    title: 'Собери слово',
    instruction: 'Послушай и собери слово',
    description: 'Расставляем буквы по порядку',
    color: 'lilac',
  },
  correct: {
    title: 'Исправь ошибку',
    instruction: 'Послушай и исправь слово',
    description: 'Убираем, добавляем и заменяем буквы',
    color: 'yellow',
  },
};
export const defaultSettings: Settings = {
  difficulty: 1,
  choices: 0,
  modes: ['spelling', 'missing', 'build', 'correct'],
  categories: [],
  hints: true,
  rewards: true,
  sessionLength: 5,
  rate: 0.8,
  volume: 1,
};
export const normalize = (s: string) => s.normalize('NFC').trim().toLocaleUpperCase('ru-RU');
export const uid = () => crypto.randomUUID();
