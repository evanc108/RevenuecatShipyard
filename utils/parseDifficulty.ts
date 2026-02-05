const DIFFICULTY_MAP: Record<string, number> = {
  easy: 1,
  medium: 2,
  moderate: 2,
  intermediate: 3,
  hard: 4,
  difficult: 4,
  expert: 5,
};

export function parseDifficulty(difficulty?: string): number {
  if (!difficulty) return 0;
  const mapped = DIFFICULTY_MAP[difficulty.toLowerCase()];
  if (mapped !== undefined) return mapped;
  const num = parseInt(difficulty, 10);
  if (!isNaN(num) && num >= 1 && num <= 5) return num;
  return 3;
}
