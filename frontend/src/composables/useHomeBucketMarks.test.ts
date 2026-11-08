import {beforeEach, describe, expect, it, vi} from 'vitest'
import {defineComponent, nextTick} from 'vue'
import {flushPromises, mount} from '@vue/test-utils'
import {createPinia, setActivePinia} from 'pinia'
import {VueQueryPlugin} from '@tanstack/vue-query'
import {createI18n} from 'vue-i18n'

import {queryClient} from '@/client/queryClient'
import {accountKeys} from '@/client/queries/account'
import {AUTH_TYPES} from '@/constants/auth'
import en from '@/i18n/lang/en.json'
import {success} from '@/message'
import {useAuthStore} from '@/stores/auth'
import {toggleHomeBucketMark, useHomeBucketMarks} from './useHomeBucketMarks'

const sdk = vi.hoisted(() => ({
	patchUserSettingsRead: vi.fn(),
	userShow: vi.fn(),
	userGetAvatarProvider: vi.fn(),
}))
const tokenIdentity = vi.hoisted(() => ({current: {id: 1, type: 1}}))

vi.mock('@/client/generated', () => sdk)
vi.mock('@/message', () => ({
	error: vi.fn(),
	success: vi.fn(),
}))
vi.mock('@/helpers/auth', async importOriginal => ({
	...await importOriginal<typeof import('@/helpers/auth')>(),
	getTokenIdentity: () => tokenIdentity.current,
}))

function mountMarks() {
	let marks!: ReturnType<typeof useHomeBucketMarks>
	mount(defineComponent({
		setup() {
			marks = useHomeBucketMarks()
			return () => null
		},
	}), {
		global: {
			plugins: [
				createI18n({legacy: false, locale: 'en', fallbackLocale: 'en', messages: {en}}),
				[VueQueryPlugin, {queryClient}],
			],
		},
	})
	return marks
}

function seedAccount(frontendSettings?: Record<string, unknown>) {
	queryClient.setQueryData(accountKeys.user(1), {
		id: 1,
		settings: {frontend_settings: frontendSettings},
	})
}

describe('toggleHomeBucketMark', () => {
	it('adds the bucket to the attention list', () => {
		const result = toggleHomeBucketMark({home_attention_bucket_ids: [], home_hidden_bucket_ids: []}, 5, 'attention')

		expect(result).toEqual({home_attention_bucket_ids: [5], home_hidden_bucket_ids: []})
	})

	it('adds the bucket to the hidden list', () => {
		const result = toggleHomeBucketMark({home_attention_bucket_ids: [], home_hidden_bucket_ids: []}, 5, 'hidden')

		expect(result).toEqual({home_attention_bucket_ids: [], home_hidden_bucket_ids: [5]})
	})

	it('moves the bucket out of the other list when the kind changes', () => {
		const result = toggleHomeBucketMark({home_attention_bucket_ids: [5], home_hidden_bucket_ids: []}, 5, 'hidden')

		expect(result).toEqual({home_attention_bucket_ids: [], home_hidden_bucket_ids: [5]})
	})

	it('removes the mark when toggled a second time', () => {
		const result = toggleHomeBucketMark({home_attention_bucket_ids: [5], home_hidden_bucket_ids: []}, 5, 'attention')

		expect(result).toEqual({home_attention_bucket_ids: [], home_hidden_bucket_ids: []})
	})

	it('keeps the other buckets marked', () => {
		const result = toggleHomeBucketMark({home_attention_bucket_ids: [1, 5], home_hidden_bucket_ids: [2]}, 5, 'hidden')

		expect(result).toEqual({home_attention_bucket_ids: [1], home_hidden_bucket_ids: [2, 5]})
	})

	it('does not mutate its input', () => {
		const marks = {home_attention_bucket_ids: [5], home_hidden_bucket_ids: [2]}

		toggleHomeBucketMark(marks, 5, 'hidden')

		expect(marks).toEqual({home_attention_bucket_ids: [5], home_hidden_bucket_ids: [2]})
	})
})

describe('useHomeBucketMarks', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		queryClient.clear()
		tokenIdentity.current = {id: 1, type: 1}
		Object.values(sdk).forEach(mock => mock.mockReset())
		vi.mocked(success).mockClear()
		sdk.patchUserSettingsRead.mockResolvedValue({data: undefined, error: undefined, response: {status: 200}})
		sdk.userShow.mockResolvedValue({data: {id: 1, settings: {}}})
	})

	async function signIn() {
		useAuthStore().setSession({id: 1, type: AUTH_TYPES.USER, exp: 0})
		await nextTick()
	}

	it('reports no marks when the account has none stored', async () => {
		await signIn()
		seedAccount(undefined)

		const marks = mountMarks()

		expect([marks.isAttentionBucket(5), marks.isHiddenBucket(5)]).toEqual([false, false])
	})

	it('reports the stored marks', async () => {
		await signIn()
		seedAccount({home_attention_bucket_ids: [5], home_hidden_bucket_ids: [6]})

		const marks = mountMarks()

		expect([marks.isAttentionBucket(5), marks.isHiddenBucket(5), marks.isHiddenBucket(6)]).toEqual([true, false, true])
	})

	it('saves both keys for the session and shows a success message', async () => {
		await signIn()
		seedAccount({home_attention_bucket_ids: [7], home_hidden_bucket_ids: [6]})
		const marks = mountMarks()

		marks.toggleAttentionBucket(5)
		await flushPromises()

		expect(sdk.patchUserSettingsRead.mock.calls[0][0].body).toEqual({
			frontend_settings: {home_attention_bucket_ids: [7, 5], home_hidden_bucket_ids: [6]},
		})
		expect(success).toHaveBeenCalledExactlyOnceWith({message: 'The home page setting for this column has been saved.'})
	})

	it('does nothing without a session', async () => {
		const marks = mountMarks()

		marks.toggleAttentionBucket(5)
		await flushPromises()

		expect(sdk.patchUserSettingsRead).not.toHaveBeenCalled()
		expect(success).not.toHaveBeenCalled()
	})
})
