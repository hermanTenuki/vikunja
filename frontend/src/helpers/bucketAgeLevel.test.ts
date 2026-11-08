import {describe, expect, it} from 'vitest'

import {bucketAgeLevel} from './bucketAgeLevel'

const NOW = new Date('2026-06-30T12:00:00Z')

function daysAgo(days: number, extraMs = 0): string {
	return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000 - extraMs).toISOString()
}

describe('bucketAgeLevel', () => {
	it.each([
		['just under 14 days', daysAgo(14, -1), 'none'],
		['exactly 14 days', daysAgo(14), 'warning'],
		['just under 30 days', daysAgo(30, -1), 'warning'],
		['exactly 30 days', daysAgo(30), 'danger'],
		['a date in the future', daysAgo(-3), 'none'],
	])('%s -> %s', (_name, enteredAt, expected) => {
		expect(bucketAgeLevel(enteredAt, NOW)).toBe(expected)
	})

	it.each([
		['null', null],
		['undefined', undefined],
		['empty string', ''],
		['an unparsable date', 'not-a-date'],
	])('returns none for %s', (_name, enteredAt) => {
		expect(bucketAgeLevel(enteredAt, NOW)).toBe('none')
	})
})
