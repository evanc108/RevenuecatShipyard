/**
 * Format a number with K/M suffix for large values.
 * @example formatCount(1234) => "1.2K"
 * @example formatCount(1500000) => "1.5M"
 */
export function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return count.toString();
}
