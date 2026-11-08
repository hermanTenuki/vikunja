<template>
	<div
		v-cy="'homeDashboard'"
		class="home-dashboard"
	>
		<div
			class="home-dashboard__layout"
			:class="{'is-split': hasMain && tiles.length > 0}"
		>
			<div
				v-if="hasMain"
				class="home-dashboard__main"
			>
				<section
					v-if="attention.cards.length > 0"
					v-cy="'homeAttention'"
					class="home-dashboard__block"
				>
					<h2 class="home-dashboard__title">
						{{ $t('home.dashboard.attention') }}
						<span
							class="home-dashboard__total"
							data-cy="homeAttentionTotal"
						>
							{{ attention.total }}
						</span>
					</h2>
					<div class="home-dashboard__cards">
						<HomeAttentionCard
							v-for="card in attention.cards"
							:key="card.task.id"
							:card="card"
						/>
					</div>
				</section>

				<HomeTaskSection
					v-if="kind !== null"
					:kind="kind"
					:tasks="tasks"
					@taskUpdated="refetch()"
				/>
			</div>

			<section
				v-if="tiles.length > 0"
				v-cy="'homeBoards'"
				class="home-dashboard__block home-dashboard__boards"
			>
				<h2 class="home-dashboard__title">
					{{ $t('home.dashboard.boards') }}
				</h2>
				<div class="home-dashboard__tiles">
					<HomeBoardTile
						v-for="tile in tiles"
						:key="tile.project.id"
						:tile="tile"
					/>
				</div>
			</section>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {computed} from 'vue'

import HomeAttentionCard from '@/components/home/HomeAttentionCard.vue'
import HomeBoardTile from '@/components/home/HomeBoardTile.vue'
import HomeTaskSection from '@/components/home/HomeTaskSection.vue'

import {useHomeBoards} from '@/composables/useHomeBoards'
import {useHomeTasks} from '@/composables/useHomeTasks'

const {attention, tiles} = useHomeBoards()
const {kind, tasks, refetch} = useHomeTasks()
const hasMain = computed(() => attention.value.cards.length > 0 || kind.value !== null)
</script>

<style lang="scss" scoped>
.home-dashboard {
	container-type: inline-size;
	margin-block-start: 1.5rem;
	text-align: start;
}

.home-dashboard__layout {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.home-dashboard__title {
	display: flex;
	align-items: baseline;
	gap: .5rem;
	margin-block-end: .5rem;
	font-size: 1.1rem;
}

.home-dashboard__total {
	color: var(--text-muted);
	font-size: .9rem;
	font-weight: 400;
}

.home-dashboard__main {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.home-dashboard__boards {
	order: -1;
}

.home-dashboard__cards {
	display: grid;
	gap: .75rem;
	grid-template-columns: 1fr;
}

// Phone: boards are compact buttons in a single row.
.home-dashboard__tiles {
	display: grid;
	gap: .5rem;
	grid-auto-flow: column;
	grid-auto-columns: minmax(0, 1fr);
}

// Content width: tablet layout from 720px, desktop from 880px.
// With the 300px sidebar and 1.5rem paddings that is a 1280px viewport for desktop.
@container (min-width: 720px) {
	.home-dashboard__cards {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.home-dashboard__tiles {
		gap: .75rem;
		grid-auto-flow: row;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

@container (min-width: 880px) {
	.home-dashboard__layout.is-split {
		display: grid;
		grid-template-columns: 1.85fr 1fr;
		align-items: start;
	}

	.is-split .home-dashboard__main {
		grid-column: 1;
		grid-row: 1;
	}

	.is-split .home-dashboard__boards {
		order: 0;
		grid-column: 2;
		grid-row: 1;
	}

	.is-split .home-dashboard__tiles {
		grid-template-columns: 1fr;
	}
}
</style>
