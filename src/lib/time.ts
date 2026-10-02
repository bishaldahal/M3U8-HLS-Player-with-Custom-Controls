export function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');

  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatProgress(currentTime: number, duration: number): string {
  return duration > 0
    ? `${formatTime(currentTime)} / ${formatTime(duration)}`
    : `${formatTime(currentTime)} (Live)`;
}
