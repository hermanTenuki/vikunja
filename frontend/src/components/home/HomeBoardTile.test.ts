import {describe, expect, it, vi} from 'vitest'
import {mount} from '@vue/test-utils'
import {createRouter, createMemoryHistory} from 'vue-router'
import {createI18n} from 'vue-i18n'

import en from '@/i18n/lang/en.json'
import type {ProjectResponse} from '@/client/queries/projects'
import type {HomeBoardTile as HomeBoardTileModel} from '@/composables/useHomeBoards'

import HomeBoardTile from './HomeBoardTile.vue'

vi.mock('@/components/misc/Icon', () => ({default: {render: () => null}}))

const i18n = createI18n({legacy: false, locale: 'en', messages: {en}})

const noop = {}

const tile: HomeBoardTileModel = {
	project: {id: 3, title: 'Goals', is_favorite: true} as ProjectResponse,
	viewId: 12,
	openCount: 7,
	buckets: [
		{id: 1, title: 'Backlog', count: 4, isDone: false, isAttention: false},
		{id: 2, title: 'In progress', count: 3, isDone: false, isAttention: true},
		{id: 3, title: 'Done', count: 9, isDone: true, isAttention: false},
	],
}

function mountTile() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{path: '/', component: {render: () => null}},
			{path: '/projects/:projectId/:viewId', name: 'project.view', component: {render: () => null}},
		],
	})
	return mount(HomeBoardTile, {
		props: {tile},
		global: {
			plugins: [i18n, router],
			directives: {cy: noop},
		},
	})
}

describe('HomeBoardTile', () => {
	it('links to the kanban view of the board', () => {
		const wrapper = mountTile()

		expect(wrapper.attributes('href')).toBe('/projects/3/12')
	})

	it('renders exactly the buckets it was given, marking done and attention segments', () => {
		const wrapper = mountTile()

		const legend = wrapper.findAll('[data-cy="homeBoardBucket"]').map(item => item.text())
		expect(legend).toEqual(['Backlog 4', 'In progress 3', 'Done 9'])
		const segments = wrapper.findAll('.home-board-tile__segment')
		expect(segments.map(segment => [segment.classes('is-attention'), segment.classes('is-done')])).toEqual([
			[false, false],
			[true, false],
			[false, true],
		])
	})

	it('shows the title, the open count and the kanban link', () => {
		const wrapper = mountTile()

		expect(wrapper.find('.home-board-tile__title').text()).toBe('Goals')
		expect(wrapper.find('.home-board-tile__count').text()).toBe('7')
		expect(wrapper.find('.home-board-tile__link').text()).toBe('Kanban')
	})
})
