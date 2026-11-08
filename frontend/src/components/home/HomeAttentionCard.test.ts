import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'
import {mount} from '@vue/test-utils'
import {createPinia, setActivePinia} from 'pinia'
import {createRouter, createMemoryHistory} from 'vue-router'
import {createI18n} from 'vue-i18n'

import en from '@/i18n/lang/en.json'
import type {ProjectResponse} from '@/client/queries/projects'
import type {BucketResponse} from '@/client/queries/kanban'
import type {TaskResponse} from '@/client/queries/tasks'
import type {AttentionCard} from '@/composables/useHomeBoards'
import {MILLISECONDS_A_DAY} from '@/constants/date'
import {PRIORITIES} from '@/constants/priorities'

import HomeAttentionCard from './HomeAttentionCard.vue'

vi.mock('@/components/misc/Icon', () => ({default: {render: () => null}}))

const NOW = new Date('2026-11-08T12:00:00Z')
const i18n = createI18n({legacy: false, locale: 'en', messages: {en}})

const noop = {}

function daysAgo(days: number) {
	return new Date(NOW.getTime() - days * MILLISECONDS_A_DAY).toISOString()
}

function buildCard(taskOverrides: Partial<TaskResponse> = {}): AttentionCard {
	return {
		task: {id: 42, title: 'Pick the hardware', done: false, priority: PRIORITIES.UNSET, ...taskOverrides} as TaskResponse,
		bucket: {id: 5, title: 'In progress'} as BucketResponse,
		project: {id: 3, title: 'Goals'} as ProjectResponse,
	}
}

function mountCard(card: AttentionCard) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{path: '/', component: {render: () => null}},
			{path: '/tasks/:id', name: 'task.detail', component: {render: () => null}},
		],
	})
	return mount(HomeAttentionCard, {
		props: {card},
		global: {
			plugins: [i18n, createPinia(), router],
			directives: {cy: noop, tooltip: noop},
		},
	})
}

describe('HomeAttentionCard', () => {
	beforeAll(() => {
		vi.useFakeTimers({now: NOW})
	})

	afterAll(() => {
		vi.useRealTimers()
	})

	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('links to the task page and shows the bucket and board', () => {
		const wrapper = mountCard(buildCard())

		expect(wrapper.attributes('href')).toBe('/tasks/42')
		expect(wrapper.find('[data-cy="homeAttentionBucket"]').text()).toBe('In progress')
		expect(wrapper.text()).toContain('Goals')
	})

	it.each([
		[13, null],
		[14, 'is-warning'],
		[29, 'is-warning'],
		[30, 'is-danger'],
	])('marks a card that entered its bucket %i days ago with %s', (days, level) => {
		const wrapper = mountCard(buildCard({bucket_entered_at: daysAgo(days)}))

		const age = wrapper.find('[data-cy="homeAttentionAge"]')
		expect(age.exists()).toBe(true)
		expect(age.classes('is-warning')).toBe(level === 'is-warning')
		expect(age.classes('is-danger')).toBe(level === 'is-danger')
	})

	it('shows no time in bucket without bucket_entered_at', () => {
		const wrapper = mountCard(buildCard({bucket_entered_at: undefined}))

		expect(wrapper.find('[data-cy="homeAttentionAge"]').exists()).toBe(false)
	})

	it.each([
		[PRIORITIES.MEDIUM, false],
		[PRIORITIES.HIGH, true],
		[PRIORITIES.URGENT, true],
	])('shows the priority %i label only from high up: %s', (priority, shown) => {
		const wrapper = mountCard(buildCard({priority}))

		expect(wrapper.find('.priority-label').exists()).toBe(shown)
	})
})
