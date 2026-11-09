import {describe, expect, it} from 'vitest'
import {taskDueLevel} from './taskDueLevel'

// Local-time dates, so the calendar-day results do not depend on the machine's time zone.
const NOW = new Date(2026, 10, 8, 12, 0)
const ZERO_DATE = '0001-01-01T00:00:00Z'

function at(dayOffset: number, hours = 12, minutes = 0) {
	return new Date(2026, 10, 8 + dayOffset, hours, minutes).toISOString()
}

describe('taskDueLevel', () => {
	it.each([
		['null', null],
		['missing', undefined],
		['the zero date', ZERO_DATE],
		['an unparsable value', 'not a date'],
	])('has nothing to show without a usable due date: %s', (_label, due_date) => {
		expect(taskDueLevel({due_date}, NOW)).toBeNull()
	})

	it.each([
		['in the past', at(-3)],
		['in the future', at(3)],
	])('has nothing to show for a done task due %s', (_label, due_date) => {
		expect(taskDueLevel({done: true, due_date}, NOW)).toBeNull()
	})

	it.each([
		['yesterday', at(-1), 'overdue'],
		['today, earlier than now', at(0, 11, 59), 'overdue'],
		['exactly now', NOW.toISOString(), 'overdue'],
		['today, later than now', at(0, 12, 1), 'soon'],
		['tomorrow', at(1), 'soon'],
		['in 14 days, at the end of the day', at(14, 23, 59), 'soon'],
		['in 15 days, right after midnight', at(15, 0, 1), 'horizon'],
		['in 30 days, at the end of the day', at(30, 23, 59), 'horizon'],
		['in 31 days, right after midnight', at(31, 0, 1), 'plain'],
	])('rates a task due %s as %s', (_label, due_date, expected) => {
		expect(taskDueLevel({done: false, due_date}, NOW)).toBe(expected)
	})
})
