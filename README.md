# WC2026 ドラフト・ダッシュボード ⚽

4人で行った2026 FIFAワールドカップ「国取りドラフト」のリアルタイム順位・スコアを追跡するスマホ/PC両対応ダッシュボード。

🌐 **公開URL: <https://icryptochameleon.github.io/wc2026-dashboard/>**

## 技術スタック
- Vite + React + TypeScript
- Tailwind CSS (ダークモード)
- Recharts (得点推移グラフ・貢献度バー)
- React Router (`HashRouter` — GitHub Pages対応)
- LocalStorage によるオフラインキャッシュ

## クイックスタート

```powershell
# Node.js が PATH に通っていない場合
$env:Path = "C:\Program Files\nodejs;$env:Path"

# 依存はインストール済み (npm install 不要)
npm run dev    # http://localhost:5173 で開く
npm run build  # dist/ に本番ビルド
npm run preview # ビルド成果物をプレビュー
```

## 機能タブ

| タブ | 内容 |
|------|------|
| 🏠 ホーム | ① 🔴 BATTLE NOW (LIVE試合) ② 🏆 スコアボード (4人の順位+前回比) ③ ⏭️ 次の試合 (JST表示) ④ 📜 最新結果 ⑤ 📈 得点推移グラフ |
| 👤 選手 | プレイヤー切り替え式の詳細画面。所有12チームのステータス・獲得pt・貢献度ランキング (棒グラフ) |
| 🏆 対戦表 | 12 グループ順位表 (オーナーカラー●付き) + R32→R16→QF→SF→決勝のブラケット (横スクロール) + 3位決定戦 |
| 📊 統計 | プレイヤー × グループの分布ヒートマップ・最も貢献したチーム TOP5・ステージ別の進出/敗退カウント |
| ⚙️ 設定 | プレイヤー名編集・Football-Data.org API キー・The Odds API キー・手動スコア入力 (72試合)・データリセット |

## 得点ルール (累積式)

| 区分 | ポイント |
|------|---------|
| グループ勝利 | +3,000 |
| グループ引分/敗戦 | 0 |
| ベスト32進出 | +10,000 |
| ベスト16進出 | +20,000 |
| ベスト8進出 | +30,000 |
| ベスト4進出 | +50,000 |
| 3位 | +60,000 |
| 準優勝 | +75,000 |
| 優勝 | +100,000 |

例: フランスが GL 3 勝→Best32→Best16→QF→SF→優勝 = 3,000×3 + 10,000 + 20,000 + 30,000 + 50,000 + 100,000 = **219,000pt**

## API キーの取得

### Football-Data.org (試合データ)
1. <https://www.football-data.org/client/register> で無料アカウント作成
2. メール認証後、ダッシュボードに表示される `X-Auth-Token` をコピー
3. アプリの `設定` タブで貼り付け → `今すぐ再取得`
4. 無料枠: 10 req/min, 月150まで。当アプリは 5分間隔ポーリング (LIVE時1分)

### The Odds API (任意・オッズ表示)
1. <https://the-odds-api.com/> で無料登録 (月500リクエスト)
2. `設定` タブのオッズキーに貼り付け

未設定でも手動入力モードで完全に動作します。

## GitHub Pages 更新

コードを編集 → push → 公開URL に反映する流れ:

```powershell
# ① コード編集 → main にコミット & push
git add .
git commit -m "..."
git push

# ② 公開サイトを更新
npm run deploy   # 内部で npm run build → gh-pages -d dist
```

数分後 <https://icryptochameleon.github.io/wc2026-dashboard/> に反映されます。

リポジトリ: <https://github.com/icryptochameleon/wc2026-dashboard>

vite.config.ts は `base: './'` 指定なのでサブパス・ルートどちらでも動作。

## ファイル構成

```
src/
├─ main.tsx / App.tsx
├─ config/        scoring・teams・api
├─ types/         TS型定義
├─ utils/         得点計算・日付・チームメタ
├─ hooks/         useMatchData / useLocalStorage
├─ context/       GameContext (グローバル状態)
├─ data/          defaultSchedule (オフライン用 72試合)
├─ components/
│   ├─ layout/    Header / TabBar / Footer
│   ├─ dashboard/ Scoreboard / BattleNow / NextBattle / RecentResults / ScoreChart
│   ├─ player/    PlayerDetail / TeamCard / TeamContribution
│   ├─ tournament/ GroupStage / GroupTable / Bracket / BracketMatch
│   ├─ stats/     MountainMap / Predictions
│   └─ settings/  Settings / ManualInput / ApiKeyInput
└─ pages/         DashboardPage / PlayerPage / TournamentPage / StatsPage / SettingsPage
```

## 既知の事項

- Windows 上のブラウザでは国旗 emoji がフォント未対応で `BR` `MX` のように 2 文字コード表示になります (iOS/Android/Mac/Chromebook では絵文字として表示)。
- グループ順位表は同点・全試合 0-0 のとき、アルファベット順にソートされます (得失点差→アルファベットの順)。
- 試合進行データは `localStorage` (`wc2026_matches`) にキャッシュされます。`設定 → 試合データをリセット` で初期スケジュールに戻せます。
