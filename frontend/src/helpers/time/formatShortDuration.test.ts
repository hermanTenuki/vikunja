import {describe, expect, it} from 'vitest'
import {formatShortDuration} from './formatShortDuration'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOW = new Date('2026-11-07T12:00:00Z')

function ago(ms: number, locale = 'en') {
	return formatShortDuration(new Date(NOW.getTime() - ms), NOW, locale)
}

describe('formatShortDuration', () => {
	it.each([
		['59 seconds', 59_000, '1 min'],
		['5 minutes', 5 * MINUTE, '5 min'],
		['59 minutes', 59 * MINUTE, '59 min'],
		['60 minutes', 60 * MINUTE, '1 hr'],
		['23 hours 59 minutes', 23 * HOUR + 59 * MINUTE, '23 hr'],
		['24 hours', 24 * HOUR, '1 day'],
		['6 days 23 hours', 6 * DAY + 23 * HOUR, '6 days'],
		['7 days', 7 * DAY, '1 wk'],
		['29 days', 29 * DAY, '4 wks'],
		['30 days', 30 * DAY, '1 mth'],
		['364 days', 364 * DAY, '12 mths'],
		['365 days', 365 * DAY, '1 yr'],
	])('rounds %s down to the largest whole unit', (_label, elapsed, expected) => {
		expect(ago(elapsed)).toBe(expected)
	})

	it('never shows less than one minute, even for a start in the future', () => {
		expect(ago(0)).toBe('1 min')
		expect(ago(-2 * HOUR)).toBe('1 min')
	})

	it('floors instead of rounding up', () => {
		expect(ago(89 * MINUTE)).toBe('1 hr')
		expect(ago(47 * HOUR)).toBe('1 day')
	})

	it('formats Russian with its own unit words and plural forms', () => {
		const ru = ago(5 * MINUTE, 'ru-RU')
		expect(ru).not.toBe(ago(5 * MINUTE))
		expect(ru).toMatch(/^5\s*мин/)
		expect(ago(3 * DAY, 'ru-RU')).toMatch(/^3\s*дн/)
	})
})
