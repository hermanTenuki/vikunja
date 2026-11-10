import {beforeEach, describe, expect, it, vi} from 'vitest'
import {mount} from '@vue/test-utils'
import {createI18n} from 'vue-i18n'

import en from '@/i18n/lang/en.json'
import {PRIORITIES} from '@/constants/priorities'

import PrioritySelect from './PrioritySelect.vue'

vi.mock('@/stores/auth', () => ({
	useAuthStore: () => ({settings: {frontend_settings: {}}}),
}))
vi.mock('@/components/misc/Icon', () => ({default: {render: () => null}}))

const i18n = createI18n({legacy: false, locale: 'en', messages: {en}})

function mountSelect(props: {modelValue: number, disabled?: boolean}) {
	return mount(PrioritySelect, {
		props,
		attachTo: document.body,
		global: {plugins: [i18n], directives: {tooltip: {}}},
	})
}

describe('PrioritySelect', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
	})

	it('lists the levels from highest to lowest, then a divider and Unset', async () => {
		const wrapper = mountSelect({modelValue: PRIORITIES.UNSET})
		await wrapper.find('.dropdown').trigger('pointerenter')

		const items = wrapper.findAll('.priority-select__item').map(item => item.text())
		expect(items).toEqual(['DO NOW', 'Urgent', 'High', 'Medium', 'Low', 'Unset'])
		const menu = wrapper.find('.dropdown-content').element
		const divider = menu.querySelector('.dropdown-divider')
		expect(divider).not.toBeNull()
		expect(divider?.nextElementSibling?.textContent?.trim()).toBe('Unset')
	})

	it('marks only the current level', async () => {
		const wrapper = mountSelect({modelValue: PRIORITIES.HIGH})
		await wrapper.find('.dropdown').trigger('pointerenter')

		const current = wrapper.findAll('.priority-select__item.is-current')
		expect(current.map(item => item.text())).toEqual(['High'])
	})

	it('marks nothing for a number outside the scale', async () => {
		const wrapper = mountSelect({modelValue: 9})
		await wrapper.find('.dropdown').trigger('pointerenter')

		expect(wrapper.findAll('.is-current')).toHaveLength(0)
	})

	it('marks Unset for priority 0', async () => {
		const wrapper = mountSelect({modelValue: PRIORITIES.UNSET})
		await wrapper.find('.dropdown').trigger('pointerenter')

		expect(wrapper.findAll('.is-current').map(item => item.text())).toEqual(['Unset'])
	})

	it.each([
		['Urgent', PRIORITIES.URGENT],
		['Unset', PRIORITIES.UNSET],
	])('emits update:modelValue with the value of the clicked item %s', async (label, value) => {
		const wrapper = mountSelect({modelValue: PRIORITIES.MEDIUM})
		await wrapper.find('.dropdown').trigger('pointerenter')

		const item = wrapper.findAll('.priority-select__item').find(i => i.text() === label)!
		await item.trigger('click')

		expect(wrapper.emitted('update:modelValue')).toEqual([[value]])
	})

	it('does not emit when the current item is clicked', async () => {
		const wrapper = mountSelect({modelValue: PRIORITIES.MEDIUM})
		await wrapper.find('.dropdown').trigger('pointerenter')

		await wrapper.find('.priority-select__item.is-current').trigger('click')

		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
	})

	it('opens the menu through the exposed open()', async () => {
		const wrapper = mountSelect({modelValue: PRIORITIES.UNSET})
		expect(wrapper.find('.dropdown-menu').exists()).toBe(false)

		wrapper.vm.open()
		await wrapper.vm.$nextTick()

		expect(wrapper.find('.dropdown-menu').isVisible()).toBe(true)
		expect(wrapper.find('.priority-select__trigger').attributes('aria-expanded')).toBe('true')
	})

	it('renders no menu and ignores open() when disabled', async () => {
		const wrapper = mountSelect({modelValue: PRIORITIES.URGENT, disabled: true})

		wrapper.vm.open()
		await wrapper.vm.$nextTick()

		expect(wrapper.find('.dropdown-menu').exists()).toBe(false)
		expect(wrapper.find('.priority-select__trigger').exists()).toBe(false)
		expect(wrapper.find('.priority-label').text()).toBe('Urgent')
	})
})
