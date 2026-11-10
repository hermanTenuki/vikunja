<template>
	<div
		v-if="disabled"
		class="priority-select"
	>
		<PriorityLabel
			v-if="current"
			:priority="priority"
			show-all
		/>
		<span v-else>{{ $t(PRIORITY_UNSET_LABEL_KEY) }}</span>
	</div>
	<Dropdown
		v-else
		ref="dropdown"
		class="priority-select"
	>
		<template #trigger="{toggleOpen, open: isOpen}">
			<BaseButton
				ref="trigger"
				class="priority-select__trigger"
				:aria-expanded="isOpen"
				:aria-label="`${$t('task.attributes.priority')}: ${currentLabel}`"
				@click="toggleOpen"
			>
				<PriorityLabel
					v-if="current"
					:priority="priority"
					show-all
				/>
				<span v-else>{{ $t(PRIORITY_UNSET_LABEL_KEY) }}</span>
				<Icon
					icon="pencil-alt"
					class="priority-select__indicator d-print-none"
				/>
			</BaseButton>
		</template>
		<template #default="{close}">
			<DropdownItem
				v-for="entry in menuEntries"
				:key="entry.value"
				class="priority-select__item"
				:class="{'is-current': current?.value === entry.value}"
				@click="select(entry.value); close()"
			>
				<PriorityLabel
					:priority="entry.value"
					show-all
				/>
			</DropdownItem>
			<hr class="dropdown-divider">
			<DropdownItem
				class="priority-select__item"
				:class="{'is-current': priority === PRIORITIES.UNSET}"
				@click="select(PRIORITIES.UNSET); close()"
			>
				{{ $t(PRIORITY_UNSET_LABEL_KEY) }}
			</DropdownItem>
		</template>
	</Dropdown>
</template>

<script setup lang="ts">
import {computed, useTemplateRef} from 'vue'
import {useI18n} from 'vue-i18n'

import {
	PRIORITIES,
	PRIORITY_SCALE,
	PRIORITY_UNSET_LABEL_KEY,
	getPriorityScaleEntry,
} from '@/constants/priorities'

import BaseButton from '@/components/base/BaseButton.vue'
import Dropdown from '@/components/misc/Dropdown.vue'
import DropdownItem from '@/components/misc/DropdownItem.vue'
import PriorityLabel from '@/components/tasks/partials/PriorityLabel.vue'

const props = withDefaults(defineProps<{
	disabled?: boolean
}>(), {
	disabled: false,
})

const priority = defineModel<number>({
	required: true,
	default: 0,
})

const {t} = useI18n({useScope: 'global'})

const dropdown = useTemplateRef<InstanceType<typeof Dropdown>>('dropdown')
const trigger = useTemplateRef<InstanceType<typeof BaseButton>>('trigger')

const menuEntries = [...PRIORITY_SCALE].reverse()

const current = computed(() => getPriorityScaleEntry(priority.value))
const currentLabel = computed(() => t(current.value?.labelKey ?? PRIORITY_UNSET_LABEL_KEY))

function select(value: number) {
	if (value !== priority.value) {
		priority.value = value
	}
}

function open() {
	if (props.disabled) {
		return
	}
	dropdown.value?.open()
	trigger.value?.$el.focus()
}

defineExpose({
	open,
})
</script>

<style lang="scss" scoped>
.priority-select__trigger {
	display: inline-flex;
	align-items: center;
	gap: .5rem;
}

.priority-select__indicator {
	font-size: .75em;
	color: var(--grey-400);
}

// DropdownItem's own is-active is a solid link color the chip text and icons cannot sit on.
.priority-select__item.is-current {
	background-color: var(--grey-200);
	font-weight: 600;
}

.dropdown-divider {
	background-color: var(--border-light);
	border: none;
	display: block;
	block-size: 1px;
	margin: 0.5rem 0;
}
</style>
