import type {IconName} from '@fortawesome/fontawesome-svg-core'

export const PRIORITIES = {
	'UNSET': 0,
	'LOW': 1,
	'MEDIUM': 2,
	'HIGH': 3,
	'URGENT': 4,
	'DO_NOW': 5,
} as const

export type Priority = typeof PRIORITIES[keyof typeof PRIORITIES]

// Names for the personal five-level scale; the numbers stay Vikunja's, so
// PRIORITIES.HIGH is the "Medium" level here.
export const PRIORITY_LEVELS = {
	NEGLIGIBLE: PRIORITIES.LOW,
	LOW: PRIORITIES.MEDIUM,
	MEDIUM: PRIORITIES.HIGH,
	CRITICAL: PRIORITIES.URGENT,
	BLOCKER: PRIORITIES.DO_NOW,
} as const

export type PriorityTone = 'faint' | 'muted' | 'warning' | 'danger'

export interface PriorityScaleEntry {
	value: Priority
	labelKey: string
	icon: IconName
	tone: PriorityTone
}

export const PRIORITY_UNSET_LABEL_KEY = 'task.priority.unset'

// Ordered from the lowest to the highest level.
export const PRIORITY_SCALE: readonly PriorityScaleEntry[] = [
	{value: PRIORITY_LEVELS.NEGLIGIBLE, labelKey: 'task.priority.low', icon: 'angles-down', tone: 'faint'},
	{value: PRIORITY_LEVELS.LOW, labelKey: 'task.priority.medium', icon: 'angle-down', tone: 'muted'},
	{value: PRIORITY_LEVELS.MEDIUM, labelKey: 'task.priority.high', icon: 'equals', tone: 'muted'},
	{value: PRIORITY_LEVELS.CRITICAL, labelKey: 'task.priority.urgent', icon: 'angles-up', tone: 'warning'},
	{value: PRIORITY_LEVELS.BLOCKER, labelKey: 'task.priority.doNow', icon: 'exclamation-circle', tone: 'danger'},
]

export function getPriorityScaleEntry(priority: number): PriorityScaleEntry | undefined {
	return PRIORITY_SCALE.find(entry => entry.value === priority)
}
