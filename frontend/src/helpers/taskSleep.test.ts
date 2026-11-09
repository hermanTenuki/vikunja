import {describe, expect, it} from 'vitest'
import {formatSleepStartDate, sleepBadgeLabel, taskSleepDays} from './taskSleep'

// Local-time dates, so the calendar-day results do not depend on the machine's time zone.
const NOW = new Date(2026, 10, 8, 23, 59)
const ZERO_DATE = '0001-01-01T00:00:00Z'

function at(dayOffset: number, hours = 12, minutes = 0) {
	return new Date(2026, 10, 8 + dayOffset, hours, minutes).toISOString()
}

describe('taskSleepDays', () => {
	it.each([
		['today, late in the evening', at(0, 23, 59), 0],
		['today, early in the morning', at(0, 0, 1), 0],
		['yesterday', at(-1), 0],
		['tomorrow, a minute after midnight', at(1, 0, 1), 1],
		['in 2 days', at(2), 2],
		['in 14 days', at(14), 14],
		['in 15 days', at(15), 15],
		['in 300 days', at(300), 300],
		['in 301 days', at(301), 301],
	])('counts calendar days to a start date %s', (_label, start_date, expected) => {
		expect(taskSleepDays({start_date}, NOW)).toBe(expected)
	})

	it.each([
		['null', null],
		['missing', undefined],
		['the zero date', ZERO_DATE],
		['an unparsable value', 'not a date'],
	])('is awake without a start date: %s', (_label, start_date) => {
		expect(taskSleepDays({start_date}, NOW)).toBe(0)
	})

	it('sleeps when there is no due date', () => {
		expect(taskSleepDays({start_date: at(5), due_date: null}, NOW)).toBe(5)
	})

	it('treats the zero due date as no due date', () => {
		expect(taskSleepDays({start_date: at(5), due_date: ZERO_DATE}, NOW)).toBe(5)
	})

	it('treats an unparsable due date as no due date', () => {
		expect(taskSleepDays({start_date: at(5), due_date: 'not a date'}, NOW)).toBe(5)
	})

	it('sleeps when the due day equals the start day, even if the due time is earlier', () => {
		expect(taskSleepDays({start_date: at(5, 18), due_date: at(5, 9)}, NOW)).toBe(5)
	})

	it('sleeps when the due day is after the start day', () => {
		expect(taskSleepDays({start_date: at(5), due_date: at(10)}, NOW)).toBe(5)
	})

	it('is awake when the due day is before the start day', () => {
		expect(taskSleepDays({start_date: at(5), due_date: at(4, 23, 59)}, NOW)).toBe(0)
	})

	it('is awake when the task is done', () => {
		expect(taskSleepDays({start_date: at(5), done: true}, NOW)).toBe(0)
	})
})

describe('sleepBadgeLabel', () => {
	it.each([
		['en', 1, 'tomorrow'],
		['ru-RU', 1, 'завтра'],
		['en', 2, 'in 2 days'],
	])('uses a relative label in %s for %i day(s)', (locale, days, text) => {
		expect(sleepBadgeLabel(at(days), days, locale)).toEqual({kind: 'relative', text})
	})

	it('keeps the relative label at 14 days', () => {
		const label = sleepBadgeLabel(at(14), 14, 'ru-RU')

		expect(label.kind).toBe('relative')
		expect(label).toMatchObject({text: expect.stringMatching(/^через 14\s*дн\./)})
	})

	it('switches to a date without a year at 15 days', () => {
		const label = sleepBadgeLabel(new Date(2026, 10, 23, 12).toISOString(), 15, 'en')

		expect(label).toEqual({kind: 'date', date: 'Nov 23'})
	})

	it('still omits the year at 300 days', () => {
		const label = sleepBadgeLabel(new Date(2027, 8, 4, 12).toISOString(), 300, 'en')

		expect(label).toEqual({kind: 'date', date: 'Sep 4'})
	})

	it('adds the year at 301 days', () => {
		const label = sleepBadgeLabel(new Date(2027, 8, 5, 12).toISOString(), 301, 'en')

		expect(label).toEqual({kind: 'date', date: 'Sep 5, 2027'})
	})

	it('writes the date in the short Russian form', () => {
		const label = sleepBadgeLabel(new Date(2027, 0, 1, 12).toISOString(), 54, 'ru-RU')

		expect(label.kind).toBe('date')
		expect(label).toMatchObject({date: expect.stringMatching(/^1\s*янв\.$/)})
	})
})

describe('formatSleepStartDate', () => {
	it('writes the long Russian date with a year and no time', () => {
		expect(formatSleepStartDate(new Date(2027, 0, 1, 12).toISOString(), 'ru-RU')).toMatch(/^1\s*января\s*2027\s*г\./)
	})

	it('writes the long English date', () => {
		expect(formatSleepStartDate(new Date(2027, 0, 1, 12).toISOString(), 'en')).toBe('January 1, 2027')
	})
})
