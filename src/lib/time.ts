// 말풍선의 보낸 시각과 날짜 줄에 쓰는 글자. 폰의 시간대로 보여 준다.

// 서버 시각은 소수점 아래 초가 6자리일 수 있다(2026-11-05T02:03:04.123456+00:00).
// 3자리까지만 남겨 어느 JS 엔진에서나 읽히게 한다.
export function parseTime(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(d.getTime()) ? null : d;
}

// 「오후 3:12」
export function timeLabel(d: Date): string {
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? '오전' : '오후'} ${hour12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 「11월 5일 (목)」
export function dateLabel(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
