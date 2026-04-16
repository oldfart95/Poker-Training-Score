export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function normalizeString(input: unknown, fallback = ""): string {
  return typeof input === "string" ? input : fallback;
}

export function normalizeNumber(input: unknown, fallback = 0): number {
  return typeof input === "number" && Number.isFinite(input) ? input : fallback;
}

export function softBucket(score: number): string {
  if (score >= 90) return "Strong";
  if (score >= 78) return "Solid";
  if (score >= 65) return "Shaky";
  if (score >= 50) return "Leaky";
  return "Critical";
}

export function alphaGrade(score: number): string {
  if (score >= 93) return "A";
  if (score >= 85) return "B";
  if (score >= 75) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function formatPercent(score: number): string {
  return `${Math.round(score)}%`;
}
