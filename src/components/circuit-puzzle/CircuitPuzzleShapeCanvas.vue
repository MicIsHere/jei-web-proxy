<template>
  <div
    :class="['shape-canvas', isDark ? 'shape-canvas--dark' : 'shape-canvas--light']"
    :style="canvasVars"
    @mouseleave="$emit('board-leave')"
  >
    <button
      v-for="cell in cells"
      :key="cell.key"
      type="button"
      class="shape-cell"
      :class="{ 'shape-cell--filled': cell.filled, 'shape-cell--hover': props.hoverKey === cell.key }"
      @mouseenter="$emit('cell-hover', { x: cell.x, y: cell.y })"
      @click="$emit('cell-click', { x: cell.x, y: cell.y })"
    >
      <span v-if="cell.filled" class="shape-cell-fill" :style="{ backgroundColor: props.fillColor }" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import type { GridCell } from './types';

const props = defineProps<{
  rows: number;
  cols: number;
  filledKeys: string[];
  fillColor: string;
  hoverKey?: string | null;
  cellSize?: number;
}>();

defineEmits<{
  (e: 'cell-click', cell: GridCell): void;
  (e: 'cell-hover', cell: GridCell): void;
  (e: 'board-leave'): void;
}>();

const $q = useQuasar();
const isDark = computed(() => $q.dark.isActive);

const safeRows = computed(() => Math.max(1, Math.floor(Number(props.rows) || 1)));
const safeCols = computed(() => Math.max(1, Math.floor(Number(props.cols) || 1)));
const safeCellSize = computed(() => {
  const size = Number(props.cellSize);
  if (Number.isFinite(size) && size >= 16) return Math.floor(size);
  return 28;
});

const filledSet = computed(() => new Set(props.filledKeys));

const canvasVars = computed(() => ({
  '--shape-cell-size': `${safeCellSize.value}px`,
  gridTemplateColumns: `repeat(${safeCols.value}, var(--shape-cell-size))`,
  gridTemplateRows: `repeat(${safeRows.value}, var(--shape-cell-size))`,
}));

const cells = computed(() => {
  const out: Array<{ x: number; y: number; key: string; filled: boolean }> = [];
  for (let y = 0; y < safeRows.value; y += 1) {
    for (let x = 0; x < safeCols.value; x += 1) {
      const key = `${x},${y}`;
      out.push({ x, y, key, filled: filledSet.value.has(key) });
    }
  }
  return out;
});
</script>

<style scoped>
.shape-canvas {
  --shape-border: rgba(118, 148, 139, 0.45);
  --shape-bg: rgba(232, 241, 238, 0.9);
  --shape-cell-border: rgba(123, 146, 138, 0.34);
  --shape-cell-bg: rgba(244, 250, 247, 0.92);
  --shape-hover: rgba(183, 255, 26, 0.55);
  display: grid;
  gap: 4px;
  width: max-content;
  padding: 8px;
  border: 1px solid var(--shape-border);
  border-radius: 10px;
  background: var(--shape-bg);
}

.shape-canvas--dark {
  --shape-border: rgba(187, 255, 0, 0.38);
  --shape-bg: rgba(6, 12, 11, 0.92);
  --shape-cell-border: rgba(121, 148, 140, 0.32);
  --shape-cell-bg: rgba(16, 23, 22, 0.88);
  --shape-hover: rgba(223, 255, 136, 0.62);
}

.shape-cell {
  width: var(--shape-cell-size);
  height: var(--shape-cell-size);
  border: 1px solid var(--shape-cell-border);
  border-radius: 4px;
  background: var(--shape-cell-bg);
  padding: 0;
  cursor: pointer;
  position: relative;
}

.shape-cell:hover,
.shape-cell--hover {
  border-color: var(--shape-hover);
}

.shape-cell-fill {
  position: absolute;
  inset: 2px;
  border-radius: 2px;
  opacity: 0.88;
}
</style>
