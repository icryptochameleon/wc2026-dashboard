import { GROUPS, normalize } from './teams';

/**
 * Polymarket 公開 API (キー不要・CORS 開放 — 2026-06-10 実測検証済み)
 * - Gamma: マーケット定義と価格 (エッジキャッシュ ~5分)
 * - CLOB: リアルタイム価格 (キャッシュなし、ライブ中の更新用)
 */
export const GAMMA_BASE = 'https://gamma-api.polymarket.com';
export const CLOB_BASE = 'https://clob.polymarket.com';

/** 優勝マーケットのイベント slug (event id 30615) */
export const WINNER_SLUG = 'world-cup-winner';

/** WC2026 の試合別マーケットの series_id */
export const MATCH_SERIES_ID = 11433;

/** normalize() 済みの正準チーム名 (= GROUPS 記載の表記) への逆引き */
const CANONICAL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const teams of Object.values(GROUPS)) {
    for (const t of teams) map[normalize(t)] = t;
  }
  return map;
})();

/**
 * Polymarket / ESPN / football-data の表記ゆれ → 正準名 (normalize 済みキー)。
 * 注: normalize() は ASCII 以外の文字 (ç, ô, ü 等) を除去するため、
 * "Côte d'Ivoire" → "cte divoire", "Türkiye" → "trkiye", "Curaçao" → "curaao" になる。
 */
const ALIASES: Record<string, string> = {
  turkiye: 'turkey',
  trkiye: 'turkey',
  'congo dr': 'dr congo',
  'democratic republic of the congo': 'dr congo',
  bosniaherzegovina: 'bosnia and herzegovina',
  'bosnia herzegovina': 'bosnia and herzegovina',
  bosnia: 'bosnia and herzegovina',
  curaao: 'curacao',
  'cte divoire': 'ivory coast',
  cotedivoire: 'ivory coast',
  'cote divoire': 'ivory coast',
  'korea republic': 'south korea',
  'czech republic': 'czechia',
  'united states': 'usa',
  'united states of america': 'usa',
  'ir iran': 'iran',
  'cabo verde': 'cape verde',
};

/**
 * 外部 API のチーム名を本アプリの正準名に変換する。
 * 48 チームに該当しない名前 (Italy, Peru, "Team AG", "Other" 等) は null。
 */
export function canonicalTeam(raw: string): string | null {
  const n = normalize(raw);
  if (CANONICAL[n]) return CANONICAL[n];
  const alias = ALIASES[n];
  if (alias && CANONICAL[alias]) return CANONICAL[alias];
  return null;
}
