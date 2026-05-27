/**
 * チーム名から国旗 emoji を返す。
 * (Football-Data.org の英名表記をベースに、表記揺れを吸収)
 */
const FLAG_MAP: Record<string, string> = {
  france: '🇫🇷',
  england: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  belgium: '🇧🇪',
  usa: '🇺🇸',
  'united states': '🇺🇸',
  morocco: '🇲🇦',
  norway: '🇳🇴',
  switzerland: '🇨🇭',
  ecuador: '🇪🇨',
  czechia: '🇨🇿',
  'czech republic': '🇨🇿',
  algeria: '🇩🇿',
  'saudi arabia': '🇸🇦',
  panama: '🇵🇦',
  brazil: '🇧🇷',
  germany: '🇩🇪',
  mexico: '🇲🇽',
  turkey: '🇹🇷',
  türkiye: '🇹🇷',
  ghana: '🇬🇭',
  austria: '🇦🇹',
  'bosnia and herzegovina': '🇧🇦',
  'cape verde': '🇨🇻',
  'dr congo': '🇨🇩',
  'democratic republic of congo': '🇨🇩',
  tunisia: '🇹🇳',
  uzbekistan: '🇺🇿',
  haiti: '🇭🇹',
  argentina: '🇦🇷',
  netherlands: '🇳🇱',
  colombia: '🇨🇴',
  uruguay: '🇺🇾',
  croatia: '🇭🇷',
  senegal: '🇸🇳',
  paraguay: '🇵🇾',
  'ivory coast': "🇨🇮",
  "cote d'ivoire": "🇨🇮",
  iran: '🇮🇷',
  'south africa': '🇿🇦',
  canada: '🇨🇦',
  iraq: '🇮🇶',
  spain: '🇪🇸',
  japan: '🇯🇵',
  portugal: '🇵🇹',
  scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  egypt: '🇪🇬',
  curacao: '🇨🇼',
  curaçao: '🇨🇼',
  australia: '🇦🇺',
  qatar: '🇶🇦',
  sweden: '🇸🇪',
  'south korea': '🇰🇷',
  'korea republic': '🇰🇷',
  'new zealand': '🇳🇿',
  jordan: '🇯🇴',
};

const TEAM_JA: Record<string, string> = {
  france: 'フランス',
  england: 'イングランド',
  belgium: 'ベルギー',
  usa: 'アメリカ',
  morocco: 'モロッコ',
  norway: 'ノルウェー',
  switzerland: 'スイス',
  ecuador: 'エクアドル',
  czechia: 'チェコ',
  algeria: 'アルジェリア',
  'saudi arabia': 'サウジアラビア',
  panama: 'パナマ',
  brazil: 'ブラジル',
  germany: 'ドイツ',
  mexico: 'メキシコ',
  turkey: 'トルコ',
  ghana: 'ガーナ',
  austria: 'オーストリア',
  'bosnia and herzegovina': 'ボスニア',
  'cape verde': 'カーボベルデ',
  'dr congo': 'コンゴ民主共和国',
  tunisia: 'チュニジア',
  uzbekistan: 'ウズベキスタン',
  haiti: 'ハイチ',
  argentina: 'アルゼンチン',
  netherlands: 'オランダ',
  colombia: 'コロンビア',
  uruguay: 'ウルグアイ',
  croatia: 'クロアチア',
  senegal: 'セネガル',
  paraguay: 'パラグアイ',
  'ivory coast': 'コートジボワール',
  iran: 'イラン',
  'south africa': '南アフリカ',
  canada: 'カナダ',
  iraq: 'イラク',
  spain: 'スペイン',
  japan: '日本',
  portugal: 'ポルトガル',
  scotland: 'スコットランド',
  egypt: 'エジプト',
  curacao: 'キュラソー',
  australia: 'オーストラリア',
  qatar: 'カタール',
  sweden: 'スウェーデン',
  'south korea': '韓国',
  'new zealand': 'ニュージーランド',
  jordan: 'ヨルダン',
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getFlag(team: string): string {
  return FLAG_MAP[norm(team)] ?? '🏳️';
}

export function getTeamNameJa(team: string): string {
  return TEAM_JA[norm(team)] ?? team;
}

export function formatTeamFull(team: string): string {
  return `${getFlag(team)} ${getTeamNameJa(team)}`;
}
