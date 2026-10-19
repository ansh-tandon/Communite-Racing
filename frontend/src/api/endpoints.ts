// One typed function per backend endpoint (backend/app/api/*.py). No invented paths:
// anything the backend doesn't serve yet is listed in BACKEND_GAPS.md instead.
import { api } from './client';
import type {
  AdminRace, AdminRaceDetail, AnswerValue, RaceDetail, RaceIn, RaceLeaderboard,
  RaceSummary, ScoreSummary, SeasonStandings, TokenOut, User,
} from './types';

export const auth = {
  requestCode: (email: string) => api<{ sent: true }>('/auth/otp/request', { method: 'POST', body: { email } }),
  verify: (email: string, code: string) => api<TokenOut>('/auth/otp/verify', { method: 'POST', body: { email, code } }),
  /** The ID token from Google's "Continue with Google" button. */
  google: (credential: string) => api<TokenOut>('/auth/google', { method: 'POST', body: { credential } }),
  me: () => api<User>('/auth/me'),
  updateMe: (display_name: string) => api<User>('/auth/me', { method: 'PATCH', body: { display_name } }),
};

export const races = {
  list: (season?: number) => api<RaceSummary[]>(`/races${season ? `?season=${season}` : ''}`),
  detail: (id: number) => api<RaceDetail>(`/races/${id}`),
  /** Autosave: one or many answers. null clears an answer. */
  saveAnswers: (id: number, answers: Record<number, AnswerValue | null>) =>
    api<{ answers: Record<string, AnswerValue> }>(`/races/${id}/answers`, { method: 'PUT', body: { answers } }),
  leaderboard: (id: number) => api<RaceLeaderboard>(`/races/${id}/leaderboard`),
};

export const standings = {
  season: (season?: number) => api<SeasonStandings>(`/standings${season ? `?season=${season}` : ''}`),
};

export const admin = {
  races: () => api<AdminRace[]>('/admin/races'),
  race: (id: number) => api<AdminRaceDetail>(`/admin/races/${id}`),
  create: (body: RaceIn) => api<AdminRaceDetail>('/admin/races', { method: 'POST', body }),
  copyQuestions: (id: number, from_race_id?: number) =>
    api<{ copied: number }>(`/admin/races/${id}/copy-questions`, { method: 'POST', body: { from_race_id: from_race_id ?? null } }),
  open: (id: number) => api<AdminRace>(`/admin/races/${id}/open`, { method: 'POST' }),
  close: (id: number) => api<AdminRace>(`/admin/races/${id}/close`, { method: 'POST' }),
  saveKey: (id: number, answers: Record<number, AnswerValue | null>, score = false) =>
    api<{ answer_key: Record<string, AnswerValue>; scored: ScoreSummary | null }>(`/admin/races/${id}/answer-key`, { method: 'PUT', body: { answers, score } }),
  score: (id: number) => api<ScoreSummary>(`/admin/races/${id}/score`, { method: 'POST' }),
  rescore: (id: number, answers: Record<number, AnswerValue | null> = {}) =>
    api<ScoreSummary>(`/admin/races/${id}/rescore`, { method: 'POST', body: { answers } }),
  publish: (id: number) => api<AdminRace>(`/admin/races/${id}/publish`, { method: 'POST' }),
};
