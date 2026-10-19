import { useQuery } from '@tanstack/react-query';
import { admin, races, standings } from '../api/endpoints';

export const keys = {
  races: ['races'] as const,
  race: (id: number) => ['race', id] as const,
  leaderboard: (id: number) => ['leaderboard', id] as const,
  standings: ['standings'] as const,
  adminRaces: ['admin', 'races'] as const,
  adminRace: (id: number) => ['admin', 'race', id] as const,
};

export const useRaces = () => useQuery({ queryKey: keys.races, queryFn: () => races.list() });
export const useRace = (id: number) => useQuery({ queryKey: keys.race(id), queryFn: () => races.detail(id), enabled: Number.isFinite(id) });
export const useStandings = () => useQuery({ queryKey: keys.standings, queryFn: () => standings.season() });
export const useRaceLeaderboard = (id: number, enabled = true) =>
  useQuery({ queryKey: keys.leaderboard(id), queryFn: () => races.leaderboard(id), enabled: enabled && Number.isFinite(id), retry: false });

export const useAdminRaces = () => useQuery({ queryKey: keys.adminRaces, queryFn: admin.races });
export const useAdminRace = (id: number) => useQuery({ queryKey: keys.adminRace(id), queryFn: () => admin.race(id) });
