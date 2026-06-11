/**
 * データ取得先。
 *
 * football-data.org はブラウザからの CORS が遮断されているため (2026-06-10 実測)、
 * クライアントは直接叩かない。トークンは GitHub Actions の Secret にのみ存在し、
 * .github/workflows/results.yml → scripts/fetch-results.mjs が
 * `data` ブランチの results.json に正準データを書き出す。
 */

/** 正準結果フィード (Actions が 5 分毎更新・CDN キャッシュ ~300 秒) */
export const RESULTS_URL =
  'https://raw.githubusercontent.com/icryptochameleon/wc2026-dashboard/data/results.json';

/** デプロイ時に焼き込んだ予備スナップショット (raw が落ちた時の深いフォールバック) */
export const RESULTS_FALLBACK_URL = `${import.meta.env.BASE_URL}data/results.json`;

/** ESPN 非公式スコアボード (無鍵・CORS 開放・ライブ速報レイヤー用) */
export const ESPN_SCOREBOARD_BASE =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

// 参考: Node スクリプト側でのみ使用 (クライアントからは CORS 不可)
export const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
export const FOOTBALL_DATA_COMPETITION = 'WC';
export const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
export const ODDS_API_SPORT = 'soccer_fifa_world_cup';
