/** Admin stats window: omit/`all` = lifetime; number = last N calendar days incl. today. */
export type AdminStatsPeriod = 'all' | 7 | 30 | 365;

export const ADMIN_PERIOD_OPTIONS: Array<{ value: AdminStatsPeriod; label: string }> = [
  { value: 7, label: '7 ngày qua' },
  { value: 30, label: '30 ngày qua' },
  { value: 365, label: '1 năm qua' },
  { value: 'all', label: 'Toàn thời gian' },
];

export function periodToQueryDays(period: AdminStatsPeriod): number | undefined {
  return period === 'all' ? undefined : period;
}

export function periodLabel(period: AdminStatsPeriod): string {
  return ADMIN_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? 'Toàn thời gian';
}
