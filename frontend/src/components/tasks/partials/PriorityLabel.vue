<template>
	<span
		v-if="entry && (showAll || priority >= minimumPriority)"
		v-tooltip="iconOnly ? label : undefined"
		class="priority-label"
		:class="[`is-${entry.tone}`, {'is-icon-only': iconOnly}]"
		:role="iconOnly ? 'img' : undefined"
		:aria-label="iconOnly ? `${$t('task.attributes.priority')}: ${label}` : undefined"
	>
		<Icon
			:icon="entry.icon"
			class="priority-label__icon"
		/>
		<span
			v-if="!iconOnly"
			class="priority-label__text"
		>
			{{ label }}
		</span>
	</span>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'

import {PRIORITY_LEVELS, getPriorityScaleEntry} from '@/constants/priorities'
import {useAuthStore} from '@/stores/auth'

const props = withDefaults(defineProps<{
	priority: number,
	showAll?: boolean,
	iconOnly?: boolean,
}>(), {
	showAll: false,
	iconOnly: false,
})

const {t} = useI18n({useScope: 'global'})
const authStore = useAuthStore()

const entry = computed(() => getPriorityScaleEntry(props.priority))
const label = computed(() => entry.value ? t(entry.value.labelKey) : '')

const minimumPriority = computed(() => {
	return authStore.settings.frontend_settings.minimum_priority || PRIORITY_LEVELS.NEGLIGIBLE
})
</script>

<style lang="scss" scoped>
// Opaque icon colors on purpose: --white is overridden on cards with a custom color.
.priority-label {
	display: inline-flex;
	align-items: center;
	gap: .25rem;
	min-block-size: 1.5rem; // Same height as the Bulma .icon chips next to it
	padding: 0 .5rem;
	border-radius: $radius;
	background: var(--grey-100);
	white-space: nowrap;
	inline-size: auto !important; // To override the width set in tasks

	&.is-faint {
		.priority-label__icon {
			color: hsl(217, 10%, 70%);
		}

		.priority-label__text {
			color: var(--grey-500);
		}
	}

	&.is-muted .priority-label__icon {
		color: hsl(215, 14%, 42%);
	}

	// Saturated on purpose: the pale --warning is unreadable on the light grey chip.
	&.is-warning .priority-label__icon {
		color: hsl(40, 95%, 38%);
	}

	&.is-danger {
		.priority-label__icon {
			color: hsl(3, 85%, 46%);
		}

		.priority-label__text {
			font-weight: 600;
		}
	}
}

.dark .priority-label {
	&.is-faint .priority-label__icon {
		color: hsl(217, 10%, 46%);
	}

	&.is-muted .priority-label__icon {
		color: hsl(216, 12%, 72%);
	}

	&.is-warning .priority-label__icon {
		color: hsl(45, 95%, 58%);
	}

	&.is-danger .priority-label__icon {
		color: hsl(3, 100%, 70%);
	}
}
</style>
