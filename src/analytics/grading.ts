export const DEFAULT_THRESHOLDS = { core: 85, strong: 70, watch: 50 } as const;
export type Thresholds = { core: number; strong: number; watch: number };
export function grade(score: number | null, thresholds: Thresholds = DEFAULT_THRESHOLDS) {
  if (!(thresholds.core <= 100 && thresholds.core > thresholds.strong && thresholds.strong > thresholds.watch && thresholds.watch >= 0)) throw Error('INVALID_GRADE_THRESHOLDS');
  if (score === null || !Number.isFinite(score) || score < 0 || score > 100) return null;
  return score >= thresholds.core ? '핵심 주도 후보' : score >= thresholds.strong ? '강세' : score >= thresholds.watch ? '관찰' : '비주도';
}
