export function getTimeRemaining(deadline?: string) {
    if (!deadline) return '00:00:00:00';
    const now = new Date();
    const end = new Date(deadline);
    let diff = end.getTime() - now.getTime();
    if (isNaN(diff) || diff < 0) return '00:00:00:00';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    diff -= days * 1000 * 60 * 60 * 24;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    diff -= hours * 1000 * 60 * 60;
    const minutes = Math.floor(diff / (1000 * 60));
    diff -= minutes * 1000 * 60;
    const seconds = Math.floor(diff / 1000);
    return [days, hours, minutes, seconds]
      .map((v) => v.toString().padStart(2, '0'))
      .join(':');
}