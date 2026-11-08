import {computed} from 'vue'

import type {TaskFilterParams, TaskScope} from '@/client/queries/tasks'
import {MILLISECONDS_A_DAY} from '@/constants/date'
import {HOME_UPCOMING_LIMIT, HOME_UPCOMING_WINDOW_DAYS} from '@/constants/home'
import {useProjects} from '@/composables/useProjects'
import {useTasks} from '@/composables/useTasks'
import {useAuthStore} from '@/stores/auth'

const FAVORITES_PROJECT_ID = -1

export type HomeTasksKind = 'favorites' | 'upcoming' | null

export function hiddenBucketsFilter(ids: readonly number[]): string {
	return ids.length > 0 ? ` && bucket_id not in ${ids.join(', ')}` : ''
}

export function useHomeTasks() {
	const authStore = useAuthStore()
	const projectStore = useProjects()

	const hiddenFilter = computed(() => hiddenBucketsFilter(
		authStore.settings?.frontend_settings?.home_hidden_bucket_ids ?? [],
	))
	const expand: TaskFilterParams['expand'] = ['comment_count', 'is_unread']
	// Fixed at setup so the query key stays stable: saving any setting must not reload the list.
	const timezone = authStore.settings?.timezone
	const windowEnd = new Date(Date.now() + HOME_UPCOMING_WINDOW_DAYS * MILLISECONDS_A_DAY).toISOString()

	const favoritesEnabled = computed(() => authStore.authenticated && projectStore.favoriteProject !== null)
	const favorites = useTasks(
		computed((): TaskScope => ({
			project: FAVORITES_PROJECT_ID,
			params: {
				filter: `done = false${hiddenFilter.value}`,
				expand,
			},
		})),
		{enabled: favoritesEnabled},
	)

	const upcomingEnabled = computed(() => {
		if (!authStore.authenticated || projectStore.isLoading) return false
		if (!favoritesEnabled.value) return true
		return favorites.isSuccess.value && favorites.tasks.value.length === 0
	})
	const upcoming = useTasks(
		computed((): TaskScope => ({
			params: {
				filter: `done = false && due_date < '${windowEnd}'${hiddenFilter.value}`,
				filter_timezone: timezone,
				sort_by: ['due_date', 'id'],
				order_by: ['asc', 'desc'],
				per_page: HOME_UPCOMING_LIMIT,
				expand,
			},
		})),
		{enabled: upcomingEnabled},
	)

	const kind = computed<HomeTasksKind>(() => {
		if (favoritesEnabled.value && favorites.tasks.value.length > 0) return 'favorites'
		if (upcomingEnabled.value && upcoming.tasks.value.length > 0) return 'upcoming'
		return null
	})
	const tasks = computed(() => {
		if (kind.value === 'favorites') return favorites.tasks.value
		if (kind.value === 'upcoming') return upcoming.tasks.value
		return []
	})

	function refetch() {
		// Starring a task only marks the queries stale, so favorites must be re-read even while upcoming is shown.
		const requests = []
		if (favoritesEnabled.value) requests.push(favorites.refetch())
		if (kind.value === 'upcoming') requests.push(upcoming.refetch())
		return Promise.all(requests)
	}

	return {kind, tasks, refetch}
}
