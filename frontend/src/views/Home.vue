<template>
	<div class="content has-text-centered">
		<h1
			v-if="salutation"
			class="home-salutation"
		>
			{{ salutation }}
		</h1>

		<Message
			v-if="deletionScheduledAt !== null"
			variant="danger"
			class="mbe-4"
		>
			{{
				$t('user.deletion.scheduled', {
					date: formatDisplayDate(deletionScheduledAt),
					dateSince: formatDateSince(deletionScheduledAt),
				})
			}}
			<RouterLink :to="{name: 'user.settings.deletion'}">
				{{ $t('user.deletion.scheduledCancel') }}
			</RouterLink>
		</Message>
		<AddTask
			class="is-max-width-desktop home-add-task"
			@tasksAdded="updateTaskKey"
		/>
		<template v-if="labelIds">
			<ImportHint v-if="tasksLoaded" />
			<ShowTasks
				v-if="projectList.hasProjects"
				:key="showTasksKey"
				:label-ids="labelIds"
				class="show-tasks"
				@tasksLoaded="tasksLoaded = true"
				@clearLabelFilter="handleClearLabelFilter"
			/>
		</template>
		<template v-else>
			<ImportHint />
			<HomeDashboard v-if="authStore.authenticated" />
		</template>
	</div>
</template>

<script lang="ts" setup>
import {ref, computed, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'

import Message from '@/components/misc/Message.vue'
import ShowTasks from '@/views/tasks/ShowTasks.vue'
import AddTask from '@/components/tasks/AddTask.vue'
import ImportHint from '@/components/home/ImportHint.vue'
import HomeDashboard from '@/components/home/HomeDashboard.vue'

import {parseDateOrNull} from '@/helpers/parseDateOrNull'
import {parseQuickAddPrefill, QUICK_ADD_PREFILL_PARAMS} from '@/helpers/quickAddPrefill'
import {formatDateSince, formatDisplayDate} from '@/helpers/time/formatDate'
import {useDaytimeSalutation} from '@/composables/useDaytimeSalutation'

import {useProjects} from '@/composables/useProjects'
import {useAuthStore} from '@/stores/auth'
import {useBaseStore} from '@/stores/base'

const salutation = useDaytimeSalutation()

const authStore = useAuthStore()
const projectList = useProjects()
const route = useRoute()
const router = useRouter()
const baseStore = useBaseStore()

watch(() => route.query, query => {
	const prefill = parseQuickAddPrefill(query)
	if (prefill === null) {
		return
	}
	baseStore.setQuickActionsActive(true, prefill)
	// Stripped so a reload doesn't open the dialog again.
	const rest = {...query}
	QUICK_ADD_PREFILL_PARAMS.forEach(param => delete rest[param])
	router.replace({name: 'home', query: rest})
}, {immediate: true})

const tasksLoaded = ref(false)

const deletionScheduledAt = computed(() => parseDateOrNull(authStore.info?.deletion_scheduled_at))

// Extract label IDs from query parameter
const labelIds = computed(() => {
	const labelsParam = route.query.labels
	if (!labelsParam) {
		return undefined
	}
	return Array.isArray(labelsParam) ? labelsParam.filter((id): id is string => id !== null) : [labelsParam]
})

// This is to reload the tasks list after adding a new task through the global task add.
// FIXME: Should use pinia (somehow?)
const showTasksKey = ref(0)

function updateTaskKey() {
	showTasksKey.value++
}

function handleClearLabelFilter() {
	const query = {...route.query}
	delete query.labels
	router.push({
		name: route.name as string,
		query,
	})
}
</script>

<style scoped lang="scss">
.show-tasks {
	margin-block-start: 2rem;
}

@media screen and (max-width: $tablet) {
	.content {
		display: flex;
		flex-direction: column;
	}

	.home-add-task {
		order: -1;
		inline-size: 100%;
		margin-block-end: 1rem;
	}

	.home-salutation {
		font-size: 1.25rem;
		text-align: start;
	}
}
</style>
