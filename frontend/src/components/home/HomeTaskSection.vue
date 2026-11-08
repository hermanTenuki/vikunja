<template>
	<section
		v-cy="'homeTaskSection'"
		class="home-task-section"
		:data-kind="kind"
	>
		<div class="home-task-section__head">
			<h2 class="home-task-section__title">
				{{ title }}
			</h2>
			<RouterLink
				:to="allLink"
				class="home-task-section__all"
				data-cy="homeTasksAll"
			>
				{{ $t('home.dashboard.all') }}
			</RouterLink>
		</div>
		<ul class="home-task-section__list">
			<li
				v-for="(task, index) in tasks"
				:key="task.id"
				:class="{'is-beyond-phone-limit': index >= phoneRows}"
			>
				<SingleTaskInProject
					:show-project="true"
					:the-task="task"
					:can-mark-as-done="(projectList.projects[task.project_id]?.max_permission ?? 0) > PERMISSIONS.READ"
					@taskUpdated="emit('taskUpdated')"
				/>
			</li>
		</ul>
	</section>
</template>

<script lang="ts" setup>
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'

import SingleTaskInProject from '@/components/tasks/partials/SingleTaskInProject.vue'

import type {TaskResponse} from '@/client/queries/tasks'
import {useProjects} from '@/composables/useProjects'
import {HOME_PHONE_TASK_ROWS} from '@/constants/home'
import {PERMISSIONS} from '@/constants/permissions'

const props = defineProps<{
	kind: 'favorites' | 'upcoming',
	tasks: TaskResponse[],
}>()

const emit = defineEmits<{
	'taskUpdated': []
}>()

const {t} = useI18n({useScope: 'global'})
const projectList = useProjects()
const phoneRows = HOME_PHONE_TASK_ROWS

const title = computed(() => props.kind === 'favorites'
	? t('home.dashboard.favorites')
	: t('home.dashboard.upcoming'))

const allLink = computed(() => props.kind === 'favorites'
	? {name: 'project.index', params: {projectId: -1}}
	: {name: 'tasks.range'})
</script>

<style lang="scss" scoped>
.home-task-section {
	text-align: start;
}

.home-task-section__head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 1rem;
	margin-block-end: .5rem;
}

.home-task-section__title {
	margin: 0;
	font-size: 1.1rem;
}

.home-task-section__all {
	display: none;
	align-items: center;
	min-block-size: 44px;
}

.home-task-section__list {
	margin: 0;
	padding: .5rem;
	background: var(--white);
	border: 1px solid var(--grey-200);
	border-radius: $radius;
	box-shadow: var(--shadow-xs);
	list-style: none;
}

@media screen and (max-width: $tablet) {
	.home-task-section__all {
		display: inline-flex;
	}

	.is-beyond-phone-limit {
		display: none;
	}
}
</style>
