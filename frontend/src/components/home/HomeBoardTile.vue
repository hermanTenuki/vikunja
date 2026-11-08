<template>
	<RouterLink
		v-cy="'homeBoardTile'"
		:to="{name: 'project.view', params: {projectId: tile.project.id, viewId: tile.viewId}}"
		class="home-board-tile"
		:data-project-id="tile.project.id"
	>
		<span class="home-board-tile__head">
			<ColorBubble
				v-if="projectColor"
				:color="projectColor"
			/>
			<span class="home-board-tile__title">{{ tile.project.title }}</span>
			<Icon
				v-if="tile.project.is_favorite"
				icon="star"
				class="home-board-tile__star"
			/>
			<span class="home-board-tile__count">
				{{ tile.openCount }}
			</span>
			<span class="home-board-tile__link">
				{{ $t('home.dashboard.kanban') }}
			</span>
		</span>
		<template v-if="tile.buckets.length > 0">
			<span
				class="home-board-tile__strip home-board-tile__detail"
				aria-hidden="true"
			>
				<span
					v-for="bucket in tile.buckets"
					:key="bucket.id"
					class="home-board-tile__segment"
					:class="{'is-done': bucket.isDone, 'is-attention': bucket.isAttention}"
					:style="{flexGrow: bucket.count}"
				/>
			</span>
			<span class="home-board-tile__legend home-board-tile__detail">
				<span
					v-for="bucket in tile.buckets"
					:key="bucket.id"
					class="home-board-tile__legend-item"
					data-cy="homeBoardBucket"
				>
					{{ bucket.title }} <strong>{{ bucket.count }}</strong>
				</span>
			</span>
		</template>
	</RouterLink>
</template>

<script lang="ts" setup>
import {computed} from 'vue'

import ColorBubble from '@/components/misc/ColorBubble.vue'
import Icon from '@/components/misc/Icon'

import type {HomeBoardTile} from '@/composables/useHomeBoards'
import {getHexColor} from '@/helpers/task'

const props = defineProps<{
	tile: HomeBoardTile,
}>()

const projectColor = computed(() => getHexColor(props.tile.project.hex_color))
</script>

<style lang="scss" scoped>
.home-board-tile {
	display: flex;
	flex-direction: column;
	gap: .625rem;
	min-block-size: 44px;
	padding: .75rem 1rem;
	background: var(--white);
	border: 1px solid var(--grey-200);
	border-radius: $radius;
	box-shadow: var(--shadow-xs);
	color: var(--text);
	text-decoration: none;
	text-align: start;

	&:hover {
		border-color: var(--primary);
	}
}

.home-board-tile__head {
	display: flex;
	align-items: center;
	gap: .5rem;
	min-block-size: 44px;
	margin-block: -.75rem;
}

.home-board-tile__count {
	display: none;
}

.home-board-tile__title {
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.home-board-tile__star {
	color: var(--warning);
}

.home-board-tile__link,
.home-board-tile__count {
	margin-inline-start: auto;
	color: var(--primary);
	font-size: .85rem;
	white-space: nowrap;
}

.home-board-tile__strip {
	display: flex;
	gap: 2px;
	block-size: .5rem;
	border-radius: $radius;
	overflow: hidden;
}

.home-board-tile__segment {
	flex-basis: 0;
	min-inline-size: 4px;
	background: var(--grey-300);

	&.is-attention {
		background: var(--primary);
	}

	&.is-done {
		background: var(--success);
	}
}

.home-board-tile__legend {
	display: flex;
	flex-wrap: wrap;
	gap: .25rem .75rem;
	font-size: .8rem;
	color: var(--text-muted);
}

// Below the tablet content width the tile is a compact button: title and open count only.
@container (max-width: 719px) {
	.home-board-tile {
		justify-content: center;
	}

	.home-board-tile__detail,
	.home-board-tile__link {
		display: none;
	}

	.home-board-tile__count {
		display: inline;
	}
}

@container (min-width: 720px) {
	.home-board-tile__head {
		min-block-size: 0;
		margin-block: 0;
	}
}
</style>
