/** Invalid times stay unknown instead of becoming midnight or a booked slot. */
export const normalizeTime = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match || Number(match[1]) > 23) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

export const timeToMinutes = (value: unknown): number => {
  const time = normalizeTime(value);
  if (!time) return Number.NaN;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const formatTime = (value: unknown): string => normalizeTime(value) || 'Sin hora';

export const formatTimeRange = (start: unknown, end: unknown): string => {
  const from = normalizeTime(start);
  const to = normalizeTime(end);
  if (!from && !to) return 'Horario no definido';
  return `${from || 'Sin hora'} - ${to || 'Sin hora'}`;
};

export const compareTimes = (first: unknown, second: unknown): number => {
  const firstMinutes = timeToMinutes(first);
  const secondMinutes = timeToMinutes(second);
  // Unknown times sort last, while midnight is still a valid time.
  return (Number.isNaN(firstMinutes) ? 1440 : firstMinutes)
    - (Number.isNaN(secondMinutes) ? 1440 : secondMinutes);
};
