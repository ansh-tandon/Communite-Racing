import { useQuery } from '@tanstack/react-query';
import { admin, races, standings } from '../api/endpoints';

export const keys = {
  races: ['races'] as const,
  race: (id: number) => ['race', id] as const,
  leaderboard: (id: number) => ['leaderboard', id] as const,
  live: (id: number) => ['live', id] as const,
  standings: ['standings'] as const,
  adminRaces: ['admin', 'races'] as const,
  adminRace: (id: number) => ['admin', 'race', id] as const,
};

// Re-read every minute so a quiz moving from open to locked (live standings) shows up without a reload.
export const useRaces = () => useQuery({ queryKey: keys.races, queryFn: () => races.list(), refetchInterval: 60_000 });
export const useRace = (id: number) => useQuery({ queryKey: keys.race(id), queryFn: () => races.detail(id), enabled: Number.isFinite(id), refetchInterval: 60_000 });
export const useStandings = () => useQuery({ queryKey: keys.standings, queryFn: () => standings.season() });
export const useRaceLeaderboard = (id: number, enabled = true) =>
  useQuery({ queryKey: keys.leaderboard(id), queryFn: () => races.leaderboard(id), enabled: enabled && Number.isFinite(id), retry: false });

/** Live standings: re-read every 20 s, the same pace the server reads OpenF1 during a session. */
export const useLiveLeaderboard = (id: number, enabled = true) =>
  useQuery({ queryKey: keys.live(id), queryFn: () => races.live(id), enabled: enabled && Number.isFinite(id), refetchInterval: 20_000, retry: false });

export const useAdminRaces = () => useQuery({ queryKey: keys.adminRaces, queryFn: admin.races });
export const useAdminRace = (id: number) => useQuery({ queryKey: keys.adminRace(id), queryFn: () => admin.race(id) });
