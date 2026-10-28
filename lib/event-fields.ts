export type EventExtras = { startTime: string | null; location: string | null };

export function parseEventExtras(rawTime: unknown, rawLocation: unknown): EventExtras | { error: string } {
  if (rawTime != null && typeof rawTime !== 'string') {
    return { error: 'Time must be a valid 24-hour time.' };
  }
  if (rawLocation != null && typeof rawLocation !== 'string') {
    return { error: 'Location must be text.' };
  }

  const startTime = rawTime?.trim() || null;
  const location = rawLocation?.trim() || null;
  if (startTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    return { error: 'Time must use HH:MM in 24-hour format.' };
  }
  if (location && location.length > 200) {
    return { error: 'Location must be 200 characters or fewer.' };
  }
  return { startTime, location };
}
