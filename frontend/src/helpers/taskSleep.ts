import {MILLISECONDS_A_DAY} from '@/constants/date'
import {parseDateOrNull} from '@/helpers/parseDateOrNull'
import {startOfDay} from '@/helpers/time/dateMath'

// A card is shown with a relative label up to this many days, with a date beyond it.
const SLEEP_RELATIVE_MAX_DAYS = 14
// The year is added to the date label only when the start is further away than this.
const SLEEP_YEAR_MIN_DAYS = 300

export type SleepBadgeLabel =
	| {kind: 'relative', text: string}
	| {kind: 'date', date: string}

/**
 * Calendar days (browser time zone) until the start day of a sleeping task, 0 if the task is awake.
 * A task sleeps while it is not done, its start day is after today and its due day is not before the start day.
 */
export function taskSleepDays(
	task: {done?: boolean | null, start_date?: string | null, due_date?: string | null},
	now: Date,
): number {
	if (task.done) return 0

	const start = parseDateOrNull(task.start_date)
	if (!start) return 0

	const startDay = startOfDay(start)
	const days = Math.round((startDay.getTime() - startOfDay(now).getTime()) / MILLISECONDS_A_DAY)
	if (days < 1) return 0

	const due = parseDateOrNull(task.due_date)
	if (due && startOfDay(due).getTime() < startDay.getTime()) return 0

	return days
}

export function sleepBadgeLabel(startDate: string, days: number, locale: string): SleepBadgeLabel {
	if (days <= SLEEP_RELATIVE_MAX_DAYS) {
		return {
			kind: 'relative',
			text: new Intl.RelativeTimeFormat(locale, {numeric: 'auto', style: 'short'}).format(days, 'day'),
		}
	}

	return {
		kind: 'date',
		date: new Intl.DateTimeFormat(locale, {
			day: 'numeric',
			month: 'short',
			year: days > SLEEP_YEAR_MIN_DAYS ? 'numeric' : undefined,
		}).format(new Date(startDate)),
	}
}

export function formatSleepStartDate(startDate: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'long', year: 'numeric'}).format(new Date(startDate))
}
