import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {defineComponent, reactive} from 'vue'
import {flushPromises, mount} from '@vue/test-utils'
import {QueryClient, VueQueryPlugin} from '@tanstack/vue-query'

import {hiddenBucketsFilter, useHomeTasks} from './useHomeTasks'

const sdk = vi.hoisted(() => ({
	tasksList: vi.fn(),
	projectTasksList: vi.fn(),
}))
const auth = vi.hoisted(() => ({state: {authenticated: true, settings: {} as Record<string, unknown>}}))
const projects = vi.hoisted(() => ({state: {favoriteProject: null as unknown, isLoading: false}}))

vi.mock('@/client/generated', () => sdk)
vi.mock('@/message', () => ({error: vi.fn(), success: vi.fn()}))
vi.mock('@/stores/auth', () => ({useAuthStore: () => auth.state}))
vi.mock('@/composables/useProjects', () => ({useProjects: () => projects.state}))

const NOW = new Date('2026-06-01T10:00:00Z')
const FAVORITES_PROJECT = {id: -1, title: 'Favorites'}

function page(ids: number[]) {
	return {data: {items: ids.map(id => ({id})), total: ids.length, page: 1, per_page: 10, total_pages: 1}}
}

describe('hiddenBucketsFilter', () => {
	it('is empty without hidden buckets', () => {
		expect(hiddenBucketsFilter([])).toBe('')
	})

	it('lists hidden bucket ids in a not-in clause', () => {
		expect(hiddenBucketsFilter([1, 2])).toBe(' && bucket_id not in 1, 2')
	})
})

describe('useHomeTasks', () => {
	let queryClient: QueryClient

	function mountTasks() {
		let result!: ReturnType<typeof useHomeTasks>
		mount(defineComponent({
			setup() {
				result = useHomeTasks()
				return () => null
			},
		}), {global: {plugins: [[VueQueryPlugin, {queryClient}]]}})
		return result
	}

	beforeEach(() => {
		vi.useFakeTimers({toFake: ['Date']})
		vi.setSystemTime(NOW)
		queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
		auth.state = reactive({authenticated: true, settings: {timezone: 'Europe/Moscow'}})
		projects.state = reactive({favoriteProject: null, isLoading: false})
		sdk.tasksList.mockReset()
		sdk.projectTasksList.mockReset()
		sdk.tasksList.mockResolvedValue(page([7]))
		sdk.projectTasksList.mockResolvedValue(page([1]))
	})

	afterEach(() => {
		queryClient.clear()
		vi.useRealTimers()
	})

	it('shows favorite tasks from the favorites pseudo project, excluding hidden buckets', async () => {
		projects.state.favoriteProject = FAVORITES_PROJECT
		auth.state.settings = {frontend_settings: {home_hidden_bucket_ids: [3, 4]}}

		const {kind, tasks} = mountTasks()
		await flushPromises()

		expect(sdk.projectTasksList).toHaveBeenCalledWith(expect.objectContaining({
			path: {project: -1},
			query: expect.objectContaining({filter: 'done = false && bucket_id not in 3, 4'}),
		}))
		expect(sdk.tasksList).not.toHaveBeenCalled()
		expect(kind.value).toBe('favorites')
		expect(tasks.value.map(t => t.id)).toEqual([1])
	})

	it('falls back to upcoming tasks with the 14-day window when there is no favorites project', async () => {
		const {kind, tasks} = mountTasks()
		await flushPromises()

		expect(sdk.projectTasksList).not.toHaveBeenCalled()
		expect(sdk.tasksList).toHaveBeenCalledTimes(1)
		expect(sdk.tasksList.mock.calls[0][0].query).toMatchObject({
			filter: 'done = false && due_date < \'2026-06-15T10:00:00.000Z\'',
			filter_timezone: 'Europe/Moscow',
			sort_by: ['due_date', 'id'],
			order_by: ['asc', 'desc'],
			per_page: 10,
		})
		expect(kind.value).toBe('upcoming')
		expect(tasks.value.map(t => t.id)).toEqual([7])
	})

	it('falls back to upcoming when favorites came back empty', async () => {
		projects.state.favoriteProject = FAVORITES_PROJECT
		sdk.projectTasksList.mockResolvedValue(page([]))

		const {kind} = mountTasks()
		await flushPromises()

		expect(sdk.tasksList).toHaveBeenCalledTimes(1)
		expect(kind.value).toBe('upcoming')
	})

	it('switches from upcoming to favorites after refetch once favorites are no longer empty', async () => {
		projects.state.favoriteProject = FAVORITES_PROJECT
		sdk.projectTasksList.mockResolvedValue(page([]))
		const {kind, tasks, refetch} = mountTasks()
		await flushPromises()
		expect(kind.value).toBe('upcoming')

		sdk.projectTasksList.mockResolvedValue(page([1]))
		await refetch()
		await flushPromises()

		expect(sdk.projectTasksList).toHaveBeenCalledTimes(2)
		expect(kind.value).toBe('favorites')
		expect(tasks.value.map(t => t.id)).toEqual([1])
	})

	it('does not request upcoming tasks when favorites failed', async () => {
		projects.state.favoriteProject = FAVORITES_PROJECT
		sdk.projectTasksList.mockRejectedValue(new Error('boom'))

		const {kind} = mountTasks()
		await flushPromises()

		expect(sdk.tasksList).not.toHaveBeenCalled()
		expect(kind.value).toBeNull()
	})

	it('sends no requests when not authenticated', async () => {
		auth.state.authenticated = false
		projects.state.favoriteProject = FAVORITES_PROJECT

		const {kind} = mountTasks()
		await flushPromises()

		expect(sdk.projectTasksList).not.toHaveBeenCalled()
		expect(sdk.tasksList).not.toHaveBeenCalled()
		expect(kind.value).toBeNull()
	})
})
