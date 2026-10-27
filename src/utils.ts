import type { ActivityDay, Rating, ReviewSchedule, WordStatus } from './types';

const DAY_MS = 86_400_000;

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function formatToday(date = new Date()): string {
  const datePart = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
  }).format(date);
  const weekday = new Intl.DateTimeFormat('zh-CN', {
    weekday: 'long',
  }).format(date);
  return `${datePart} · ${weekday}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatFullDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function formatDue(iso: string | null, now = new Date()): string {
  if (!iso) return '暂未安排';
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return '—';

  const diff = due.getTime() - now.getTime();
  if (diff <= 0) return '现在可以复习';

  const minutes = Math.ceil(diff / 60_000);
  if (minutes <= 60) return `${minutes} 分钟后`;

  const hours = Math.ceil(diff / 3_600_000);
  if (hours < 6) return `${hours} 小时后`;

  const today = startOfDay(now);
  const dueDay = startOfDay(due);
  const dayDiff = Math.round((dueDay.getTime() - today.getTime()) / DAY_MS);
  const time = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(due);

  if (dayDiff === 0) return `今天 ${time}`;
  if (dayDiff === 1) return `明天 ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    const weekday = new Intl.DateTimeFormat('zh-CN', {
      weekday: 'short',
    }).format(due);
    return `${weekday} ${time}`;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(due);
}

export function formatNextReview(iso: string | null): string {
  if (!iso) return '暂时没有安排';
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return '—';
  const diff = due.getTime() - Date.now();
  if (diff <= 60_000) return '马上';
  const minutes = Math.ceil(diff / 60_000);
  if (minutes < 60) return `${minutes} 分钟后`;
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return `${hours} 小时后`;
  const days = Math.round(diff / DAY_MS);
  return `${days} 天后（${formatDateTime(iso)}）`;
}

export function formatSchedule(schedule: ReviewSchedule): string {
  if (schedule.rating === 'unknown') {
    return `${schedule.intervalMinutes} 分钟后再次出现`;
  }
  if (schedule.intervalDays === 1) return '明天再复习一次';
  return `${schedule.intervalDays} 天后再复习`;
}

export const STATUS_META: Record<
  WordStatus,
  { label: string; shortLabel: string; className: string }
> = {
  new: { label: '新词', shortLabel: '待初见', className: 'status-new' },
  learning: { label: '学习中', shortLabel: '巩固中', className: 'status-learning' },
  reviewing: { label: '巩固中', shortLabel: '稳定期', className: 'status-reviewing' },
  mastered: { label: '已掌握', shortLabel: '已掌握', className: 'status-mastered' },
};

export const RATING_LABEL: Record<Rating, string> = {
  known: '认识',
  unknown: '不认识',
};

export function percentage(value: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

export interface HighlightPart {
  text: string;
  highlighted: boolean;
}

export function splitHighlightedSentence(
  sentence: string,
  term: string,
): HighlightPart[] {
  if (!term.trim()) return [{ text: sentence, highlighted: false }];

  const escaped = escapeRegExp(term.trim())
    .replace(/\\ /g, '\\s+')
    .replace(/\s+/g, '\\s+');
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`,
    'giu',
  );

  const parts: HighlightPart[] = [];
  let lastIndex = 0;
  for (const match of sentence.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ text: sentence.slice(lastIndex, index), highlighted: false });
    }
    parts.push({ text: match[0], highlighted: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < sentence.length) {
    parts.push({ text: sentence.slice(lastIndex), highlighted: false });
  }

  return parts.length ? parts : [{ text: sentence, highlighted: false }];
}

export function activityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

export function activityTotal(activity: ActivityDay[]): number {
  return activity.reduce((sum, day) => sum + day.count, 0);
}

export function dayLabel(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function sumKnownToday(known: number, reviewed: number): number {
  return Math.min(known, reviewed);
}
