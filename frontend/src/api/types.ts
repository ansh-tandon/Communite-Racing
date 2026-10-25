// Mirrors backend/app/schemas.py. Keep in sync when the API changes.

export type QuestionType = 'single' | 'multi' | 'ranked' | 'number' | 'yes_no';
export type Phase = 'upcoming' | 'open' | 'closed' | 'results';
export type RaceStatus = 'draft' | 'open' | 'closed' | 'scoring' | 'scored';
export type AnswerValue = string | string[] | number | boolean;

export interface User {
  id: number;
  email: string;
  display_name: string | null;
  is_admin: boolean;
}

export interface TokenOut {
  access_token: string;
  token_type: 'bearer';
  user: User;
}

export interface QuestionConfig {
  pick?: number;
  min?: number;
  max?: number;
  tolerance?: number;
  scoring?: 'per_item' | 'all';
  /** Points taken off a wrong answer; a blank answer scores 0. */
  penalty?: number;
}

export interface Question {
  id: number;
  sequence: number;
  prompt: string;
  type: QuestionType;
  weight: number;
  options: string[];
  config: QuestionConfig;
}

export interface RaceSummary {
  id: number;
  season: number;
  round: number;
  name: string;
  circuit: string;
  country: string;
  quiz_opens_at: string;
  quiz_closes_at: string;
  phase: Phase;
  question_count: number;
  answered_count: number;
  my_points: number | null;
  my_rank: number | null;
}

export interface MyResults {
  answer_key: Record<string, AnswerValue>;
  points_by_question: Record<string, number>;
  points: number | null;
  rank: number | null;
  max_points: number;
}

export interface RaceDetail extends RaceSummary {
  server_time: string;
  entries: number;
  questions: Question[];
  my_answers: Record<string, AnswerValue>;
  results: MyResults | null;
}

export interface LeaderRow {
  rank: number;
  user_id: number;
  name: string;
  points: number;
  correct_count: number;
}

export interface RaceLeaderboard {
  race_id: number;
  published: boolean;
  rows: LeaderRow[];
}

/** GET /races/{id}/live: provisional, between the lock and published results. */
export interface LiveSeasonRow {
  rank: number;
  user_id: number;
  name: string;
  points: number;
  race_points: number | null;
  prev_rank: number | null;
}

export interface LiveLeaderboard {
  race_id: number;
  season: number;
  questions: number;
  results_in: number;
  live_results: number;
  updated_at: string | null;
  rows: LeaderRow[];
  season_rows: LiveSeasonRow[];
}

export interface SeasonRow {
  rank: number;
  user_id: number;
  name: string;
  points: number;
  races: number;
  wins: number;
  podiums: number;
}

export interface SeasonStandings {
  season: number;
  rows: SeasonRow[];
}

// ---------- admin ----------

export interface AdminRace {
  id: number;
  season: number;
  round: number;
  name: string;
  circuit: string;
  country: string;
  quiz_opens_at: string;
  quiz_closes_at: string;
  status: RaceStatus;
  reveal_immediately: boolean;
  published_at: string | null;
}

export interface AdminRaceDetail extends AdminRace {
  entries: number;
  questions: Question[];
  answer_key: Record<string, AnswerValue>;
}

export interface QuestionIn {
  prompt: string;
  type: QuestionType;
  weight: number;
  options: string[];
  config: QuestionConfig;
  sequence?: number;
}

export interface RaceIn {
  season: number;
  round: number;
  name: string;
  circuit: string;
  country: string;
  quiz_opens_at: string;
  quiz_closes_at: string;
  reveal_immediately: boolean;
  questions: QuestionIn[];
}

export interface ScoreSummary {
  race_id: number;
  entries: number;
  max_points: number;
  published: boolean;
  rescored: boolean;
}
