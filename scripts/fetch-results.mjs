#!/usr/bin/env node
/**
 * WC2026 試合結果フェッチャー (GitHub Actions / ローカル両用・依存ゼロ)
 *
 * データフロー:
 *   football-data.org (公式・要トークン) ──┐
 *   ESPN scoreboard (無鍵・速報)      ──┼→ 正準化 → 検証 → data ブランチへ force-push
 *   data/overrides.json (オーナー上書き) ─┘
 *
 * モード:
 *   - FOOTBALL_DATA_TOKEN あり: fd が正準。ESPN は espnId クロスワーク (ライブ用) のみ。
 *   - トークンなし (ブートストラップ): ESPN 由来のフィクスチャ/結果をそのまま正準として配信。
 *
 * 検証 (改悪データの公開を拒否):
 *   - スコアは number | null のみ
 *   - 試合数は既公開分より減らない (リテンション・マージで保証 + 念のため検証)
 *   - 既公開の FINISHED が非 FINISHED に退行しない
 *   - グループステージ 72 試合が揃ったら 48 チーム全てがマップ済みであること
 *
 * 試合 ID はソース非依存の決定的スラッグ: fx-<home>-<away>-<YYYYMMDD>
 * (fd の数値 id / ESPN の event id はメタとして併載)
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const REPO_SLUG = process.env.GITHUB_REPOSITORY || 'icryptochameleon/wc2026-dashboard';
const DATA_BRANCH = 'data';
const RAW_RESULTS_URL = `https://raw.githubusercontent.com/${REPO_SLUG}/${DATA_BRANCH}/results.json`;
const FD_URL = 'https://api.football-data.org/v4/competitions/2000/matches';
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const TOURNAMENT_START = '2026-06-11';
const TOURNAMENT_END = '2026-07-19';
const HARD_STOP = '2026-07-26';
const FULL_SWEEP_TTL_MS = 20 * 3600 * 1000;
const LOOP_DELAYS_MS = [90_000, 90_000, 90_000]; // ライブ窓では計4パス (~270秒)

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ───────────────────────── 正準化 ─────────────────────────

function normalize(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadAliases() {
  const raw = JSON.parse(readFileSync(join(ROOT, 'data', 'team-aliases.json'), 'utf8'));
  const index = new Map(); // normalize済み表記 → 正準名
  const groups = new Map(); // 正準名 → グループ文字
  for (const [canonical, info] of Object.entries(raw.teams)) {
    groups.set(canonical, info.group);
    index.set(normalize(canonical), canonical);
    for (const a of info.aliases ?? []) index.set(normalize(a), canonical);
    for (const t of info.tla ?? []) index.set(normalize(t), canonical);
  }
  return { index, groups, count: Object.keys(raw.teams).length };
}

function loadOverrides() {
  try {
    const raw = JSON.parse(readFileSync(join(ROOT, 'data', 'overrides.json'), 'utf8'));
    return raw.overrides ?? {};
  } catch {
    return {};
  }
}

function slugify(canonical) {
  return normalize(canonical).replace(/\s+/g, '-');
}

function matchId(home, away, utcDate) {
  const ymd = utcDate.slice(0, 10).replace(/-/g, '');
  return `fx-${slugify(home)}-${slugify(away)}-${ymd}`;
}

// ───────────────────────── 取得 ─────────────────────────

async function fetchJson(url, headers = {}) {
  // タイムアウト必須: ハングした接続 1 本がジョブ全体を 12 分タイムアウトまで道連れにするのを防ぐ
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const FD_STATUS = {
  SCHEDULED: 'SCHEDULED',
  TIMED: 'TIMED',
  IN_PLAY: 'IN_PLAY',
  PAUSED: 'PAUSED',
  EXTRA_TIME: 'IN_PLAY',
  PENALTY_SHOOTOUT: 'IN_PLAY',
  FINISHED: 'FINISHED',
  SUSPENDED: 'PAUSED',
  POSTPONED: 'POSTPONED',
  CANCELLED: 'CANCELLED',
  AWARDED: 'FINISHED',
};

const FD_STAGES = new Set([
  'GROUP_STAGE', 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL',
]);

/** football-data.org → 正準 MatchResult[] (マップ不能チームの GS 試合は hard-fail) */
function mapFdMatches(fdData, aliases) {
  const out = [];
  const unmapped = new Set();
  for (const m of fdData.matches ?? []) {
    const stage = FD_STAGES.has(m.stage) ? m.stage : 'GROUP_STAGE';
    const homeRaw = m.homeTeam?.name ?? m.homeTeam?.shortName ?? '';
    const awayRaw = m.awayTeam?.name ?? m.awayTeam?.shortName ?? '';
    const home =
      aliases.index.get(normalize(homeRaw)) ?? aliases.index.get(normalize(m.homeTeam?.tla ?? ''));
    const away =
      aliases.index.get(normalize(awayRaw)) ?? aliases.index.get(normalize(m.awayTeam?.tla ?? ''));
    if (!home || !away) {
      // KO の "Winner of ..." プレースホルダは静かにスキップ。GS の不明名は致命的。
      if (stage === 'GROUP_STAGE') {
        if (!home && homeRaw) unmapped.add(homeRaw);
        if (!away && awayRaw) unmapped.add(awayRaw);
      }
      continue;
    }
    const group = m.group ? `Group ${m.group.replace('GROUP_', '')}` : null;
    out.push({
      id: matchId(home, away, m.utcDate),
      utcDate: m.utcDate,
      status: FD_STATUS[m.status] ?? 'SCHEDULED',
      stage,
      group,
      matchday: m.matchday ?? undefined,
      minute: typeof m.minute === 'number' ? m.minute : null,
      homeTeam: { name: home },
      awayTeam: { name: away },
      score: {
        fullTime: {
          home: m.score?.fullTime?.home ?? null,
          away: m.score?.fullTime?.away ?? null,
        },
        halfTime: m.score?.halfTime,
      },
      fdId: m.id != null ? String(m.id) : undefined,
      source: 'football-data',
    });
  }
  if (unmapped.size > 0) {
    throw new Error(
      `UNMAPPED GROUP-STAGE TEAM NAMES (add to data/team-aliases.json): ${[...unmapped].join(' | ')}`,
    );
  }
  return out;
}

/**
 * KO ステージを日付から推定 (ESPN 単独モード用。fd 稼働後は fd が正とする)
 * 注: 米西海岸の夜試合は UTC で翌日に食み出すため、GS 境界は 6/28 (UTC) まで。
 */
function stageFromDate(iso) {
  const d = iso.slice(0, 10);
  if (d <= '2026-06-28') return 'GROUP_STAGE';
  if (d <= '2026-07-04') return 'LAST_32';
  if (d <= '2026-07-08') return 'LAST_16';
  if (d <= '2026-07-12') return 'QUARTER_FINALS';
  if (d <= '2026-07-16') return 'SEMI_FINALS';
  if (d <= '2026-07-18') return 'THIRD_PLACE';
  return 'FINAL';
}

function espnStatus(ev) {
  const t = ev?.status?.type ?? ev?.competitions?.[0]?.status?.type ?? {};
  if (t.state === 'pre') return 'TIMED';
  if (t.state === 'in') return /HALFTIME/i.test(t.name ?? '') ? 'PAUSED' : 'IN_PLAY';
  if (t.state === 'post') return 'FINISHED';
  return 'SCHEDULED';
}

function espnMinute(ev) {
  const disp = ev?.status?.displayClock ?? ev?.competitions?.[0]?.status?.displayClock ?? '';
  const n = parseInt(String(disp), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** ESPN scoreboard の 1 イベント → 正準 match (マップ不能は null) */
function mapEspnEvent(ev, aliases) {
  const comp = ev?.competitions?.[0];
  if (!comp?.competitors || comp.competitors.length < 2) return null;
  const homeC = comp.competitors.find((c) => c.homeAway === 'home') ?? comp.competitors[0];
  const awayC = comp.competitors.find((c) => c.homeAway === 'away') ?? comp.competitors[1];
  const resolve = (c) =>
    aliases.index.get(normalize(c?.team?.displayName ?? '')) ??
    aliases.index.get(normalize(c?.team?.name ?? '')) ??
    aliases.index.get(normalize(c?.team?.abbreviation ?? ''));
  const home = resolve(homeC);
  const away = resolve(awayC);
  if (!home || !away) return null;
  const utcDate = new Date(ev.date ?? comp.date).toISOString();
  const stage = stageFromDate(utcDate);
  const hg = aliases.groups.get(home);
  const ag = aliases.groups.get(away);
  const group = stage === 'GROUP_STAGE' && hg && hg === ag ? `Group ${hg}` : null;
  const toScore = (c) => {
    const n = parseInt(String(c?.score ?? ''), 10);
    return Number.isFinite(n) ? n : null;
  };
  const status = espnStatus(ev);
  return {
    id: matchId(home, away, utcDate),
    utcDate,
    status,
    stage,
    group,
    minute: status === 'IN_PLAY' || status === 'PAUSED' ? espnMinute(ev) : null,
    homeTeam: { name: home },
    awayTeam: { name: away },
    score: {
      fullTime: {
        home: status === 'TIMED' || status === 'SCHEDULED' ? null : toScore(homeC),
        away: status === 'TIMED' || status === 'SCHEDULED' ? null : toScore(awayC),
      },
    },
    espnId: ev.id != null ? String(ev.id) : undefined,
    source: 'espn',
  };
}

function ymdUTC(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function* dateRange(fromISO, toISO) {
  const d = new Date(`${fromISO}T00:00:00Z`);
  const end = new Date(`${toISO}T00:00:00Z`);
  while (d <= end) {
    yield ymdUTC(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

/** ESPN を日付リストで叩いてイベント収集 (event id で重複排除) */
async function fetchEspnEvents(dates, errors) {
  const seen = new Map();
  for (const date of dates) {
    try {
      const data = await fetchJson(`${ESPN_BASE}?dates=${date}`);
      for (const ev of data?.events ?? []) {
        if (ev?.id != null && !seen.has(String(ev.id))) seen.set(String(ev.id), ev);
      }
    } catch (e) {
      errors.push(`espn ${date}: ${e.message}`);
    }
  }
  return [...seen.values()];
}

// ───────────────────────── マージ & 検証 ─────────────────────────

const STATUS_RANK = {
  SCHEDULED: 0, TIMED: 0, POSTPONED: 0, CANCELLED: 0,
  LIVE: 1, IN_PLAY: 1, PAUSED: 1,
  FINISHED: 2,
};

/** リテンション・マージ: 既公開に存在し fresh に無い試合は保持。FINISHED は退行させない。 */
function retentionMerge(prevMatches, freshMatches) {
  const byId = new Map();
  for (const p of prevMatches) byId.set(p.id, p);
  for (const f of freshMatches) {
    const prev = byId.get(f.id);
    if (prev && prev.status === 'FINISHED' && f.status !== 'FINISHED') {
      // 公式確定済みを速報やプレースホルダで上書きしない
      continue;
    }
    byId.set(f.id, f);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.utcDate) - new Date(b.utcDate) || a.id.localeCompare(b.id),
  );
}

function applyOverrides(matches, overrides, errors) {
  if (!overrides || Object.keys(overrides).length === 0) return matches;
  const byId = new Map(matches.map((m) => [m.id, m]));
  for (const [id, o] of Object.entries(overrides)) {
    const m = byId.get(id);
    if (!m) {
      errors.push(`override: unknown match id ${id}`);
      continue;
    }
    byId.set(id, {
      ...m,
      status: o.status ?? m.status,
      score: {
        ...m.score,
        fullTime: {
          home: o.home ?? m.score.fullTime.home,
          away: o.away ?? m.score.fullTime.away,
        },
      },
      source: 'override',
    });
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.utcDate) - new Date(b.utcDate) || a.id.localeCompare(b.id),
  );
}

function validate(matches, prevMatches, aliases) {
  const problems = [];
  for (const m of matches) {
    const { home, away } = m.score.fullTime;
    if (home !== null && typeof home !== 'number') problems.push(`${m.id}: non-numeric home score`);
    if (away !== null && typeof away !== 'number') problems.push(`${m.id}: non-numeric away score`);
    if (!aliases.groups.has(m.homeTeam.name)) problems.push(`${m.id}: unknown home ${m.homeTeam.name}`);
    if (!aliases.groups.has(m.awayTeam.name)) problems.push(`${m.id}: unknown away ${m.awayTeam.name}`);
    if (Number.isNaN(Date.parse(m.utcDate))) problems.push(`${m.id}: bad utcDate`);
  }
  if (matches.length < prevMatches.length) {
    problems.push(`match count shrank ${prevMatches.length} -> ${matches.length}`);
  }
  const byId = new Map(matches.map((m) => [m.id, m]));
  for (const p of prevMatches) {
    if (p.status !== 'FINISHED' || p.source === 'override') continue;
    const cur = byId.get(p.id);
    if (!cur) problems.push(`finished match disappeared: ${p.id}`);
    else if (cur.status !== 'FINISHED' && cur.source !== 'override')
      problems.push(`finished match regressed: ${p.id} -> ${cur.status}`);
  }
  const gs = matches.filter((m) => m.stage === 'GROUP_STAGE');
  if (gs.length >= 72) {
    const seen = new Set();
    for (const m of gs) {
      seen.add(m.homeTeam.name);
      seen.add(m.awayTeam.name);
    }
    for (const team of aliases.groups.keys()) {
      if (!seen.has(team)) problems.push(`draft team missing from fixtures: ${team}`);
    }
  }
  return problems;
}

// ───────────────────────── 公開 ─────────────────────────

function stableBody(envelope) {
  // generatedAt 等の揺れを除いた比較用シリアライズ
  return JSON.stringify({ ...envelope, meta: { ...envelope.meta, generatedAt: '', sources: {} } });
}

function pushDataBranch(envelope) {
  const token = process.env.GITHUB_TOKEN;
  const remote = token
    ? `https://x-access-token:${token}@github.com/${REPO_SLUG}.git`
    : `https://github.com/${REPO_SLUG}.git`;
  const work = mkdtempSync(join(tmpdir(), 'wc2026-data-'));
  try {
    const run = (cmd) => execSync(cmd, { cwd: work, stdio: 'pipe' });
    run(`git init -q -b ${DATA_BRANCH}`);
    run('git config user.name "wc2026-results-bot"');
    run('git config user.email "actions@github.com"');
    writeFileSync(join(work, 'results.json'), JSON.stringify(envelope, null, 1));
    run('git add results.json');
    run(`git commit -q -m "results ${envelope.meta.generatedAt}"`);
    execSync(`git push --force "${remote}" ${DATA_BRANCH}`, {
      cwd: work,
      stdio: 'pipe',
      timeout: 60_000,
    });
  } finally {
    try {
      rmSync(work, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
}

// ───────────────────────── メイン ─────────────────────────

async function singlePass(aliases) {
  const errors = [];
  const sources = { footballData: 'missing-token', espn: 'ok' };

  // 既公開分 (リテンション + 退行検知の基準)
  let prev = null;
  try {
    prev = await fetchJson(`${RAW_RESULTS_URL}?nocache=${Math.random()}`);
  } catch {
    log('no previous results.json (first run?)');
  }
  const prevMatches = prev?.matches ?? [];

  // 1) football-data.org (トークンがあれば)
  const token = process.env.FOOTBALL_DATA_TOKEN;
  let fdMatches = null;
  if (token) {
    try {
      const fdData = await fetchJson(FD_URL, { 'X-Auth-Token': token });
      fdMatches = mapFdMatches(fdData, aliases);
      sources.footballData = 'ok';
      log(`football-data: ${fdMatches.length} matches`);
    } catch (e) {
      sources.footballData = `error: ${e.message}`;
      errors.push(`football-data: ${e.message}`);
      log('football-data FAILED:', e.message);
      if (/UNMAPPED/.test(e.message)) throw e; // エイリアス欠落は人間の修正が必要
    }
  }

  // 2) ESPN
  const needSweep =
    prevMatches.filter((m) => m.stage === 'GROUP_STAGE').length < 72 ||
    !prev?.meta?.lastFullSweep ||
    Date.now() - Date.parse(prev.meta.lastFullSweep) > FULL_SWEEP_TTL_MS;
  const today = new Date();
  const nearDates = [-1, 0, 1].map((d) => {
    const x = new Date(today);
    x.setUTCDate(x.getUTCDate() + d);
    return ymdUTC(x);
  });
  const dates = needSweep ? [...dateRange(TOURNAMENT_START, TOURNAMENT_END)] : nearDates;
  log(`espn: fetching ${dates.length} date(s)${needSweep ? ' (full sweep)' : ''}`);
  const espnEvents = await fetchEspnEvents(dates, errors);
  if (espnEvents.length === 0 && errors.some((e) => e.startsWith('espn'))) {
    sources.espn = 'error';
  }
  const espnMatches = espnEvents.map((ev) => mapEspnEvent(ev, aliases)).filter(Boolean);
  log(`espn: ${espnMatches.length} mapped events`);

  // 3) 正準データ組み立て
  let fresh;
  if (fdMatches && fdMatches.length > 0) {
    // fd が正準。ESPN は espnId のクロスワークのみ付与
    const espnByPair = new Map();
    for (const e of espnMatches) {
      espnByPair.set(`${e.homeTeam.name}|${e.awayTeam.name}|${e.utcDate.slice(0, 10)}`, e);
      espnByPair.set(`${e.awayTeam.name}|${e.homeTeam.name}|${e.utcDate.slice(0, 10)}`, e);
    }
    const unmatched = new Set(espnMatches.map((e) => e.espnId));
    fresh = fdMatches.map((m) => {
      const e = espnByPair.get(`${m.homeTeam.name}|${m.awayTeam.name}|${m.utcDate.slice(0, 10)}`);
      if (e && Math.abs(Date.parse(e.utcDate) - Date.parse(m.utcDate)) <= 30 * 60 * 1000) {
        unmatched.delete(e.espnId);
        return { ...m, espnId: e.espnId };
      }
      return m;
    });
    const unmatchedNames = espnMatches
      .filter((e) => unmatched.has(e.espnId))
      .map((e) => `${e.homeTeam.name} vs ${e.awayTeam.name} (${e.utcDate.slice(0, 10)})`)
      .slice(0, 20);
    if (unmatchedNames.length) log('espn events with no fd fixture:', unmatchedNames.join(' | '));
  } else {
    // ブートストラップ: ESPN がそのまま正準
    fresh = espnMatches;
  }

  // 4) リテンション + オーナー上書き
  const overrides = loadOverrides();
  let merged = retentionMerge(prevMatches, fresh);
  merged = applyOverrides(merged, overrides, errors);

  // 5) 検証
  const problems = validate(merged, prevMatches, aliases);
  if (problems.length > 0) {
    console.error('VALIDATION REJECTED (not publishing):');
    for (const p of problems) console.error(' -', p);
    throw new Error(`validation failed: ${problems.length} problem(s)`);
  }

  // 6) 公開 (内容が変わったときだけ)
  const envelope = {
    meta: {
      generatedAt: new Date().toISOString(),
      sources,
      lastFullSweep: needSweep ? new Date().toISOString() : (prev?.meta?.lastFullSweep ?? null),
      unmatchedEspn: [],
      errors: errors.slice(0, 10),
    },
    matches: merged,
  };
  if (prev && stableBody(prev) === stableBody(envelope)) {
    log('no content change — skip publish');
  } else {
    pushDataBranch(envelope);
    log(`published ${merged.length} matches to ${DATA_BRANCH} branch`);
  }
  return merged;
}

function inLiveWindow(matches) {
  const now = Date.now();
  return matches.some((m) => {
    if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(m.status)) return true;
    const t = Date.parse(m.utcDate);
    return Number.isFinite(t) && Math.abs(now - t) <= 2 * 3600 * 1000 && m.status !== 'FINISHED';
  });
}

async function main() {
  if (new Date().toISOString().slice(0, 10) > HARD_STOP) {
    log(`past hard stop ${HARD_STOP} — exiting`);
    return;
  }
  const aliases = loadAliases();
  log(`aliases: ${aliases.count} teams, ${aliases.index.size} keys`);

  let merged = await singlePass(aliases);
  for (const delay of LOOP_DELAYS_MS) {
    if (!inLiveWindow(merged)) break;
    log(`live window — next pass in ${delay / 1000}s`);
    await new Promise((r) => setTimeout(r, delay));
    merged = await singlePass(aliases);
  }
  log('done');
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
