import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Spelling, Missing, Build, Correct } from '../src/components/Exercises';
import { createQuestion, submitAnswer } from '../src/core/engine';
import { defaultSettings, type Question, type Session } from '../src/core/types';
import { seedWords } from '../src/core/words';
const session: Session = {
  id: 's',
  profileId: 'p',
  mode: 'spelling',
  length: 3,
  questionIds: [],
  status: 'active',
  activeMs: 0,
  startedAt: new Date().toISOString(),
};
const word = seedWords.find((w) => w.spelling === 'МАМА')!;
function Harness({ initial }: { initial: Question }) {
  const [q, setQ] = useState(initial);
  return (
    <>
      <Spelling
        question={q}
        busy={false}
        submit={async (answer) =>
          setQ(submitAnswer(q, answer, q.attemptCount * 1000 + 1000).question)
        }
      />
      <button disabled={!q.solved}>Следующий вопрос</button>
      <output aria-label="Количество попыток">{q.attemptCount}</output>
    </>
  );
}
it('repeated clicks remain possible after a mistake; Next unlocks only on success', async () => {
  const user = userEvent.setup(),
    q = createQuestion(word, session, defaultSettings);
  render(<Harness initial={q} />);
  const wrong = q.options.find((x) => x !== q.target)!;
  const button = screen.getByRole('button', { name: new RegExp(wrong) });
  await user.click(button);
  await user.click(button);
  expect(screen.getByRole('button', { name: 'Следующий вопрос' })).toBeDisabled();
  expect(button).toBeEnabled();
  expect(screen.getByLabelText('Количество попыток')).toHaveTextContent('2');
  await user.click(
    screen.getByRole('button', {
      name: new RegExp(`^\\d\\s*${q.target}$`, 'u'),
    }),
  );
  expect(screen.getByRole('button', { name: 'Следующий вопрос' })).toBeEnabled();
});
it('supports duplicate letters in a built word with undo and reset', async () => {
  const user = userEvent.setup(),
    q = createQuestion(word, { ...session, mode: 'build' }, defaultSettings),
    submit = vi.fn(async () => {});
  render(<Build question={q} busy={false} submit={submit} />);
  for (const letter of ['М', 'А', 'М', 'А']) {
    await user.click(
      screen
        .getAllByRole('button', { name: new RegExp(`Буква ${letter},`) })
        .find((b) => !(b as HTMLButtonElement).disabled)!,
    );
  }
  await user.click(screen.getByRole('button', { name: 'Проверить' }));
  expect(submit).toHaveBeenCalledWith('МАМА');
  await user.click(screen.getByRole('button', { name: 'Назад' }));
  expect(screen.getByRole('button', { name: 'Проверить' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Сначала' }));
  expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled();
});
it('missing-letter labels never contain the hidden answer', () => {
  const q = createQuestion(
    seedWords.find((w) => w.spelling === 'СИНИЙ')!,
    { ...session, mode: 'missing' },
    { ...defaultSettings, difficulty: 3 },
  );
  render(<Missing question={q} busy={false} submit={async () => {}} />);
  for (let i = 0; i < 2; i++) {
    const b = screen.getByRole('button', { name: `Пропуск ${i + 1}` });
    expect(b).toHaveTextContent('?');
    expect(b.getAttribute('aria-label')).not.toContain(q.target[q.blanks[i]]);
  }
});
it('correction editor can remove an extra letter and submit the completed correction', async () => {
  const user = userEvent.setup(),
    q = {
      ...createQuestion(word, { ...session, mode: 'correct' }, defaultSettings),
      initialCorrection: 'МАММА',
    },
    submit = vi.fn(async () => {});
  render(<Correct question={q} busy={false} submit={submit} />);
  await user.click(screen.getByRole('button', { name: 'Изменить букву М, позиция 3' }));
  await user.click(screen.getByRole('button', { name: 'Убрать выбранную букву' }));
  await user.click(screen.getByRole('button', { name: 'Проверить' }));
  expect(submit).toHaveBeenCalledWith('МАМА');
});
