import type { PlayerId, PlayerProfile } from '../types';

export const PLAYERS: Record<PlayerId, PlayerProfile> = {
  A: {
    id: 'A',
    name: 'Hammer',
    color: '#3b82f6',
    emoji: '🔵',
    teams: [
      'France',
      'England',
      'Belgium',
      'USA',
      'Morocco',
      'Norway',
      'Switzerland',
      'Ecuador',
      'Czechia',
      'Algeria',
      'Saudi Arabia',
      'Panama',
    ],
  },
  B: {
    id: 'B',
    name: 'PEP',
    color: '#ef4444',
    emoji: '🔴',
    teams: [
      'Brazil',
      'Germany',
      'Mexico',
      'Turkey',
      'Ghana',
      'Austria',
      'Bosnia and Herzegovina',
      'Cape Verde',
      'DR Congo',
      'Tunisia',
      'Uzbekistan',
      'Haiti',
    ],
  },
  C: {
    id: 'C',
    name: 'Margot',
    color: '#22c55e',
    emoji: '🟢',
    teams: [
      'Argentina',
      'Netherlands',
      'Colombia',
      'Uruguay',
      'Croatia',
      'Senegal',
      'Australia',
      'Ivory Coast',
      'Iran',
      'South Africa',
      'Canada',
      'Iraq',
    ],
  },
  D: {
    id: 'D',
    name: 'Cedar Pine',
    color: '#eab308',
    emoji: '🟡',
    teams: [
      'Spain',
      'Japan',
      'Portugal',
      'Scotland',
      'Egypt',
      'Curacao',
      'Paraguay',
      'Qatar',
      'Sweden',
      'South Korea',
      'New Zealand',
      'Jordan',
    ],
  },
};

export const PLAYER_IDS: PlayerId[] = ['A', 'B', 'C', 'D'];

export const GROUPS: Record<string, string[]> = {
  A: ['Mexico', 'South Korea', 'South Africa', 'Czechia'],
  B: ['Canada', 'Bosnia and Herzegovina', 'Qatar', 'Switzerland'],
  C: ['Brazil', 'Morocco', 'Scotland', 'Haiti'],
  D: ['USA', 'Paraguay', 'Australia', 'Turkey'],
  E: ['Germany', 'Ecuador', 'Ivory Coast', 'Curacao'],
  F: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  H: ['Spain', 'Uruguay', 'Saudi Arabia', 'Cape Verde'],
  I: ['France', 'Senegal', 'Norway', 'Iraq'],
  J: ['Argentina', 'Austria', 'Algeria', 'Jordan'],
  K: ['Portugal', 'Colombia', 'Uzbekistan', 'DR Congo'],
  L: ['England', 'Croatia', 'Panama', 'Ghana'],
};

export const GROUP_LETTERS = Object.keys(GROUPS);

/**
 * チーム名から所有プレイヤーIDを求める。
 * 大文字小文字や API 表記揺れを吸収する。
 */
const TEAM_TO_PLAYER: Record<string, PlayerId> = (() => {
  const map: Record<string, PlayerId> = {};
  for (const id of PLAYER_IDS) {
    for (const team of PLAYERS[id].teams) {
      map[normalize(team)] = id;
    }
  }
  return map;
})();

export function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPlayerOfTeam(team: string): PlayerId | null {
  return TEAM_TO_PLAYER[normalize(team)] ?? null;
}

export function getPlayerProfile(team: string): PlayerProfile | null {
  const id = getPlayerOfTeam(team);
  return id ? PLAYERS[id] : null;
}

export function getGroupOfTeam(team: string): string | null {
  const target = normalize(team);
  for (const [letter, teams] of Object.entries(GROUPS)) {
    if (teams.some((t) => normalize(t) === target)) return letter;
  }
  return null;
}
