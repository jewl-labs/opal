export function getTimeRemaining(deadline?: string) {
    if (!deadline) return 'Expired';
    const now = new Date();
    const end = new Date(deadline);
    let diff = end.getTime() - now.getTime();
    if (isNaN(diff) || diff < 0) return 'Expired';

    const totalSeconds = Math.floor(diff / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.length > 0 ? parts.join(' ') : 'Expired';
}