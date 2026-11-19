import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatManilaDate,
  formatObTime,
  getDeadlineStatus,
  isDueWithinDays,
  isTrfOverdue,
} from './dates';

test('formatManilaDate formats ISO dates as MMM DD, YYYY', () => {
  assert.equal(formatManilaDate('2026-11-18'), 'Nov 18, 2026');
  assert.equal(formatManilaDate(null), '—');
});

test('formatObTime formats 24h time to 12h display', () => {
  assert.equal(formatObTime('09:30:00'), '9:30 AM');
  assert.equal(formatObTime('14:05:00'), '2:05 PM');
  assert.equal(formatObTime(null), '—');
});

test('getDeadlineStatus classifies done, overdue, due_soon, and open accurately in Asia/Manila', () => {
  const fixedNow = new Date('2026-11-18T10:00:00+08:00');
  assert.equal(getDeadlineStatus('2026-11-10', '2026-11-12', fixedNow), 'done');
  assert.equal(getDeadlineStatus('2026-11-17', null, fixedNow), 'overdue');
  assert.equal(getDeadlineStatus('2026-11-18', null, fixedNow), 'due_soon');
  assert.equal(getDeadlineStatus('2026-11-20', null, fixedNow), 'due_soon');
  assert.equal(getDeadlineStatus('2026-11-21', null, fixedNow), 'open');
  assert.equal(getDeadlineStatus(null, null, fixedNow), 'none');
});

test('isDueWithinDays filters upcoming commitments within 7 days', () => {
  const fixedNow = new Date('2026-11-18T10:00:00+08:00');
  assert.equal(isDueWithinDays('2026-11-17', null, 7, fixedNow), false);
  assert.equal(isDueWithinDays('2026-11-18', null, 7, fixedNow), true);
  assert.equal(isDueWithinDays('2026-11-25', null, 7, fixedNow), true);
  assert.equal(isDueWithinDays('2026-11-26', null, 7, fixedNow), false);
  assert.equal(isDueWithinDays('2026-11-19', '2026-11-18', 7, fixedNow), false);
});

test('isTrfOverdue only flags incomplete TRFs aged past SLA days', () => {
  const fixedNow = new Date('2026-11-19T10:00:00+08:00');
  assert.equal(isTrfOverdue('2026-11-19', 'Filed', null, 3, fixedNow), false);
  assert.equal(isTrfOverdue('2026-11-16', 'Filed', null, 3, fixedNow), false);
  assert.equal(isTrfOverdue('2026-11-11', 'In MD', null, 3, fixedNow), true);
  assert.equal(isTrfOverdue('2026-11-09', 'Completed', '2026-11-12', 3, fixedNow), false);
});
