import {beforeEach, describe, expect, it, vi} from 'vitest'
import {mount} from '@vue/test-utils'
import {createI18n} from 'vue-i18n'

import en from '@/i18n/lang/en.json'
import {PRIORITIES} from '@/constants/priorities'

import PriorityLabel from './PriorityLabel.vue'

const authSettings = vi.hoisted(() => ({frontend_settings: {} as {minimum_priority?: number}}))

vi.mock('@/stores/auth', () => ({
	useAuthStore: () => ({settings: authSettings}),
}))
// Icon is a global component; expose the icon name so each level's own icon can be asserted.
const IconStub = {
	props: ['icon'],
	template: '<i :data-icon="icon" />',
}

const i18n = createI18n({legacy: false, locale: 'en', messages: {en}})

function mountLabel(props: {priority: number, showAll?: boolean, iconOnly?: boolean}) {
	return mount(PriorityLabel, {
		props,
		global: {plugins: [i18n], directives: {tooltip: {}}, components: {Icon: IconStub}},
	})
}

describe('PriorityLabel', () => {
	beforeEach(() => {
		authSettings.frontend_settings = {}
	})

	it.each([
		[PRIORITIES.UNSET],
		[-1],
		[6],
		[2.5],
	])('renders nothing for priority %s, even with show-all', (priority) => {
		expect(mountLabel({priority}).find('.priority-label').exists()).toBe(false)
		expect(mountLabel({priority, showAll: true}).find('.priority-label').exists()).toBe(false)
	})

	it.each([
		[PRIORITIES.LOW, 'angles-down', 'Low', 'is-faint'],
		[PRIORITIES.MEDIUM, 'angle-down', 'Medium', 'is-muted'],
		[PRIORITIES.HIGH, 'equals', 'High', 'is-muted'],
		[PRIORITIES.URGENT, 'angles-up', 'Urgent', 'is-warning'],
		[PRIORITIES.DO_NOW, 'exclamation-circle', 'DO NOW', 'is-danger'],
	])('renders level %i with icon %s, word %s and tone %s', (priority, icon, word, tone) => {
		const wrapper = mountLabel({priority})

		expect(wrapper.find('.priority-label__text').text()).toBe(word)
		expect(wrapper.find('.priority-label').classes()).toContain(tone)
		expect(wrapper.find('.priority-label__icon').attributes('data-icon')).toBe(icon)
	})

	it('shows only the icon with a labelled role in icon-only mode', () => {
		const wrapper = mountLabel({priority: PRIORITIES.DO_NOW, iconOnly: true})

		expect(wrapper.find('.priority-label__text').exists()).toBe(false)
		expect(wrapper.find('.priority-label__icon').exists()).toBe(true)
		expect(wrapper.attributes('aria-label')).toBe('Priority: DO NOW')
		expect(wrapper.attributes('role')).toBe('img')
	})

	it('hides a level below the user minimum unless show-all is set', () => {
		authSettings.frontend_settings = {minimum_priority: PRIORITIES.HIGH}

		expect(mountLabel({priority: PRIORITIES.MEDIUM}).find('.priority-label').exists()).toBe(false)
		expect(mountLabel({priority: PRIORITIES.MEDIUM, showAll: true}).find('.priority-label').exists()).toBe(true)
		expect(mountLabel({priority: PRIORITIES.HIGH}).find('.priority-label').exists()).toBe(true)
	})

	it('shows the lowest level when no minimum is configured', () => {
		expect(mountLabel({priority: PRIORITIES.LOW}).find('.priority-label').exists()).toBe(true)
	})
})
