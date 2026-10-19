import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { races } from '../api/endpoints';
import type { AnswerValue } from '../api/types';
import { keys } from './queries';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'locked';

/**
 * Answers save as the player taps. One request is in flight per race at a time; changes made
 * meanwhile are merged and sent next, so nothing is sent twice and the last tap always wins.
 */
export function useAutosave(raceId: number, initial: Record<string, AnswerValue>) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(initial);
  const [state, setState] = useState<SaveState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const pending = useRef<Record<string, AnswerValue | null>>({});
  const inFlight = useRef(false);

  useEffect(() => { setAnswers(initial); }, [raceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async () => {
    if (inFlight.current || !Object.keys(pending.current).length) return;
    const batch = pending.current;
    pending.current = {};
    inFlight.current = true;
    setState('saving');
    try {
      await races.saveAnswers(raceId, batch as Record<number, AnswerValue | null>);
      setFieldErrors((e) => { const n = { ...e }; Object.keys(batch).forEach((k) => delete n[k]); return n; });
      setState('saved');
      setMessage(null);
      setSavedAt(new Date());
      qc.invalidateQueries({ queryKey: keys.races });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409) { setState('locked'); setMessage(err.message); qc.invalidateQueries({ queryKey: keys.race(raceId) }); }
      else if (err.status === 422 && err.errors) { setFieldErrors((f) => ({ ...f, ...err.errors })); setState('error'); setMessage('Some answers need a fix.'); }
      else { pending.current = { ...batch, ...pending.current }; setState('error'); setMessage(err.message); }
    } finally {
      inFlight.current = false;
      if (Object.keys(pending.current).length) void flush();
    }
  }, [raceId, qc]);

  const setAnswer = useCallback((qid: number, value: AnswerValue | null) => {
    setAnswers((a) => {
      const n = { ...a };
      if (value === null) delete n[qid]; else n[qid] = value;
      return n;
    });
    pending.current[qid] = value;
    void flush();
  }, [flush]);

  const retry = useCallback(() => { void flush(); }, [flush]);

  return { answers, setAnswer, state, message, fieldErrors, savedAt, retry };
}
