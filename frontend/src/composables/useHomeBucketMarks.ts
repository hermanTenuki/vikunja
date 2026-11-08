import {useAuthStore} from '@/stores/auth'
import {useUpdateFrontendSettingsMutation} from '@/client/queries/account'
import {useI18n} from 'vue-i18n'
import {success} from '@/message'

export type HomeBucketMarkKind = 'attention' | 'hidden'

export interface HomeBucketMarks {
	home_attention_bucket_ids: readonly number[]
	home_hidden_bucket_ids: readonly number[]
}

/**
 * Переключает отметку колонки. Отметки взаимоисключающие: включение одной снимает другую,
 * повторное переключение снимает отметку. Входной объект не мутируется.
 */
export function toggleHomeBucketMark(
	marks: HomeBucketMarks,
	bucketId: number,
	kind: HomeBucketMarkKind,
): HomeBucketMarks {
	const withoutBucket = (ids: readonly number[]) => ids.filter(id => id !== bucketId)
	const attention = withoutBucket(marks.home_attention_bucket_ids)
	const hidden = withoutBucket(marks.home_hidden_bucket_ids)
	const wasMarked = (kind === 'attention' ? marks.home_attention_bucket_ids : marks.home_hidden_bucket_ids).includes(bucketId)

	if (wasMarked) {
		return {home_attention_bucket_ids: attention, home_hidden_bucket_ids: hidden}
	}

	return kind === 'attention'
		? {home_attention_bucket_ids: [...attention, bucketId], home_hidden_bucket_ids: hidden}
		: {home_attention_bucket_ids: attention, home_hidden_bucket_ids: [...hidden, bucketId]}
}

export function useHomeBucketMarks() {
	const authStore = useAuthStore()
	const updateFrontendSettings = useUpdateFrontendSettingsMutation()
	const {t} = useI18n({useScope: 'global'})

	function currentMarks(): HomeBucketMarks {
		const settings = authStore.settings?.frontend_settings
		return {
			home_attention_bucket_ids: settings?.home_attention_bucket_ids ?? [],
			home_hidden_bucket_ids: settings?.home_hidden_bucket_ids ?? [],
		}
	}

	function isAttentionBucket(bucketId: number): boolean {
		return currentMarks().home_attention_bucket_ids.includes(bucketId)
	}

	function isHiddenBucket(bucketId: number): boolean {
		return currentMarks().home_hidden_bucket_ids.includes(bucketId)
	}

	function toggleMark(bucketId: number, kind: HomeBucketMarkKind) {
		const session = authStore.session
		if (!session) return

		const pair = toggleHomeBucketMark(currentMarks(), bucketId, kind)
		const message = t('project.kanban.homeMarkSavedSuccess')

		updateFrontendSettings.mutate(
			{id: session.id, type: session.type, frontendSettings: pair},
			{onSuccess: () => success({message})},
		)
	}

	return {
		isAttentionBucket,
		isHiddenBucket,
		toggleAttentionBucket: (bucketId: number) => toggleMark(bucketId, 'attention'),
		toggleHiddenBucket: (bucketId: number) => toggleMark(bucketId, 'hidden'),
	}
}
