<template>
	<span
		v-tooltip="tooltip"
		class="sleep-badge"
		role="img"
		:aria-label="tooltip"
		data-cy="sleepBadge"
	>
		<Icon :icon="['far', 'moon']" />
		{{ label }}
	</span>
</template>

<script lang="ts" setup>
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'

import Icon from '@/components/misc/Icon'

import {formatSleepStartDate, sleepBadgeLabel} from '@/helpers/taskSleep'

const props = defineProps<{
	startDate: string,
	days: number,
}>()

const {t, locale} = useI18n({useScope: 'global'})

const label = computed(() => {
	const badge = sleepBadgeLabel(props.startDate, props.days, locale.value)
	return badge.kind === 'relative' ? badge.text : t('task.sleep.from', {date: badge.date})
})
const tooltip = computed(() => t('task.sleep.tooltip', {date: formatSleepStartDate(props.startDate, locale.value)}))
</script>

<style lang="scss" scoped>
// Opaque colors on purpose: --white is overridden on cards with a custom color.
.sleep-badge {
	display: inline-flex;
	align-items: center;
	gap: .25rem;
	padding: 0 .5rem;
	border-radius: $radius;
	background: hsl(214, 90%, 91%);
	color: hsl(218, 70%, 28%);
	font-size: .85rem;
	white-space: nowrap;
}

.dark .sleep-badge {
	background: hsl(218, 50%, 24%);
	color: hsl(214, 90%, 88%);
}
</style>
