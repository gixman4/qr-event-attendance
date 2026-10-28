export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

export function personNameKey(value: string): string {
  return normalizePersonName(value).toLocaleLowerCase();
}

export function samePersonName(firstA: string, lastA: string, firstB: string, lastB: string): boolean {
  return personNameKey(firstA) === personNameKey(firstB) && personNameKey(lastA) === personNameKey(lastB);
}

export function filterAttendees<T extends { first_name: string; last_name: string }>(attendees: T[], search: string): T[] {
  const query = personNameKey(search);
  if (!query) return attendees;
  return attendees.filter((attendee) =>
    personNameKey(`${attendee.first_name} ${attendee.last_name}`).includes(query)
  );
}

export function filterEvents<T extends { name: string; creator_name: string | null; date: string; location: string | null }>(events: T[], search: string): T[] {
  const query = personNameKey(search);
  if (!query) return events;
  return events.filter((event) => {
    const parsed = new Date(`${event.date}T00:00:00Z`);
    const readableDate = Number.isNaN(parsed.getTime())
      ? ''
      : new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
    return personNameKey([event.name, event.creator_name ?? '', event.date, readableDate, event.location ?? ''].join(' ')).includes(query);
  });
}
