const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export function toJST(utcIso: string | Date): Date {
  const d = typeof utcIso === 'string' ? new Date(utcIso) : utcIso;
  return new Date(d.getTime() + 9 * 60 * 60 * 1000);
}

/**
 * 「6月15日（日）」のような表示。
 * 5時より前は前日深夜扱いで前日の日付を返す。
 */
export function formatJSTDateLabel(utcIso: string): string {
  const j = toJST(utcIso);
  const hours = j.getUTCHours();
  let displayDay = new Date(j.getTime());
  if (hours < 5) {
    displayDay = new Date(j.getTime() - 24 * 60 * 60 * 1000);
  }
  const m = displayDay.getUTCMonth() + 1;
  const d = displayDay.getUTCDate();
  const dow = WEEK[displayDay.getUTCDay()];
  return `${m}月${d}日(${dow})`;
}

/**
 * 「25:00」のような深夜帯表記対応の時刻フォーマット
 */
export function formatJSTTime(utcIso: string): string {
  const j = toJST(utcIso);
  const h = j.getUTCHours();
  const m = j.getUTCMinutes();
  const hh = h < 5 ? h + 24 : h;
  return `${hh.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function isSameJSTDay(a: string, b: string): boolean {
  return formatJSTDateLabel(a) === formatJSTDateLabel(b);
}

/**
 * 試合開始までのカウントダウン文字列。マイナスは null。
 */
export function countdownTo(utcIso: string, now: Date = new Date()): string | null {
  const target = new Date(utcIso).getTime();
  const diff = target - now.getTime();
  if (diff < 0) return null;
  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin / 60) % 24);
  const mins = totalMin % 60;
  if (days > 0) return `${days}日${hours}時間後`;
  if (hours > 0) return `${hours}時間${mins}分後`;
  return `${mins}分後`;
}

export function formatRelativeJa(utcIso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(utcIso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return `${d}日前`;
}
