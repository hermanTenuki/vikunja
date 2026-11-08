type DurationUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

// Largest unit that fits at least once; the span is floored, never shorter than 1 minute.
function pickUnit(elapsed: number): {unit: DurationUnit, size: number} {
	if (elapsed < HOUR) return {unit: 'minute', size: MINUTE}
	if (elapsed < DAY) return {unit: 'hour', size: HOUR}
	if (elapsed < WEEK) return {unit: 'day', size: DAY}
	if (elapsed < MONTH) return {unit: 'week', size: WEEK}
	if (elapsed < YEAR) return {unit: 'month', size: MONTH}
	return {unit: 'year', size: YEAR}
}

/**
 * Formats the time between `since` and `now` as one short localized unit, e.g. "5 min", "3 hr".
 * Months count as 30 days and years as 365. A start in the future is shown as 1 minute.
 */
export function formatShortDuration(since: Date, now: Date, locale: string): string {
	const elapsed = Math.max(0, now.getTime() - since.getTime())
	const {unit, size} = pickUnit(elapsed)
	return new Intl.NumberFormat(locale, {style: 'unit', unit, unitDisplay: 'short'}).format(Math.max(1, Math.floor(elapsed / size)))
}
