import {beforeEach, describe, expect, it, vi} from 'vitest'
import {defineComponent} from 'vue'
import {mount} from '@vue/test-utils'
import {createRouter, createWebHistory, type Router} from 'vue-router'

const project = vi.hoisted(() => ({
	value: {
		id: 1,
		views: [
			{id: 1, view_kind: 'list'},
			{id: 3, view_kind: 'table'},
			{id: 4, view_kind: 'kanban'},
			{id: 5, view_kind: 'gantt'},
		],
	},
}))
vi.mock('@/composables/useCurrentProject', () => ({
	useCurrentProject: () => ({currentProject: project}),
}))

import {useOpenCreatedTask} from './useOpenCreatedTask'

const Empty = {template: '<div />'}

async function setup(path: string, state?: Record<string, string>) {
	const router = createRouter({
		history: createWebHistory(),
		routes: [
			{path: '/', name: 'home', component: Empty},
			{path: '/projects/:projectId/:viewId', name: 'project.view', component: Empty},
			{path: '/tasks/:id', name: 'task.detail', component: Empty},
		],
	})
	await router.push({path, state})
	await router.isReady()

	let actions!: ReturnType<typeof useOpenCreatedTask>
	mount(defineComponent({
		setup() {
			actions = useOpenCreatedTask()
			return () => null
		},
	}), {global: {plugins: [router]}})
	return {router, ...actions}
}

function openedTask(router: Router) {
	return {
		path: router.currentRoute.value.fullPath,
		backdropView: window.history.state?.backdropView,
	}
}

describe('useOpenCreatedTask', () => {
	beforeEach(() => {
		window.history.replaceState(null, '', '/')
	})

	it.each([
		['kanban', '/projects/1/4'],
		['gantt', '/projects/1/5'],
	])('opens the task as a modal over the %s view', async (_kind, path) => {
		const {router, beginTaskCreation} = await setup(path)

		await beginTaskCreation()(42)

		expect(openedTask(router)).toEqual({path: '/tasks/42', backdropView: path})
	})

	it.each([
		['list', '/projects/1/1'],
		['table', '/projects/1/3'],
		['home', '/'],
	])('opens the task as a page from the %s view', async (_kind, path) => {
		const {router, beginTaskCreation} = await setup(path)

		await beginTaskCreation()(42)

		expect(openedTask(router)).toEqual({path: '/tasks/42', backdropView: undefined})
	})

	it('keeps the modal over the same view when created from an open task modal', async () => {
		const {router, beginTaskCreation} = await setup('/tasks/7', {backdropView: '/projects/1/4'})

		await beginTaskCreation()(42)

		expect(openedTask(router)).toEqual({path: '/tasks/42', backdropView: '/projects/1/4'})
	})

	it('does not open the task when the user moved on while it was created', async () => {
		const {router, beginTaskCreation} = await setup('/projects/1/4')
		const openCreatedTask = beginTaskCreation()

		await router.push('/projects/1/1')
		await openCreatedTask(42)

		expect(router.currentRoute.value.fullPath).toBe('/projects/1/1')
	})
})
