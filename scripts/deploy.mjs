#!/usr/bin/env node
/**
 * GitHub Pages デプロイ (OneDrive ロック回避版)
 *
 * 1. dist/ を OS の一時ディレクトリに展開
 * 2. gh-pages ブランチを浅くクローン
 * 3. 中身を dist/ で置き換え
 * 4. commit & push
 *
 * 通常の `gh-pages` パッケージは node_modules/.cache に作業ディレクトリを作るが、
 * OneDrive 同期されるフォルダ内では git lock とぶつかって詰まりやすいので、
 * OS の TMP 配下で完結させる。
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true, ...opts });
}

function runQuiet(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', shell: true, ...opts }).trim();
}

if (!existsSync(DIST)) {
  console.error('dist/ が見つかりません。先に `npm run build` を実行してください。');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const repoUrl = (() => {
  // homepage か git remote から URL を推定
  try {
    return runQuiet('git remote get-url origin');
  } catch {
    return pkg.homepage?.replace(/\/$/, '') + '.git';
  }
})();

if (!repoUrl) {
  console.error('GitHub リポジトリの URL を解決できませんでした。');
  process.exit(1);
}

const author = (() => {
  try {
    const name = runQuiet('git log -1 --pretty=%an');
    const email = runQuiet('git log -1 --pretty=%ae');
    return { name, email };
  } catch {
    return { name: 'wc2026-deploy', email: 'noreply@example.com' };
  }
})();

const work = mkdtempSync(join(tmpdir(), 'wc2026-deploy-'));
console.log(`一時作業ディレクトリ: ${work}`);

try {
  // 1. shallow clone (gh-pages ブランチが無くても OK)
  let hasBranch = true;
  try {
    run(`git clone --depth=1 --branch gh-pages "${repoUrl}" "${work}"`);
  } catch {
    hasBranch = false;
    console.log('gh-pages ブランチが未作成のため、空ブランチで初期化します。');
    run(`git clone --depth=1 "${repoUrl}" "${work}"`);
  }

  // 2. 中身を一旦消す (.git は残す)
  for (const f of readdirSync(work)) {
    if (f === '.git') continue;
    rmSync(join(work, f), { recursive: true, force: true });
  }

  // 3. dist/ の中身をコピー
  for (const f of readdirSync(DIST)) {
    cpSync(join(DIST, f), join(work, f), { recursive: true });
  }
  // Jekyll 無効化
  writeFileSync(join(work, '.nojekyll'), '');

  // 4. commit & push
  process.chdir(work);
  if (!hasBranch) {
    run('git checkout --orphan gh-pages');
    run('git rm -rf --cached . || true');
  }
  run('git add -A');
  const hasChanges = (() => {
    try {
      runQuiet('git diff --cached --quiet');
      return false;
    } catch {
      return true;
    }
  })();
  if (!hasChanges) {
    console.log('差分なし — push スキップ');
  } else {
    const msg = `Deploy ${new Date().toISOString()}`;
    run(`git -c user.name="${author.name}" -c user.email="${author.email}" commit -m "${msg}"`);
    run('git push origin gh-pages');
    console.log('✅ デプロイ完了');
  }
} finally {
  process.chdir(ROOT);
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore — temp dir cleanup is best-effort */
  }
}
