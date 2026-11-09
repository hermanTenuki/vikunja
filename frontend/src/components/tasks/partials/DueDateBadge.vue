<template>
	<span
		v-tooltip="formatDateLong(dueDate)"
		class="due-date-badge"
		:class="`is-${level}`"
	>
		<span class="icon">
			<OverdueIndicator v-if="level === 'overdue'" />
			<Icon
				v-else
				:icon="icon"
			/>
		</span>
		<time :datetime="formatISO(dueDate)">{{ formatDisplayDate(dueDate) }}</time>
	</span>
</template>

<script lang="ts" setup>
import {computed} from 'vue'
import type {IconProp} from '@fortawesome/fontawesome-svg-core'

import Icon from '@/components/misc/Icon'
import OverdueIndicator from '@/components/tasks/partials/OverdueIndicator.vue'

import type {TaskDueLevel} from '@/helpers/taskDueLevel'
import {formatDateLong, formatDisplayDate, formatISO} from '@/helpers/time/formatDate'

const props = defineProps<{
	dueDate: string,
	level: TaskDueLevel,
}>()

const icon = computed<IconProp>(() => props.level === 'plain' ? ['far', 'calendar-alt'] : 'hourglass-half')
</script>

<style lang="scss" scoped>
.due-date-badge {
	display: inline-flex;
	align-items: center;
	gap: .25rem;
	padding: 0 .5rem;
	border-radius: $radius;
	white-space: nowrap;

	&.is-plain {
		background: var(--grey-100);
	}

	// Opaque colors on purpose: --white is overridden on cards with a custom color.
	&.is-horizon,
	&.is-soon,
	&.is-overdue {
		font-weight: 600;
	}

	&.is-horizon {
		background: hsl(48, 96%, 85%);
		color: hsl(34, 85%, 24%);
	}

	&.is-soon {
		background: hsl(30, 100%, 84%);
		color: hsl(20, 90%, 27%);
	}

	&.is-overdue {
		background: hsl(3, 100%, 92%);
		color: hsl(3.3, 100%, 38%);
	}
}

.dark .due-date-badge {
	&.is-horizon {
		background: hsl(45, 55%, 22%);
		color: hsl(48, 95%, 78%);
	}

	&.is-soon {
		background: hsl(26, 65%, 26%);
		color: hsl(32, 100%, 80%);
	}

	&.is-overdue {
		background: hsl(3, 50%, 26%);
		color: hsl(3, 100%, 86%);
	}
}
</style>
