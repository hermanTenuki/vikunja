import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {defineComponent, reactive} from 'vue'
import {flushPromises, mount} from '@vue/test-utils'
import {QueryClient, VueQueryPlugin} from '@tanstack/vue-query'

import type {ProjectResponse} from '@/client/queries/projects'
import type {BucketResponse} from '@/client/queries/kanban'
import type {TaskResponse} from '@/client/queries/tasks'
import {
	buildAttentionCards,
	buildBoardTiles,
	homeBoardCandidates,
	orderProjectsDepthFirst,
	useHomeBoards,
	type HomeBoard,
	type KanbanView,
} from './useHomeBoards'

const sdk = vi.hoisted(() => ({
	projectViewBucketsTasksList: vi.fn(),
}))
const auth = vi.hoisted(() => ({state: {authenticated: true, settings: {} as Record<string, unknown>}}))
const projects = vi.hoisted(() => ({
	state: {roots: [] as unknown[], children: {} as Record<number, unknown[]>},
}))

vi.mock('@/client/generated', () => sdk)
vi.mock('@/message', () => ({error: vi.fn(), success: vi.fn()}))
vi.mock('@/stores/auth', () => ({useAuthStore: () => auth.state}))
vi.mock('@/composables/useProjects', () => ({
	useProjects: () => ({
		notArchivedRootProjects: projects.state.roots,
		getChildProjects: (id: number) => projects.state.children[id] ?? [],
	}),
}))

function project(id: number, overrides: Partial<ProjectResponse> = {}): ProjectResponse {
	return {
		id,
		title: `P${id}`,
		is_archived: false,
		is_favorite: true,
		views: [{id: id * 10, view_kind: 'kanban', position: 1}],
		...overrides,
	} as ProjectResponse
}

function bucket(id: number, overrides: Partial<BucketResponse> = {}): BucketResponse {
	return {id, title: `B${id}`, count: 0, limit: 0, position: id, tasks: [], ...overrides} as BucketResponse
}

function task(id: number, done = false): TaskResponse {
	return {id, done} as TaskResponse
}

function board(p: ProjectResponse, buckets: BucketResponse[], doneBucketId = 0): HomeBoard {
	return {
		project: p,
		view: {id: p.id * 10, view_kind: 'kanban', done_bucket_id: doneBucketId} as KanbanView,
		buckets,
	}
}

function ids(list: readonly {project: ProjectResponse}[]) {
	return list.map(item => item.project.id)
}

describe('orderProjectsDepthFirst', () => {
	it('puts children right after their parent and skips archived subtrees', () => {
		const children: Record<number, ProjectResponse[]> = {
			1: [project(2), project(3, {is_archived: true})],
			2: [project(4)],
			3: [project(5)],
		}

		const result = orderProjectsDepthFirst([project(1), project(6, {is_archived: true}), project(7)], id => children[id] ?? [])

		expect(result.map(p => p.id)).toEqual([1, 2, 4, 7])
	})
})

describe('homeBoardCandidates', () => {
	it('keeps only favorite, non-archived projects with a kanban view and a positive id', () => {
		const result = homeBoardCandidates([
			project(1),
			project(2, {is_archived: true}),
			project(3, {views: [{id: 30, view_kind: 'list', position: 1}]}),
			project(-1),
			project(0),
			project(4, {is_favorite: false}),
		], {includeNonFavorites: false})

		expect(ids(result)).toEqual([1])
	})

	it('includes non-favorite boards when asked, still in the given order', () => {
		const result = homeBoardCandidates([project(4, {is_favorite: false}), project(1)], {includeNonFavorites: true})

		expect(ids(result)).toEqual([4, 1])
	})

	it('picks the kanban view with the lowest position', () => {
		const result = homeBoardCandidates([project(1, {
			views: [
				{id: 12, view_kind: 'kanban', position: 3},
				{id: 11, view_kind: 'list', position: 1},
				{id: 13, view_kind: 'kanban', position: 2},
			],
		})], {includeNonFavorites: false})

		expect(result[0].kanbanView.id).toBe(13)
	})
})

describe('buildAttentionCards', () => {
	it('ignores unknown ids and drops done tasks', () => {
		const p = project(1)
		const result = buildAttentionCards(
			[board(p, [bucket(5, {count: 2, tasks: [task(1), task(2, true)]}), bucket(6, {count: 1, tasks: [task(3)]})])],
			[5, 999],
		)

		expect(result.cards.map(card => card.task.id)).toEqual([1])
		expect(result.cards[0].project).toBe(p)
		expect(result.cards[0].bucket.id).toBe(5)
	})

	it('orders cards board, then bucket position, then response order', () => {
		const result = buildAttentionCards([
			board(project(1), [
				bucket(5, {position: 20, tasks: [task(1), task(2)], count: 2}),
				bucket(6, {position: 10, tasks: [task(3)], count: 1}),
			]),
			board(project(2), [bucket(7, {position: 1, tasks: [task(4)], count: 1})]),
		], [5, 6, 7])

		expect(result.cards.map(card => card.task.id)).toEqual([3, 1, 2, 4])
	})

	it('counts the whole bucket minus loaded done tasks in total', () => {
		const result = buildAttentionCards(
			[board(project(1), [bucket(5, {count: 40, tasks: [task(1), task(2, true), task(3, true)]})])],
			[5],
		)

		expect(result.total).toBe(38)
		expect(result.cards).toHaveLength(1)
	})
})

describe('buildAttentionCards done column', () => {
	it('contributes only loaded open tasks to total when the marked column is the done column', () => {
		const result = buildAttentionCards(
			[board(project(1), [bucket(5, {count: 40, tasks: [task(1, true), task(2, true)]})], 5)],
			[5],
		)

		expect(result.total).toBe(0)
		expect(result.cards).toEqual([])
	})
})

describe('buildBoardTiles', () => {
	it('drops hidden buckets, flags done and attention, and excludes both from openCount', () => {
		const result = buildBoardTiles([
			board(project(1), [
				bucket(1, {count: 4}),
				bucket(2, {count: 5}),
				bucket(3, {count: 100}),
				bucket(4, {count: 7}),
			], 3),
		], [4], [2])

		expect(result).toHaveLength(1)
		expect(result[0].viewId).toBe(10)
		expect(result[0].buckets.map(b => [b.id, b.isDone, b.isAttention])).toEqual([
			[1, false, false],
			[2, false, true],
			[3, true, false],
		])
		expect(result[0].openCount).toBe(9)
	})

	it('contains only favorite projects', () => {
		const result = buildBoardTiles([
			board(project(1), [bucket(1)]),
			board(project(2, {is_favorite: false}), [bucket(2)]),
		], [], [])

		expect(ids(result)).toEqual([1])
	})
})

describe('useHomeBoards', () => {
	let queryClient: QueryClient

	function mountBoards() {
		let result!: ReturnType<typeof useHomeBoards>
		mount(defineComponent({
			setup() {
				result = useHomeBoards()
				return () => null
			},
		}), {global: {plugins: [[VueQueryPlugin, {queryClient}]]}})
		return result
	}

	beforeEach(() => {
		queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
		auth.state = reactive({authenticated: true, settings: {}})
		projects.state.roots = [project(1), project(2, {is_favorite: false})]
		projects.state.children = {}
		sdk.projectViewBucketsTasksList.mockReset()
		sdk.projectViewBucketsTasksList.mockResolvedValue({data: {items: [{id: 5, title: 'Todo', count: 1, position: 1, tasks: [{id: 9}]}]}})
	})

	afterEach(() => queryClient.clear())

	it('requests one board per favorite project through the kanban endpoint', async () => {
		const {tiles} = mountBoards()
		await flushPromises()

		expect(sdk.projectViewBucketsTasksList).toHaveBeenCalledTimes(1)
		expect(sdk.projectViewBucketsTasksList).toHaveBeenCalledWith(expect.objectContaining({path: {project: 1, view: 10}}))
		expect(tiles.value.map(tile => tile.project.id)).toEqual([1])
	})

	it('also loads non-favorite boards once an attention bucket is marked', async () => {
		auth.state.settings = {frontend_settings: {home_attention_bucket_ids: [5]}}

		const {attention} = mountBoards()
		await flushPromises()

		expect(sdk.projectViewBucketsTasksList.mock.calls.map(([arg]) => arg.path.project)).toEqual([1, 2])
		expect(attention.value.cards.map(card => card.project.id)).toEqual([1, 2])
	})

	it('sends no requests when not authenticated', async () => {
		auth.state.authenticated = false

		mountBoards()
		await flushPromises()

		expect(sdk.projectViewBucketsTasksList).not.toHaveBeenCalled()
	})

	it('skips a board whose request failed and keeps the others', async () => {
		projects.state.roots = [project(1), project(3)]
		sdk.projectViewBucketsTasksList.mockImplementation(async ({path}: {path: {project: number}}) => {
			if (path.project === 1) throw new Error('boom')
			return {data: {items: [{id: 8, title: 'Todo', count: 0, position: 1, tasks: []}]}}
		})

		const {tiles} = mountBoards()
		await flushPromises()

		expect(tiles.value.map(tile => tile.project.id)).toEqual([3])
	})
})
