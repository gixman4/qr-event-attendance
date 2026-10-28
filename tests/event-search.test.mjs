import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterEvents, filterAttendees, normalizePersonName, samePersonName } from '../lib/event-search.mts';

test('event search matches names, creators, ISO or readable dates, and locations', () => {
  const events = [
    { name: 'Team Meetup', creator_name: 'Élise Smith', date: '2026-10-28', location: 'Conference Room A' },
    { name: 'Quarterly Review', creator_name: null, date: '2026-11-05', location: null },
  ];
  for (const query of ['TEAM', '  élise ', '2026-10-28', 'October 28', ' conference   room ', 'room a']) {
    assert.deepEqual(filterEvents(events, query), [events[0]], query);
  }
  assert.deepEqual(filterEvents(events, 'QUARTERLY'), [events[1]]);
  assert.deepEqual(filterEvents(events, 'missing'), []);
  assert.deepEqual(filterEvents(events, '   '), events);
});

test('attendee search matches first, last, or full name without altering totals', () => {
  const attendees = [
    { first_name: 'Ana', last_name: 'Morgan' },
    { first_name: 'Jules', last_name: 'Kim' },
  ];
  for (const query of ['ana', 'MORGAN', ' Ana  Morgan ']) {
    assert.deepEqual(filterAttendees(attendees, query), [attendees[0]], query);
  }
  assert.deepEqual(filterAttendees(attendees, 'not here'), []);
  assert.deepEqual(filterAttendees(attendees, ''), attendees);
  assert.equal(attendees.length, 2);
});

test('duplicate comparison ignores case and repeated Unicode whitespace', () => {
  assert.equal(normalizePersonName('  Anne\t  Marie   '), 'Anne Marie');
  assert.ok(samePersonName(' ÉLISE  Anne ', 'Tester', 'élise anne', '  TESTER  '));
  assert.equal(samePersonName('Ana', 'Morgan', 'Ana', 'Kim'), false);
});
