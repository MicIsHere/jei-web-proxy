<template>
  <q-dialog :model-value="open" @update:model-value="(v) => emit('update:open', Boolean(v))">
    <q-card class="line-width-editor">
      <q-card-section class="row items-center q-pb-sm">
        <div class="text-subtitle1">{{ t('lineWidthCurveEditor') }}</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="emit('update:open', false)" />
      </q-card-section>

      <q-card-section class="q-pt-none q-gutter-sm">
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-md-4">
            <q-select
              dense
              filled
              emit-value
              map-options
              :label="t('lineWidthUnit')"
              :options="unitOptions"
              :model-value="curveConfig.unit"
              @update:model-value="updateUnit"
            />
          </div>
          <div class="col-6 col-md-4">
            <q-select
              dense
              filled
              emit-value
              map-options
              :label="t('lineWidthXAxisScale')"
              :options="axisOptions"
              :model-value="curveConfig.xScale"
              @update:model-value="updateXAxisScale"
            />
          </div>
          <div class="col-6 col-md-4">
            <q-select
              dense
              filled
              emit-value
              map-options
              :label="t('lineWidthYAxisScale')"
              :options="axisOptions"
              :model-value="curveConfig.yScale"
              @update:model-value="updateYAxisScale"
            />
          </div>
          <div class="col-4 col-md-4">
            <q-input
              dense
              filled
              type="number"
              :label="t('lineWidthMinPx')"
              :model-value="curveConfig.minWidthPx"
              @update:model-value="updateMinWidth"
            />
          </div>
          <div class="col-4 col-md-4">
            <q-input
              dense
              filled
              type="number"
              :label="t('lineWidthMaxPx')"
              :model-value="curveConfig.maxWidthPx"
              @update:model-value="updateMaxWidth"
            />
          </div>
          <div class="col-4 col-md-4">
            <q-input
              dense
              filled
              type="number"
              :label="maxRateLabel"
              :model-value="curveConfig.maxInput"
              @update:model-value="updateMaxInput"
            />
          </div>
        </div>

        <div class="text-caption text-grey-7">
          {{ t('lineWidthCurveHint') }}
        </div>

        <div ref="chartWrapRef" class="line-width-editor__chart-wrap">
          <svg
            ref="svgRef"
            :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
            class="line-width-editor__chart"
            @pointermove.prevent="onSvgPointerMove"
            @dblclick.prevent="onSvgDoubleClick"
          >
            <rect
              :x="PAD_L"
              :y="PAD_T"
              :width="PLOT_W"
              :height="PLOT_H"
              class="line-width-editor__plot-bg"
            />
            <line
              v-for="n in gridLines"
              :key="`vx-${n}`"
              :x1="PAD_L + n * PLOT_W"
              :x2="PAD_L + n * PLOT_W"
              :y1="PAD_T"
              :y2="PAD_T + PLOT_H"
              class="line-width-editor__grid-line"
            />
            <line
              v-for="n in gridLines"
              :key="`hy-${n}`"
              :x1="PAD_L"
              :x2="PAD_L + PLOT_W"
              :y1="PAD_T + n * PLOT_H"
              :y2="PAD_T + n * PLOT_H"
              class="line-width-editor__grid-line"
            />
            <line
              :x1="PAD_L"
              :x2="PAD_L"
              :y1="PAD_T"
              :y2="PAD_T + PLOT_H"
              class="line-width-editor__axis-line"
            />
            <line
              :x1="PAD_L"
              :x2="PAD_L + PLOT_W"
              :y1="PAD_T + PLOT_H"
              :y2="PAD_T + PLOT_H"
              class="line-width-editor__axis-line"
            />
            <text
              v-for="tick in xTickLabels"
              :key="`xt-${tick.norm}`"
              :x="tick.x"
              :y="PAD_T + PLOT_H + 16"
              text-anchor="middle"
              class="line-width-editor__axis-tick"
            >
              {{ tick.label }}
            </text>
            <text
              v-for="tick in yTickLabels"
              :key="`yt-${tick.norm}`"
              :x="PAD_L - 8"
              :y="tick.y + 4"
              text-anchor="end"
              class="line-width-editor__axis-tick"
            >
              {{ tick.label }}
            </text>
            <text
              :x="PAD_L + PLOT_W / 2"
              :y="SVG_H - 6"
              text-anchor="middle"
              class="line-width-editor__axis-title"
            >
              {{ xAxisLabel }}
            </text>
            <text
              :x="14"
              :y="PAD_T + PLOT_H / 2"
              :transform="`rotate(-90 14 ${PAD_T + PLOT_H / 2})`"
              text-anchor="middle"
              class="line-width-editor__axis-title"
            >
              {{ yAxisLabel }}
            </text>
            <polyline
              :points="curvePolylinePoints"
              class="line-width-editor__curve"
            />
            <g v-for="(p, idx) in controlScreenPoints" :key="`cp-${idx}`">
              <circle
                :cx="p.x"
                :cy="p.y"
                r="11"
                class="line-width-editor__point-hit"
                @pointerdown.stop.prevent="onPointPointerDown(idx, $event)"
              />
              <circle
                :cx="p.x"
                :cy="p.y"
                r="7"
                :class="[
                  'line-width-editor__point',
                  { 'line-width-editor__point--active': selectedPointIndex === idx },
                ]"
                @pointerdown.stop.prevent="onPointPointerDown(idx, $event)"
              />
            </g>
          </svg>
        </div>

        <div class="row items-center q-mt-sm">
          <div class="text-caption text-grey-8">
            0 {{ unitSuffix }} -> {{ formatNum(curveConfig.minWidthPx) }}px
            |
            {{ formatNum(curveConfig.maxInput) }} {{ unitSuffix }} -> {{ formatNum(curveConfig.maxWidthPx) }}px
          </div>
          <q-space />
          <q-btn
            flat
            dense
            no-caps
            icon="remove_circle_outline"
            :disable="!canDeleteSelectedPoint"
            @click="deleteSelectedPoint"
          >
            {{ t('lineWidthDeletePoint') }}
          </q-btn>
          <q-btn flat dense no-caps icon="restart_alt" @click="resetCurve">
            {{ t('lineWidthResetCurve') }}
          </q-btn>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  createDefaultLineWidthCurveConfig,
  denormalizeAxis,
  evaluateLineWidthCurve,
  normalizeAxis,
  sanitizeLineWidthCurveConfig,
  type LineWidthCurveConfig,
} from 'src/jei/planner/lineWidthCurve';

const props = defineProps<{
  open: boolean;
  modelValue: LineWidthCurveConfig;
}>();

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'update:modelValue', v: LineWidthCurveConfig): void;
}>();

const { t } = useI18n();

const chartWrapRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const selectedPointIndex = ref(2);
const draggingIndex = ref<number | null>(null);
const dragDirty = ref(false);
let chartResizeObserver: ResizeObserver | null = null;

const chartSize = ref({ w: 420, h: 260 });
const SVG_W = computed(() => chartSize.value.w);
const SVG_H = computed(() => chartSize.value.h);
const PAD_L = 56;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 40;
const PLOT_W = computed(() => Math.max(1, SVG_W.value - PAD_L - PAD_R));
const PLOT_H = computed(() => Math.max(1, SVG_H.value - PAD_T - PAD_B));
const gridLines = [0, 0.25, 0.5, 0.75, 1] as const;
const localConfig = ref<LineWidthCurveConfig>(sanitizeLineWidthCurveConfig(props.modelValue));
const curveConfig = computed(() => localConfig.value);

const unitOptions = computed(
  () =>
    [
      { label: t('lineWidthUnitPerMinute'), value: 'per_minute' },
      { label: t('lineWidthUnitPerSecond'), value: 'per_second' },
      { label: t('lineWidthUnitPerHour'), value: 'per_hour' },
      { label: t('lineWidthUnitBelts'), value: 'belts' },
    ] as const,
);

const axisOptions = computed(
  () =>
    [
      { label: t('lineWidthAxisLinear'), value: 'linear' },
      { label: t('lineWidthAxisLog'), value: 'log' },
    ] as const,
);

const unitSuffix = computed(() => {
  if (curveConfig.value.unit === 'per_second') return '/s';
  if (curveConfig.value.unit === 'per_hour') return '/h';
  if (curveConfig.value.unit === 'belts') return 'belts';
  return '/min';
});

const maxRateLabel = computed(() => `${t('lineWidthMaxRate')} (${unitSuffix.value})`);
const xAxisLabel = computed(() => `${t('lineWidthAxisRate')} (${unitSuffix.value})`);
const yAxisLabel = computed(() => t('lineWidthAxisWidthPx'));

function formatNum(v: number): string {
  const rounded = Math.round(v * 1000) / 1000;
  return Number.isFinite(rounded) ? String(rounded) : '0';
}

function formatTick(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const abs = Math.abs(v);
  if (abs >= 100) return String(Math.round(v));
  if (abs >= 10) return (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');
  if (abs >= 1) return (Math.round(v * 100) / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return (Math.round(v * 1000) / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function refreshChartSize() {
  const el = chartWrapRef.value;
  if (!el) return;
  const nextW = Math.max(320, Math.floor(el.clientWidth));
  const nextH = 260;
  if (nextW === chartSize.value.w && nextH === chartSize.value.h) return;
  chartSize.value = { w: nextW, h: nextH };
}

function setCurveConfig(next: LineWidthCurveConfig, commit = true) {
  const sanitized = sanitizeLineWidthCurveConfig(next);
  localConfig.value = sanitized;
  if (commit) emit('update:modelValue', sanitized);
}

function mapXToScreen(x: number): number {
  const n = normalizeAxis(x, 0, curveConfig.value.maxInput, curveConfig.value.xScale);
  return PAD_L + n * PLOT_W.value;
}

function mapYToScreen(y: number): number {
  const n = normalizeAxis(
    y,
    curveConfig.value.minWidthPx,
    curveConfig.value.maxWidthPx,
    curveConfig.value.yScale,
  );
  return PAD_T + (1 - n) * PLOT_H.value;
}

function mapScreenToX(px: number): number {
  const n = Math.max(0, Math.min(1, (px - PAD_L) / PLOT_W.value));
  return denormalizeAxis(n, 0, curveConfig.value.maxInput, curveConfig.value.xScale);
}

function mapScreenToY(py: number): number {
  const n = Math.max(0, Math.min(1, 1 - (py - PAD_T) / PLOT_H.value));
  return denormalizeAxis(
    n,
    curveConfig.value.minWidthPx,
    curveConfig.value.maxWidthPx,
    curveConfig.value.yScale,
  );
}

function clientToSvgPoint(clientX: number, clientY: number): { x: number; y: number } | null {
  const svg = svgRef.value;
  if (!svg) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

const controlScreenPoints = computed(() =>
  curveConfig.value.points.map((p) => ({
    x: mapXToScreen(p.x),
    y: mapYToScreen(p.y),
  })),
);

const curvePolylinePoints = computed(() => {
  const cfg = curveConfig.value;
  const samples = 96;
  const points: string[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const x = (cfg.maxInput * i) / samples;
    const y = evaluateLineWidthCurve(x, cfg);
    points.push(`${mapXToScreen(x)},${mapYToScreen(y)}`);
  }
  return points.join(' ');
});

const xTickLabels = computed(() =>
  gridLines.map((norm) => {
    const value = denormalizeAxis(norm, 0, curveConfig.value.maxInput, curveConfig.value.xScale);
    return {
      norm,
      x: PAD_L + norm * PLOT_W.value,
      label: formatTick(value),
    };
  }),
);

const yTickLabels = computed(() =>
  gridLines.map((norm) => {
    const value = denormalizeAxis(
      1 - norm,
      curveConfig.value.minWidthPx,
      curveConfig.value.maxWidthPx,
      curveConfig.value.yScale,
    );
    return {
      norm,
      y: PAD_T + norm * PLOT_H.value,
      label: `${formatTick(value)}px`,
    };
  }),
);

const canDeleteSelectedPoint = computed(() => {
  const idx = selectedPointIndex.value;
  const len = curveConfig.value.points.length;
  return idx > 0 && idx < len - 1 && len > 2;
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    localConfig.value = sanitizeLineWidthCurveConfig(props.modelValue);
    refreshChartSize();
  },
  { immediate: true },
);

watch(
  () => props.modelValue,
  (next) => {
    if (draggingIndex.value !== null) return;
    localConfig.value = sanitizeLineWidthCurveConfig(next);
  },
  { deep: true },
);

function updateUnit(v: string | null) {
  if (v !== 'per_minute' && v !== 'per_second' && v !== 'per_hour' && v !== 'belts') return;
  setCurveConfig({ ...curveConfig.value, unit: v });
}

function updateXAxisScale(v: string | null) {
  if (v !== 'linear' && v !== 'log') return;
  setCurveConfig({ ...curveConfig.value, xScale: v });
}

function updateYAxisScale(v: string | null) {
  if (v !== 'linear' && v !== 'log') return;
  setCurveConfig({ ...curveConfig.value, yScale: v });
}

function updateMinWidth(v: string | number | null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return;
  setCurveConfig({ ...curveConfig.value, minWidthPx: n });
}

function updateMaxWidth(v: string | number | null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return;
  setCurveConfig({ ...curveConfig.value, maxWidthPx: n });
}

function updateMaxInput(v: string | number | null) {
  const nextMax = Number(v);
  if (!Number.isFinite(nextMax) || nextMax <= 0) return;
  const cfg = curveConfig.value;
  const oldMax = Math.max(1e-9, cfg.maxInput);
  const points = cfg.points.map((p, idx, arr) => {
    if (idx === 0) return { x: 0, y: p.y };
    if (idx === arr.length - 1) return { x: nextMax, y: p.y };
    return { x: (p.x / oldMax) * nextMax, y: p.y };
  });
  setCurveConfig({ ...cfg, maxInput: nextMax, points });
}

function resetCurve() {
  const def = createDefaultLineWidthCurveConfig();
  setCurveConfig({
    ...curveConfig.value,
    unit: def.unit,
    xScale: def.xScale,
    yScale: def.yScale,
    minWidthPx: def.minWidthPx,
    maxWidthPx: def.maxWidthPx,
    maxInput: def.maxInput,
    points: def.points,
  });
}

function deleteSelectedPoint() {
  if (!canDeleteSelectedPoint.value) return;
  const idx = selectedPointIndex.value;
  const cfg = curveConfig.value;
  const points = cfg.points.filter((_, i) => i !== idx);
  selectedPointIndex.value = Math.max(0, idx - 1);
  setCurveConfig({ ...cfg, points });
}

function onPointPointerDown(idx: number, evt: PointerEvent) {
  selectedPointIndex.value = idx;
  draggingIndex.value = idx;
  dragDirty.value = false;
  (evt.target as Element | null)?.setPointerCapture?.(evt.pointerId);
  window.addEventListener('pointermove', onWindowPointerMove, { passive: false });
  window.addEventListener('pointerup', onWindowPointerUp, { once: true });
}

function onWindowPointerMove(evt: PointerEvent) {
  if (draggingIndex.value === null) return;
  evt.preventDefault();
  movePointFromPointer(draggingIndex.value, evt.clientX, evt.clientY);
}

function onWindowPointerUp() {
  if (dragDirty.value) {
    emit('update:modelValue', sanitizeLineWidthCurveConfig(localConfig.value));
    dragDirty.value = false;
  }
  draggingIndex.value = null;
  window.removeEventListener('pointermove', onWindowPointerMove);
}

function onSvgPointerMove(evt: PointerEvent) {
  if (draggingIndex.value === null) return;
  movePointFromPointer(draggingIndex.value, evt.clientX, evt.clientY);
}

function onSvgDoubleClick(evt: MouseEvent) {
  if (draggingIndex.value !== null) return;
  const cfg = curveConfig.value;
  const pt = clientToSvgPoint(evt.clientX, evt.clientY);
  if (!pt) return;
  const px = Math.max(PAD_L, Math.min(PAD_L + PLOT_W.value, pt.x));
  const py = Math.max(PAD_T, Math.min(PAD_T + PLOT_H.value, pt.y));
  const x = mapScreenToX(px);
  const y = mapScreenToY(py);

  let insertIdx = cfg.points.findIndex((p) => p.x > x);
  if (insertIdx <= 0) insertIdx = cfg.points.length - 1;
  if (insertIdx >= cfg.points.length) insertIdx = cfg.points.length - 1;

  const points = cfg.points.map((p) => ({ ...p }));
  points.splice(insertIdx, 0, { x, y });
  selectedPointIndex.value = insertIdx;
  setCurveConfig({ ...cfg, points });
}

function movePointFromPointer(idx: number, clientX: number, clientY: number) {
  const cfg = curveConfig.value;
  const pt = clientToSvgPoint(clientX, clientY);
  if (!pt) return;
  const px = Math.max(PAD_L, Math.min(PAD_L + PLOT_W.value, pt.x));
  const py = Math.max(PAD_T, Math.min(PAD_T + PLOT_H.value, pt.y));

  let x = mapScreenToX(px);
  const y = mapScreenToY(py);
  const points = cfg.points.map((p) => ({ ...p }));
  const minGap = Math.max(cfg.maxInput * 0.002, 1e-6);

  if (idx === 0) {
    x = 0;
  } else if (idx === points.length - 1) {
    x = cfg.maxInput;
  } else {
    const left = (points[idx - 1]?.x ?? 0) + minGap;
    const right = (points[idx + 1]?.x ?? cfg.maxInput) - minGap;
    x = Math.max(left, Math.min(right, x));
  }

  points[idx] = { x, y };
  dragDirty.value = true;
  setCurveConfig({ ...cfg, points }, false);
}

onMounted(() => {
  refreshChartSize();
  if (chartWrapRef.value) {
    chartResizeObserver = new ResizeObserver(() => refreshChartSize());
    chartResizeObserver.observe(chartWrapRef.value);
  }
});

onUnmounted(() => {
  window.removeEventListener('pointermove', onWindowPointerMove);
  chartResizeObserver?.disconnect();
  chartResizeObserver = null;
});
</script>

<style scoped>
.line-width-editor {
  width: min(920px, 96vw);
  max-width: 96vw;
  --lw-editor-chart-bg-1: rgba(0, 0, 0, 0.02);
  --lw-editor-chart-bg-2: rgba(0, 0, 0, 0.01);
  --lw-editor-plot-bg: rgba(0, 0, 0, 0.02);
  --lw-editor-grid: rgba(0, 0, 0, 0.12);
  --lw-editor-axis: rgba(0, 0, 0, 0.28);
  --lw-editor-axis-text: rgba(0, 0, 0, 0.7);
  --lw-editor-border: rgba(0, 0, 0, 0.14);
}

:global(body.body--dark) .line-width-editor {
  --lw-editor-chart-bg-1: rgba(255, 255, 255, 0.03);
  --lw-editor-chart-bg-2: rgba(255, 255, 255, 0.015);
  --lw-editor-plot-bg: rgba(255, 255, 255, 0.02);
  --lw-editor-grid: rgba(255, 255, 255, 0.08);
  --lw-editor-axis: rgba(255, 255, 255, 0.2);
  --lw-editor-axis-text: rgba(255, 255, 255, 0.72);
  --lw-editor-border: rgba(255, 255, 255, 0.16);
}

.line-width-editor__chart-wrap {
  border: 1px solid var(--lw-editor-border);
  border-radius: 8px;
  overflow: hidden;
}

.line-width-editor__chart {
  width: 100%;
  height: 260px;
  touch-action: none;
  background: linear-gradient(180deg, var(--lw-editor-chart-bg-1), var(--lw-editor-chart-bg-2));
}

.line-width-editor__plot-bg {
  fill: var(--lw-editor-plot-bg);
}

.line-width-editor__grid-line {
  stroke: var(--lw-editor-grid);
  stroke-width: 1;
}

.line-width-editor__axis-line {
  stroke: var(--lw-editor-axis);
  stroke-width: 1;
}

.line-width-editor__axis-title {
  fill: var(--lw-editor-axis-text);
  font-size: 12px;
}

.line-width-editor__axis-tick {
  fill: var(--lw-editor-axis-text);
  font-size: 11px;
}

.line-width-editor__curve {
  fill: none;
  stroke: var(--q-primary);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.line-width-editor__point-hit {
  fill: transparent;
  cursor: grab;
}

.line-width-editor__point {
  fill: #fff;
  stroke: var(--q-primary);
  stroke-width: 2;
  cursor: grab;
}

.line-width-editor__point--active {
  fill: var(--q-primary);
}
</style>
