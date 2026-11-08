<template>
	<RouterLink
		v-cy="'homeAttentionCard'"
		:to="{name: 'task.detail', params: {id: card.task.id}}"
		class="home-attention-card"
		:data-task-id="card.task.id"
	>
		<span class="home-attention-card__meta">
			<span
				class="home-attention-card__bucket"
				data-cy="homeAttentionBucket"
			>
				{{ card.bucket.title }}
			</span>
			<span class="home-attention-card__project">{{ card.project.title }}</span>
			<span
				v-if="timeInBucket"
				v-tooltip="timeInBucketTooltip"
				class="home-attention-card__age"
				:class="`is-${ageLevel}`"
				data-cy="homeAttentionAge"
			>
				<Icon icon="clock" />
				{{ timeInBucket }}
			</span>
		</span>
		<span class="home-attention-card__title">{{ card.task.title }}</span>
		<span class="home-attention-card__footer">
			<PriorityLabel
				v-if="card.task.priority >= PRIORITIES.HIGH"
				:priority="card.task.priority"
				:done="card.task.done"
				:show-all="true"
			/>
			<span
				v-if="hasDueDate"
				v-tooltip="formatDateLong(card.task.due_date)"
				class="home-attention-card__due"
				:class="{'is-overdue': isOverdue}"
			>
				<Icon :icon="['far', 'calendar-alt']" />
				{{ formatDisplayDate(card.task.due_date) }}
			</span>
			<ChecklistSummary :task="card.task" />
			<CommentCount :task="card.task" />
		</span>
	</RouterLink>
</template>

<script lang="ts" setup>
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'

import Icon from '@/components/misc/Icon'
import PriorityLabel from '@/components/tasks/partials/PriorityLabel.vue'
import ChecklistSummary from '@/components/tasks/partials/ChecklistSummary.vue'
import CommentCount from '@/components/tasks/partials/CommentCount.vue'

import {useGlobalNow} from '@/composables/useGlobalNow'
import type {AttentionCard} from '@/composables/useHomeBoards'
import {PRIORITIES} from '@/constants/priorities'
import {bucketAgeLevel} from '@/helpers/bucketAgeLevel'
import {formatDateLong, formatDisplayDate} from '@/helpers/time/formatDate'
import {formatShortDuration} from '@/helpers/time/formatShortDuration'

const props = defineProps<{
	card: AttentionCard,
}>()

const {t, locale} = useI18n({useScope: 'global'})
const {now} = useGlobalNow()

const enteredAt = computed(() => props.card.task.bucket_entered_at)
const timeInBucket = computed(() => enteredAt.value
	? formatShortDuration(new Date(enteredAt.value), now.value, locale.value)
	: '')
const timeInBucketTooltip = computed(() => enteredAt.value
	? t('project.kanban.timeInBucket', {date: formatDateLong(enteredAt.value)})
	: '')
const ageLevel = computed(() => bucketAgeLevel(enteredAt.value, now.value))

const hasDueDate = computed(() => new Date(props.card.task.due_date ?? 0).getTime() > 0)
const isOverdue = computed(() => hasDueDate.value
	&& new Date(props.card.task.due_date ?? 0).getTime() <= now.value.getTime())
</script>

<style lang="scss" scoped>
.home-attention-card {
	display: flex;
	flex-direction: column;
	gap: .375rem;
	min-block-size: 44px;
	padding: .75rem;
	background: var(--white);
	border: 1px solid var(--grey-200);
	border-radius: $radius;
	box-shadow: var(--shadow-xs);
	color: var(--text);
	text-decoration: none;
	text-align: start;

	&:hover {
		border-color: var(--primary);
	}
}

.home-attention-card__meta,
.home-attention-card__footer {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: .375rem .5rem;
	font-size: .8rem;
}

.home-attention-card__bucket {
	padding: 0 .5rem;
	border-radius: $radius;
	background: hsla(var(--primary-hsl), .15);
	color: var(--primary);
	font-weight: 600;
}

.home-attention-card__project {
	color: var(--text-muted);
}

.home-attention-card__age {
	margin-inline-start: auto;
	white-space: nowrap;
	color: var(--text-muted);

	&.is-warning {
		color: var(--warning);
		font-weight: 600;
	}

	&.is-danger {
		color: var(--danger-text);
		font-weight: 600;
	}
}

.home-attention-card__title {
	font-weight: 600;
	word-break: break-word;
}

.home-attention-card__due {
	color: var(--text-muted);

	&.is-overdue {
		color: var(--danger-text);
	}
}
</style>
