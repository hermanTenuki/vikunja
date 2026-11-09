import {MILLISECONDS_A_DAY} from '@/constants/date'
import {DUE_DATE_HORIZON_DAYS, HOME_UPCOMING_WINDOW_DAYS} from '@/constants/home'
import {parseDateOrNull} from '@/helpers/parseDateOrNull'
import {startOfDay} from '@/helpers/time/dateMath'

export type TaskDueLevel = 'plain' | 'horizon' | 'soon' | 'overdue'

/**
 * How urgent the due date of a task is, null when there is nothing to show (done or no due date).
 * Overdue is decided by the exact time, the other levels by calendar days in the browser time zone.
 */
export function taskDueLevel(
	task: {done?: boolean | null, due_date?: string | null},
	now: Date,
): TaskDueLevel | null {
	if (task.done) return null

	const due = parseDateOrNull(task.due_date)
	if (!due) return null

	if (due.getTime() <= now.getTime()) return 'overdue'

	const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / MILLISECONDS_A_DAY)
	if (days <= HOME_UPCOMING_WINDOW_DAYS) return 'soon'
	if (days <= DUE_DATE_HORIZON_DAYS) return 'horizon'

	return 'plain'
}
