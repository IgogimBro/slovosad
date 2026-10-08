import { useState } from 'react';
import { Undo2, RotateCcw, Check, Plus, Trash2 } from 'lucide-react';
import type { Question } from '../core/types';
export interface ExerciseProps {
  question: Question;
  busy: boolean;
  submit: (answer: string, blank?: number) => Promise<void>;
  saveDraft?: (draft: Pick<Question, 'draftTiles' | 'draftCorrection'>) => void;
}
export function Spelling({ question: q, busy, submit }: ExerciseProps) {
  return (
    <div className="answer-grid" role="group" aria-label="Варианты написания">
      {q.options.map((option, i) => (
        <button
          className={`answer-option ${q.solved && option === q.target ? 'correct-answer' : ''}`}
          key={option}
          disabled={busy || q.solved}
          onClick={() => void submit(option)}
        >
          <span className="option-index">{i + 1}</span>
          {option}
          {q.solved && option === q.target && <Check size={24} />}
        </button>
      ))}
    </div>
  );
}
export function Missing({ question: q, busy, submit }: ExerciseProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const pending = q.blanks.filter((i) => !q.blankAnswers[i]),
    active = selected !== null && pending.includes(selected) ? selected : pending[0];
  return (
    <>
      <div className="missing-word" role="group" aria-label="Слово с пропусками">
        {[...q.prompt].map((c, i) =>
          q.blanks.includes(i) ? (
            <button
              key={i}
              disabled={busy || Boolean(q.blankAnswers[i])}
              aria-label={
                q.blankAnswers[i]
                  ? `Буква ${q.blankAnswers[i]}, пропуск ${q.blanks.indexOf(i) + 1}`
                  : `Пропуск ${q.blanks.indexOf(i) + 1}`
              }
              aria-pressed={active === i}
              className={`blank ${active === i ? 'active' : ''} ${q.blankAnswers[i] ? 'filled' : ''}`}
              onClick={() => setSelected(i)}
            >
              {q.blankAnswers[i] ?? '?'}
            </button>
          ) : (
            <span key={i}>{c}</span>
          ),
        )}
      </div>
      {!q.solved && (
        <>
          <p className="exercise-caption">
            {q.blanks.length > 1
              ? `Выбери букву для пропуска ${q.blanks.indexOf(active) + 1}`
              : 'Какая буква здесь подходит?'}
          </p>
          <div className="letter-options" role="group" aria-label="Буквы для пропуска">
            {q.blankOptions[q.blanks.indexOf(active)]?.map((l) => (
              <button
                className="letter-tile"
                key={l}
                disabled={busy}
                onClick={() => void submit(l, active)}
              >
                {l}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
export function Build({ question: q, busy, submit, saveDraft }: ExerciseProps) {
  const [ids, updateIds] = useState<string[]>(q.draftTiles ?? []),
    answer = ids.map((id) => q.tiles.find((t) => t.id === id)!.letter).join('');
  function setIds(next: string[]) {
    updateIds(next);
    saveDraft?.({ draftTiles: next });
  }
  return (
    <>
      <div className="built-word" aria-label="Выбранные буквы">
        {[...q.target].map((_, i) => (
          <span key={i} className={`word-slot ${ids[i] ? 'occupied' : ''}`}>
            {ids[i] ? q.tiles.find((t) => t.id === ids[i])!.letter : ''}
          </span>
        ))}
      </div>
      <p className="exercise-caption">Нажимай на буквы по порядку</p>
      <div className="letter-options">
        {q.tiles.map((t, i) => (
          <button
            key={t.id}
            className="letter-tile"
            disabled={busy || q.solved || ids.includes(t.id)}
            aria-label={`Буква ${t.letter}, плитка ${i + 1}`}
            onClick={() => setIds([...ids, t.id])}
          >
            {t.letter}
          </button>
        ))}
      </div>
      <div className="edit-controls">
        <button
          className="secondary"
          disabled={busy || q.solved || !ids.length}
          onClick={() => setIds(ids.slice(0, -1))}
        >
          <Undo2 size={18} />
          Назад
        </button>
        <button
          className="secondary"
          disabled={busy || q.solved || !ids.length}
          onClick={() => setIds([])}
        >
          <RotateCcw size={18} />
          Сначала
        </button>
      </div>
      <button
        className="primary check-button"
        disabled={busy || q.solved || ids.length !== q.tiles.length}
        onClick={() => void submit(answer)}
      >
        Проверить
        <Check size={20} />
      </button>
    </>
  );
}
export function Correct({ question: q, busy, submit, saveDraft }: ExerciseProps) {
  const [edits, updateEdits] = useState<string[]>(
      q.draftCorrection && q.draftCorrection !== q.initialCorrection
        ? [q.initialCorrection, q.draftCorrection]
        : [q.initialCorrection],
    ),
    [index, setIndex] = useState<number | null>(null),
    [insert, setInsert] = useState<number | null>(null);
  const value = edits[edits.length - 1];
  function setEdits(next: string[]) {
    updateEdits(next);
    saveDraft?.({ draftCorrection: next[next.length - 1] });
  }
  function change(next: string) {
    setEdits([...edits, next]);
    setIndex(null);
    setInsert(null);
  }
  const locked = busy || q.solved;
  return (
    <>
      <p className="exercise-caption">
        Нажми на букву, чтобы заменить или убрать.
        <br />
        Нажми «+», чтобы добавить букву.
      </p>
      <div className="correction-word" role="group" aria-label="Редактор слова">
        {[...value].map((c, i) => (
          <span className="editor-piece" key={i}>
            <button
              className="insert-gap"
              aria-label={`Вставить перед буквой ${i + 1}`}
              disabled={locked || value.length >= 16}
              onClick={() => {
                setInsert(i);
                setIndex(null);
              }}
            >
              <Plus size={13} />
            </button>
            <button
              className={`letter-tile edit-tile ${index === i ? 'selected' : ''}`}
              disabled={locked}
              onClick={() => {
                setIndex(i);
                setInsert(null);
              }}
              aria-label={`Изменить букву ${c}, позиция ${i + 1}`}
            >
              {c}
            </button>
          </span>
        ))}
        <button
          className="insert-gap"
          aria-label="Добавить букву в конце"
          disabled={locked || value.length >= 16}
          onClick={() => {
            setInsert(value.length);
            setIndex(null);
          }}
        >
          <Plus size={13} />
        </button>
      </div>
      {!locked && (index !== null || insert !== null) && (
        <div className="alphabet-panel">
          <div className="alphabet-heading">
            <strong>{insert !== null ? 'Добавь букву' : 'Замени букву'}</strong>
            <button
              className="text-button"
              onClick={() => {
                setIndex(null);
                setInsert(null);
              }}
            >
              Закрыть
            </button>
          </div>
          <div className="alphabet">
            {[...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'].map((c) => (
              <button
                className="letter-tile"
                key={c}
                onClick={() =>
                  change(
                    insert !== null
                      ? value.slice(0, insert) + c + value.slice(insert)
                      : value.slice(0, index!) + c + value.slice(index! + 1),
                  )
                }
              >
                {c}
              </button>
            ))}
          </div>
          {index !== null && (
            <button
              className="secondary"
              disabled={value.length <= 1}
              onClick={() => change(value.slice(0, index) + value.slice(index + 1))}
            >
              <Trash2 size={17} />
              Убрать выбранную букву
            </button>
          )}
        </div>
      )}
      <div className="edit-controls">
        <button
          className="secondary"
          disabled={locked || edits.length <= 1}
          onClick={() => {
            setEdits(edits.slice(0, -1));
            setIndex(null);
            setInsert(null);
          }}
        >
          <Undo2 size={18} />
          Назад
        </button>
        <button
          className="secondary"
          disabled={locked || edits.length <= 1}
          onClick={() => {
            setEdits([q.initialCorrection]);
            setIndex(null);
            setInsert(null);
          }}
        >
          <RotateCcw size={18} />
          Сначала
        </button>
      </div>
      <button className="primary check-button" disabled={locked} onClick={() => void submit(value)}>
        Проверить
        <Check size={20} />
      </button>
    </>
  );
}
