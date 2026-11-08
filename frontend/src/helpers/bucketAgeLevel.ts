import {MILLISECONDS_A_DAY} from '@/constants/date'
import {HOME_STALE_DANGER_DAYS, HOME_STALE_WARNING_DAYS} from '@/constants/home'

export type BucketAgeLevel = 'none' | 'warning' | 'danger'

export function bucketAgeLevel(enteredAt: string | null | undefined, now: Date): BucketAgeLevel {
	if (!enteredAt) return 'none'

	const entered = new Date(enteredAt).getTime()
	if (Number.isNaN(entered)) return 'none'

	const days = (now.getTime() - entered) / MILLISECONDS_A_DAY
	if (days >= HOME_STALE_DANGER_DAYS) return 'danger'
	if (days >= HOME_STALE_WARNING_DAYS) return 'warning'
	return 'none'
}
