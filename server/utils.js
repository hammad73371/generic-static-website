export function wpmFromCounts(charsCorrect, elapsedMs) {
  const minutes = elapsedMs / 60000;
  const words = charsCorrect / 5;
  return Math.round(words / Math.max(minutes, 1/60000));
}
export function cpmFromCounts(charsCorrect, elapsedMs) {
  const minutes = elapsedMs / 60000;
  return Math.round(charsCorrect / Math.max(minutes, 1/60000));
}