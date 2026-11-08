import {useRouter} from 'vue-router'
import type {Task} from '@/client/generated'
import {useCurrentProject} from '@/composables/useCurrentProject'

// Cards in these views open the task detail as a modal over the view.
const MODAL_VIEW_KINDS = ['kanban', 'gantt']

/**
 * Opens a task the user just created the way a click on it opens it where they are:
 * as a modal over a kanban or gantt view, as a page everywhere else.
 */
export function useOpenCreatedTask() {
	const router = useRouter()
	const {currentProject} = useCurrentProject()

	function backdropView(): string | undefined {
		// Already in a task modal: the new task replaces it over the same view.
		const current = window.history.state?.backdropView
		if (typeof current === 'string') {
			return current
		}

		const route = router.currentRoute.value
		if (route.name !== 'project.view') {
			return undefined
		}
		const viewId = Number(route.params.viewId)
		const kind = currentProject.value?.views.find(view => view.id === viewId)?.view_kind
		return kind !== undefined && MODAL_VIEW_KINDS.includes(kind) ? route.fullPath : undefined
	}

	/**
	 * Call when the create starts, open with the result once it is created. The task is not
	 * opened if the user moved on to another page while it was being created.
	 */
	function beginTaskCreation() {
		const startedOn = router.currentRoute.value.fullPath
		const backdrop = backdropView()

		return async (id: Task['id']) => {
			if (id === undefined || router.currentRoute.value.fullPath !== startedOn) {
				return
			}
			await router.push({
				name: 'task.detail',
				params: {id},
				state: backdrop ? {backdropView: backdrop} : undefined,
			})
		}
	}

	return {beginTaskCreation}
}
