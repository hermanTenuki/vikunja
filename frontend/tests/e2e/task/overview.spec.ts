import {test, expect} from '../../support/fixtures'
import {ProjectFactory} from '../../factories/project'
import {ProjectViewFactory} from '../../factories/project_view'
import {TaskFactory} from '../../factories/task'
import {BucketFactory} from '../../factories/bucket'
import {TaskBucketFactory} from '../../factories/task_buckets'
import {LabelFactory} from '../../factories/labels'
import {LabelTaskFactory} from '../../factories/label_task'
import {updateUserSettings} from '../../support/updateUserSettings'
import {createDefaultViews} from '../project/prepareProjects'
import type {APIRequestContext} from '@playwright/test'

const DAY = 24 * 60 * 60 * 1000

const upcomingRows = '[data-cy="homeTaskSection"][data-kind="upcoming"] .task'
const favoritesSection = '[data-cy="homeTaskSection"][data-kind="favorites"]'

function inDays(days: number) {
	return new Date(Date.now() + days * DAY).toISOString()
}

async function seedTasks(numberOfTasks = 50, startDueDate = new Date()) {
	const project = (await ProjectFactory.create())[0]
	const views = await createDefaultViews(project.id)
	await BucketFactory.create(1, {
		project_view_id: views[3].id,
	})
	const tasks = []
	let dueDate = startDueDate
	for (let i = 0; i < numberOfTasks; i++) {
		const now = new Date()
		dueDate = new Date(new Date(dueDate).setDate(dueDate.getDate() + 2))
		tasks.push({
			id: i + 1,
			project_id: project.id,
			done: false,
			created_by_id: 1,
			title: 'Test Task ' + i,
			index: i + 1,
			due_date: dueDate.toISOString(),
			created: now.toISOString(),
			updated: now.toISOString(),
		})
	}
	await TaskFactory.seed(TaskFactory.table, tasks)
	return {tasks, project}
}

// One project with a manual kanban (Backlog, In progress, Cancelled), starred so that it shows up as a board tile.
async function seedKanban(apiContext: APIRequestContext, userToken: string) {
	const [project] = await ProjectFactory.create(1, {title: 'Goals'})
	const [view] = await ProjectViewFactory.create(1, {
		id: 1,
		project_id: project.id,
		view_kind: 3,
		bucket_configuration_mode: 1,
	})
	const [backlog, inProgress, cancelled] = await BucketFactory.create(3, {
		project_view_id: view.id,
		title: (i: number) => ['Backlog', 'In progress', 'Cancelled'][i - 1],
	})
	const starred = await apiContext.post(`projects/${project.id}`, {
		headers: {Authorization: `Bearer ${userToken}`},
		data: {title: project.title, is_favorite: true},
	})
	expect(starred.ok()).toBeTruthy()
	return {project, view, backlog, inProgress, cancelled}
}

async function seedTaskInBucket(
	bucket: {id: number},
	view: {id: number},
	task: {id: number, project_id: number, title: string, due_date?: string},
) {
	await TaskFactory.create(1, task, false)
	await TaskBucketFactory.create(1, {task_id: task.id, bucket_id: bucket.id, project_view_id: view.id}, false)
}

test.describe('Home Page Task Overview', () => {
	test('Should show a task in a bucket marked for the home page as an attention card', async ({authenticatedPage: page, apiContext, userToken}) => {
		const {project, view, backlog, inProgress} = await seedKanban(apiContext, userToken)
		await seedTaskInBucket(inProgress, view, {id: 1, project_id: project.id, title: 'Pick the hardware'})
		await seedTaskInBucket(backlog, view, {id: 2, project_id: project.id, title: 'Someday task'})
		await updateUserSettings(apiContext, userToken, {frontend_settings: {home_attention_bucket_ids: [inProgress.id]}})

		await page.goto('/')

		const cards = page.locator('[data-cy="homeAttentionCard"]')
		await expect(cards).toHaveCount(1)
		await expect(cards.first()).toContainText('Pick the hardware')
		await expect(cards.first().locator('[data-cy="homeAttentionBucket"]')).toHaveText('In progress')
		await expect(page.locator('[data-cy="homeAttentionTotal"]')).toHaveText('1')

		await cards.first().click()
		await expect(page).toHaveURL(/\/tasks\/1$/)
	})

	test('Should leave a task in a bucket hidden from the home page out of the upcoming deadlines and the board tile', async ({authenticatedPage: page, apiContext, userToken}) => {
		const {project, view, backlog, cancelled} = await seedKanban(apiContext, userToken)
		await seedTaskInBucket(cancelled, view, {id: 1, project_id: project.id, title: 'Cancelled soon', due_date: inDays(2)})
		await seedTaskInBucket(backlog, view, {id: 2, project_id: project.id, title: 'Visible soon', due_date: inDays(4)})
		await updateUserSettings(apiContext, userToken, {frontend_settings: {home_hidden_bucket_ids: [cancelled.id]}})

		await page.goto('/')

		const rows = page.locator(upcomingRows)
		await expect(rows).toHaveCount(1)
		await expect(rows.first()).toContainText('Visible soon')
		const legend = page.locator('[data-cy="homeBoardTile"] [data-cy="homeBoardBucket"]')
		await expect(legend).toHaveText(['Backlog 1', 'In progress 0'])
	})

	test('Should open the kanban view when a favorite board tile is clicked', async ({authenticatedPage: page, apiContext, userToken}) => {
		const {project, view} = await seedKanban(apiContext, userToken)

		await page.goto('/')
		await page.locator('[data-cy="homeBoardTile"]').click()

		await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/${view.id}$`))
		await expect(page.locator('.kanban')).toBeVisible()
	})

	test('Should switch to the favorite tasks once a task is starred and skip favorites from hidden buckets', async ({authenticatedPage: page, apiContext, userToken}) => {
		const {project, view, backlog, cancelled} = await seedKanban(apiContext, userToken)
		await seedTaskInBucket(backlog, view, {id: 1, project_id: project.id, title: 'Plain task', due_date: inDays(3)})
		await seedTaskInBucket(cancelled, view, {id: 2, project_id: project.id, title: 'Starred but cancelled'})
		const starred = await apiContext.put('/api/v2/tasks/2', {
			headers: {Authorization: `Bearer ${userToken}`},
			data: {title: 'Starred but cancelled', is_favorite: true},
		})
		expect(starred.ok()).toBeTruthy()
		await updateUserSettings(apiContext, userToken, {frontend_settings: {home_hidden_bucket_ids: [cancelled.id]}})

		await page.goto('/')

		// The only favorite sits in a hidden bucket, so the upcoming deadlines are shown instead.
		await expect(page.locator(upcomingRows)).toHaveCount(1)
		await expect(page.locator(upcomingRows).first()).toContainText('Plain task')
		await expect(page.locator(favoritesSection)).toHaveCount(0)

		const starRequest = page.waitForResponse(response =>
			response.url().includes('/tasks/1') && response.request().method() === 'PATCH',
		)
		await page.locator(upcomingRows).first().locator('.favorite').click()
		await starRequest

		const favorites = page.locator(`${favoritesSection} .task`)
		await expect(favorites).toHaveCount(1)
		await expect(favorites.first()).toContainText('Plain task')
		await expect(page.locator(favoritesSection)).not.toContainText('Starred but cancelled')
	})

	test('Should show tasks with a near due date first in the upcoming deadlines', async ({authenticatedPage: page}) => {
		const {tasks} = await seedTasks(50, new Date(Date.now() - DAY))

		await page.goto('/')

		// Tasks are due every second day starting tomorrow: +1 ... +13 fall into the 14 day window, the next one (+15) does not.
		const rows = page.locator(upcomingRows)
		await expect(rows.first()).toContainText(tasks[0].title)
		await expect(rows).toHaveCount(7)
		for (let index = 0; index < 7; index++) {
			await expect(rows.nth(index)).toContainText(tasks[index].title)
		}
		await expect(page.locator('[data-cy="homeTaskSection"]')).not.toContainText(tasks[20].title)
	})

	test('Should show overdue tasks first and at most 10 rows in the upcoming deadlines', async ({authenticatedPage: page}) => {
		const oldDate = new Date(Date.now() - 14 * DAY)
		const {tasks} = await seedTasks(50, oldDate)

		await page.goto('/')

		const rows = page.locator(upcomingRows)
		await expect(rows).toHaveCount(10)
		for (let index = 0; index < 10; index++) {
			await expect(rows.nth(index)).toContainText(tasks[index].title)
		}
		await expect(rows.first()).toHaveAttribute('data-is-overdue', 'true')
	})

	test('Should open a task created from the home page', async ({authenticatedPage: page, apiContext, userToken}) => {
		const {project} = await seedTasks(1)
		await updateUserSettings(apiContext, userToken, {
			default_project_id: project.id,
			overdue_tasks_reminders_time: '9:00',
		})
		await page.goto('/')

		const newTaskTitle = 'New Task'
		const addTaskInput = page.locator('.add-task-textarea')
		await expect(addTaskInput).toBeVisible()
		await addTaskInput.fill(newTaskTitle)
		const createTaskPromise = page.waitForResponse(response =>
			response.url().includes('/api/v2/projects/') &&
			response.url().includes('/tasks/bulk') &&
			response.request().method() === 'POST',
		)
		await addTaskInput.press('Enter')
		await createTaskPromise

		await expect(page).toHaveURL(/\/tasks\/\d+$/)
		await expect(page.locator('.task-view h1[contenteditable]')).toHaveText(newTaskTitle)
	})

	test('Should show the label filtered task list instead of the dashboard for a labels link', async ({authenticatedPage: page}) => {
		const project = (await ProjectFactory.create())[0]
		await createDefaultViews(project.id)
		const [label] = await LabelFactory.create(1, {title: 'Errands'})
		await TaskFactory.create(2, {
			id: (i: number) => i,
			project_id: project.id,
			title: (i: number) => i === 1 ? 'Labelled task' : 'Unlabelled task',
			due_date: inDays(3),
		})
		await LabelTaskFactory.create(1, {task_id: 1, label_id: label.id}, false)

		await page.goto(`/?labels=${label.id}`)

		await expect(page.locator('[data-cy="showTasks"]')).toContainText('Labelled task')
		await expect(page.locator('[data-cy="showTasks"]')).not.toContainText('Unlabelled task')
		await expect(page.locator('[data-cy="homeDashboard"]')).toHaveCount(0)
	})

	test('Should show the cta buttons for new project when there are no tasks', async ({authenticatedPage: page}) => {
		// The import hint is not gated by the dashboard: a project without tasks is enough for it to show.
		const project = (await ProjectFactory.create())[0]
		await createDefaultViews(project.id)

		await page.goto('/')

		await expect(page.locator('.home.app-content .content')).toContainText('Import your projects and tasks from other services into Vikunja:')
	})

	test('Should not show the cta buttons for new project when there are tasks', async ({authenticatedPage: page}) => {
		await seedTasks()

		await page.goto('/')

		await expect(page.locator('[data-cy="homeTaskSection"]')).toBeVisible()
		await expect(page.locator('.home.app-content .content')).not.toContainText('You can create a new project for your new tasks:')
		await expect(page.locator('.home.app-content .content')).not.toContainText('Or import your projects and tasks from other services into Vikunja:')
	})
})
