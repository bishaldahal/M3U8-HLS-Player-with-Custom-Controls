function majorMinor(version: string): [number, number] | null {
  const match = /^v?(\d+)\.(\d+)/i.exec(version.trim());
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** True when the major or minor version went up; patch-only updates return false. */
export function isFeatureUpdate(previous: string | undefined, current: string): boolean {
  if (!previous) return false;
  const from = majorMinor(previous);
  const to = majorMinor(current);
  if (!from || !to) return false;
  return to[0] > from[0] || (to[0] === from[0] && to[1] > from[1]);
}
