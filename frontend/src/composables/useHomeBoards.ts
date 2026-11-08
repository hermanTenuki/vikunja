import {computed} from 'vue'
import {useQueries} from '@tanstack/vue-query'

import type {ProjectView} from '@/client/generated'
import {kanbanQuery, type BucketResponse} from '@/client/queries/kanban'
import {sortProjectViewsByPosition} from '@/client/queries/projectViews'
import type {ProjectResponse} from '@/client/queries/projects'
import type {TaskResponse} from '@/client/queries/tasks'
import {useProjects} from '@/composables/useProjects'
import {useAuthStore} from '@/stores/auth'

export type KanbanView = ProjectView & {id: number}

export interface HomeBoardCandidate {
	project: ProjectResponse
	kanbanView: KanbanView
}

export interface HomeBoard {
	project: ProjectResponse
	view: KanbanView
	buckets: BucketResponse[]
}

export interface AttentionCard {
	task: TaskResponse
	bucket: BucketResponse
	project: ProjectResponse
}

export interface AttentionCards {
	cards: AttentionCard[]
	total: number
}

export interface HomeTileBucket {
	id: number
	title: string
	count: number
	isDone: boolean
	isAttention: boolean
}

export interface HomeBoardTile {
	project: ProjectResponse
	viewId: number
	buckets: HomeTileBucket[]
	openCount: number
}

function firstKanbanView(project: ProjectResponse): KanbanView | null {
	const view = sortProjectViewsByPosition(project.views)
		.find(candidate => candidate.view_kind === 'kanban' && typeof candidate.id === 'number')
	return view ? {...view, id: view.id as number} : null
}

/**
 * Projects in sidebar order: depth first, roots by position, children right after their parent.
 * Archived projects are skipped together with their subtree.
 */
export function orderProjectsDepthFirst(
	roots: readonly ProjectResponse[],
	getChildren: (id: number) => readonly ProjectResponse[],
): ProjectResponse[] {
	return roots
		.filter(project => !project.is_archived)
		.flatMap(project => [project, ...orderProjectsDepthFirst(getChildren(project.id), getChildren)])
}

export function homeBoardCandidates(
	orderedProjects: readonly ProjectResponse[],
	{includeNonFavorites}: {includeNonFavorites: boolean},
): HomeBoardCandidate[] {
	return orderedProjects.flatMap(project => {
		if (project.id <= 0 || project.is_archived) return []
		if (!project.is_favorite && !includeNonFavorites) return []

		const kanbanView = firstKanbanView(project)
		return kanbanView ? [{project, kanbanView}] : []
	})
}

export function buildAttentionCards(
	boards: readonly HomeBoard[],
	attentionIds: readonly number[],
): AttentionCards {
	const cards: AttentionCard[] = []
	let total = 0

	for (const {project, view, buckets} of boards) {
		const marked = buckets
			.filter(bucket => attentionIds.includes(bucket.id))
			.sort((a, b) => a.position - b.position)

		for (const bucket of marked) {
			const open = bucket.tasks.filter(task => !task.done)
			cards.push(...open.map(task => ({task, bucket, project})))
			total += bucket.id === view.done_bucket_id
				? open.length
				: bucket.count - (bucket.tasks.length - open.length)
		}
	}

	return {cards, total}
}

export function buildBoardTiles(
	boards: readonly HomeBoard[],
	hiddenIds: readonly number[],
	attentionIds: readonly number[],
): HomeBoardTile[] {
	return boards
		.filter(({project}) => project.is_favorite)
		.map(({project, view, buckets}) => {
			const visible = buckets
				.filter(bucket => !hiddenIds.includes(bucket.id))
				.map(bucket => ({
					id: bucket.id,
					title: bucket.title,
					count: bucket.count,
					isDone: bucket.id === view.done_bucket_id,
					isAttention: attentionIds.includes(bucket.id),
				}))

			return {
				project,
				viewId: view.id,
				buckets: visible,
				openCount: visible
					.filter(bucket => !bucket.isDone)
					.reduce((sum, bucket) => sum + bucket.count, 0),
			}
		})
}

export function useHomeBoards() {
	const authStore = useAuthStore()
	const projectStore = useProjects()

	const attentionIds = computed(() => authStore.settings?.frontend_settings?.home_attention_bucket_ids ?? [])
	const hiddenIds = computed(() => authStore.settings?.frontend_settings?.home_hidden_bucket_ids ?? [])

	const candidates = computed(() => homeBoardCandidates(
		orderProjectsDepthFirst(projectStore.notArchivedRootProjects, projectStore.getChildProjects),
		{includeNonFavorites: attentionIds.value.length > 0},
	))

	const results = useQueries({
		queries: computed(() => candidates.value.map(({project, kanbanView}) => ({
			...kanbanQuery(project.id, kanbanView.id, {}),
			enabled: authStore.authenticated,
		}))),
	})

	// A failed board has no data and is skipped; the rest still render.
	const boards = computed<HomeBoard[]>(() => candidates.value.flatMap(({project, kanbanView}, index) => {
		const data = results.value[index]?.data
		return data ? [{project, view: kanbanView, buckets: data.buckets}] : []
	}))

	const attention = computed(() => buildAttentionCards(boards.value, attentionIds.value))
	const tiles = computed(() => buildBoardTiles(boards.value, hiddenIds.value, attentionIds.value))

	return {attention, tiles}
}
