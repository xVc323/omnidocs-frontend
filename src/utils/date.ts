/**
 * Formats a date string into a relative time format
 * For example: "in 1 hour", "1 hour ago", etc.
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  
  if (diffHour > 0) {
    return `in ${diffHour} hour${diffHour !== 1 ? 's' : ''}`;
  } else if (diffMin > 0) {
    return `in ${diffMin} minute${diffMin !== 1 ? 's' : ''}`;
  } else if (diffSec > 0) {
    return `in ${diffSec} second${diffSec !== 1 ? 's' : ''}`;
  } else if (diffSec > -60) {
    return `${Math.abs(diffSec)} second${Math.abs(diffSec) !== 1 ? 's' : ''} ago`;
  } else if (diffMin > -60) {
    return `${Math.abs(diffMin)} minute${Math.abs(diffMin) !== 1 ? 's' : ''} ago`;
  } else {
    return `${Math.abs(diffHour)} hour${Math.abs(diffHour) !== 1 ? 's' : ''} ago`;
  }
} 