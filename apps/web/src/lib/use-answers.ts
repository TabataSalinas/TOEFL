'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Section, SectionPayload } from './types';

/**
 * Answer state for a module: optimistic local state + debounced server saves.
 * Locked answers (Listening) can no longer be changed, mirroring the server rule.
 */
export function useAnswers(attemptId: string, section: Section, payload: SectionPayload) {
  const initial: Record<string, unknown> = {};
  const lockedInit = new Set<string>();
  for (const a of payload.savedAnswers) {
    if (a.response != null) initial[a.questionId] = a.response;
    if (a.locked) lockedInit.add(a.questionId);
  }

  const [answers, setAnswers] = useState<Record<string, unknown>>(initial);
  const ref = useRef(answers);
  const dirty = useRef(new Set<string>());
  const locked = useRef(lockedInit);
  const spent = useRef<Record<string, number>>({});
  const enteredAt = useRef<{ id: string; at: number } | null>(null);
  const saving = useRef(false);

  const setAnswer = useCallback((qid: string, value: unknown) => {
    if (locked.current.has(qid)) return;
    ref.current = { ...ref.current, [qid]: value };
    setAnswers(ref.current);
    dirty.current.add(qid);
  }, []);

  /** Start timing the time spent on a question (per-question average time metric). */
  const enter = useCallback((qid: string | null) => {
    const now = Date.now();
    if (enteredAt.current) {
      const { id, at } = enteredAt.current;
      spent.current[id] = (spent.current[id] ?? 0) + Math.round((now - at) / 1000);
    }
    enteredAt.current = qid ? { id: qid, at: now } : null;
  }, []);

  const flush = useCallback(
    async (lockIds: string[] = []) => {
      enter(enteredAt.current?.id ?? null);
      const ids = new Set<string>([...dirty.current, ...lockIds]);
      if (ids.size === 0 || saving.current) return;
      saving.current = true;
      try {
        await api.post(`/attempts/${attemptId}/sections/${section}/answers`, {
          answers: [...ids].map((id) => ({
            questionId: id,
            response: ref.current[id] ?? null,
            timeSpentSec: spent.current[id] ?? 0,
            lock: lockIds.includes(id) || undefined,
          })),
        });
        dirty.current.clear();
        lockIds.forEach((id) => locked.current.add(id));
      } catch {
        /* retried by the next autosave / final flush */
      } finally {
        saving.current = false;
      }
    },
    [attemptId, section, enter],
  );

  useEffect(() => {
    const t = setInterval(() => void flush(), 8000);
    return () => clearInterval(t);
  }, [flush]);

  return { answers, setAnswer, flush, enter, isLocked: (qid: string) => locked.current.has(qid) };
}
