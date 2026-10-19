import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnswerValue, Question } from '../api/types';
import { QuestionRenderer } from './quiz';

const PODIUM: Question = { id: 2, sequence: 2, prompt: 'Predict the podium', type: 'ranked', weight: 15, options: ['NOR', 'VER', 'LEC', 'HAM'], config: { pick: 3 } };

function Harness({ q, onValue }: { q: Question; onValue: (v: AnswerValue | null) => void }) {
  const [v, setV] = useState<AnswerValue | undefined>();
  return <QuestionRenderer q={q} value={v} onChange={(n) => { setV(n ?? undefined); onValue(n); }} />;
}

it('fills podium slots in tap order and lets you reorder', async () => {
  const seen: (AnswerValue | null)[] = [];
  render(<Harness q={PODIUM} onValue={(v) => seen.push(v)} />);
  const u = userEvent.setup();
  await u.click(screen.getByRole('button', { name: /Max Verstappen/ }));
  await u.click(screen.getByRole('button', { name: /Lando Norris/ }));
  await u.click(screen.getByRole('button', { name: /Charles Leclerc/ }));
  // a fourth pick is ignored: the podium has three places
  await u.click(screen.getByRole('button', { name: /Lewis Hamilton/ }));
  expect(seen.at(-1)).toEqual(['VER', 'NOR', 'LEC']);
  await u.click(screen.getByRole('button', { name: 'Move NOR up' }));
  expect(seen.at(-1)).toEqual(['NOR', 'VER', 'LEC']);
});

it('toggles yes / no and clears on a second tap', async () => {
  const seen: (AnswerValue | null)[] = [];
  render(<Harness q={{ ...PODIUM, type: 'yes_no', options: [], config: {} }} onValue={(v) => seen.push(v)} />);
  const u = userEvent.setup();
  await u.click(screen.getByRole('button', { name: 'Yes' }));
  expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true');
  await u.click(screen.getByRole('button', { name: 'Yes' }));
  expect(seen).toEqual([true, null]);
});
