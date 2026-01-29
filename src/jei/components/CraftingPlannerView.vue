<template>
  <div class="planner">
    <q-card flat bordered class="q-pa-md">
      <div class="row items-center q-gutter-sm">
        <div class="text-subtitle2">线路选择</div>
        <q-btn dense outline icon="restart_alt" label="重新设计" @click="resetPlanner" />
        <q-btn
          dense
          outline
          icon="save"
          label="保存线路"
          :disable="!!decisions.length"
          @click="openSaveDialog"
        />
        <q-space />
        <q-badge v-if="decisions.length" color="warning">待选择：{{ decisions.length }}</q-badge>
        <q-badge v-else color="positive">已完成</q-badge>
      </div>

      <div v-if="decisions.length" class="column q-gutter-md q-mt-md">
        <div v-for="d in decisions" :key="decisionKey(d)" class="planner__decision">
          <div v-if="d.kind === 'item_recipe'" class="column q-gutter-sm">
            <div class="text-caption text-grey-8">{{ itemName(d.itemKey) }}：选择合成方式</div>
            <q-select
              dense
              filled
              emit-value
              map-options
              :options="recipeOptionsForDecision(d)"
              :model-value="selectedRecipeIdByItemKeyHash.get(d.itemKeyHash) ?? null"
              @update:model-value="(v) => setRecipeChoice(d.itemKeyHash, v as string)"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps" class="planner__recipe-option">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <div v-if="scope.opt.inputs?.length" class="planner__recipe-option-inputs">
                      <stack-view
                        v-for="(s, i) in scope.opt.inputs.slice(0, 8)"
                        :key="`${scope.opt.value}:${i}`"
                        :content="s"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        variant="slot"
                        :show-name="false"
                        :show-subtitle="false"
                      />
                      <div
                        v-if="scope.opt.inputs.length > 8"
                        class="planner__recipe-option-more text-caption text-grey-6"
                      >
                        +{{ scope.opt.inputs.length - 8 }}
                      </div>
                    </div>
                  </q-item-section>
                  <q-item-section side>
                    <div class="text-caption text-grey-6">{{ scope.opt.value }}</div>
                  </q-item-section>

                  <q-tooltip max-width="720px">
                    <q-card
                      v-if="scope.opt.recipe && scope.opt.recipeType"
                      flat
                      bordered
                      class="q-pa-sm"
                    >
                      <recipe-viewer
                        :recipe="scope.opt.recipe"
                        :recipe-type="scope.opt.recipeType"
                        :item-defs-by-key-hash="itemDefsByKeyHash"
                        @item-click="emit('item-click', $event)"
                      />
                    </q-card>
                    <div v-else class="text-caption">没有找到该配方的详情。</div>
                  </q-tooltip>
                </q-item>
              </template>
            </q-select>
            <q-card
              v-if="selectedRecipeIdByItemKeyHash.get(d.itemKeyHash)"
              flat
              bordered
              class="q-pa-md"
            >
              <recipe-viewer
                :recipe="index.recipesById.get(selectedRecipeIdByItemKeyHash.get(d.itemKeyHash)!)!"
                :recipe-type="
                  index.recipeTypesByKey.get(
                    index.recipesById.get(selectedRecipeIdByItemKeyHash.get(d.itemKeyHash)!)!.type,
                  )!
                "
                :item-defs-by-key-hash="itemDefsByKeyHash"
                @item-click="emit('item-click', $event)"
              />
            </q-card>
          </div>

          <div v-else class="column q-gutter-sm">
            <div class="row items-center q-gutter-sm">
              <div class="text-caption text-grey-8">tag {{ d.tagId }}：选择具体物品</div>
              <q-badge v-if="!d.candidateItemIds.length" color="negative">无可选</q-badge>
            </div>
            <q-select
              dense
              filled
              emit-value
              map-options
              :options="tagItemOptions(d)"
              :model-value="selectedItemIdByTagId.get(d.tagId) ?? null"
              @update:model-value="(v) => setTagChoice(d.tagId, v as string)"
            />
          </div>
        </div>
      </div>

      <div v-else class="q-mt-md">
        <q-tabs v-model="activeTab" dense outside-arrows mobile-arrows inline-label>
          <q-tab name="tree" label="合成树" />
          <q-tab name="graph" label="节点图" />
          <q-tab name="calc" label="计算器" />
        </q-tabs>
        <q-separator />

        <div v-if="activeTab === 'tree'" class="q-mt-md">
          <div class="row items-center q-gutter-sm">
            <div class="text-caption text-grey-8">目标产出</div>
            <q-input
              dense
              filled
              type="number"
              style="width: 160px"
              :model-value="targetAmount"
              @update:model-value="(v) => (targetAmount = Number(v))"
            />
          </div>
          <div v-if="treeResult" class="q-mt-md column q-gutter-xs">
            <div v-for="row in treeRows" :key="row.node.nodeId" class="planner__tree-row">
              <div class="planner__tree-indent" :style="{ width: `${row.depth * 18}px` }"></div>
              <q-btn
                v-if="row.node.kind === 'item' && row.node.children.length"
                flat
                dense
                round
                size="sm"
                :icon="collapsed.has(row.node.nodeId) ? 'chevron_right' : 'expand_more'"
                @click="toggleCollapsed(row.node.nodeId)"
              />
              <div v-else style="width: 28px"></div>
              <div class="planner__tree-content">
                <stack-view
                  v-if="row.node.kind === 'item'"
                  :content="{
                    kind: 'item',
                    id: row.node.itemKey.id,
                    amount: formatAmount(row.node.amount),
                  }"
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                  :show-subtitle="true"
                  @item-click="emit('item-click', $event)"
                />
                <q-btn
                  v-if="row.node.kind === 'item' && row.node.machineItemId"
                  flat
                  dense
                  class="q-ml-xs"
                  style="padding: 0"
                >
                  <stack-view
                    :content="{ kind: 'item', id: row.node.machineItemId, amount: 1 }"
                    :item-defs-by-key-hash="itemDefsByKeyHash"
                    variant="slot"
                    :show-name="false"
                    :show-subtitle="false"
                  />
                  <q-tooltip>{{
                    row.node.machineName ?? row.node.recipeTypeKeyUsed ?? row.node.machineItemId
                  }}</q-tooltip>
                </q-btn>
                <stack-view
                  v-else-if="row.node.kind === 'fluid'"
                  :content="
                    row.node.unit
                      ? {
                          kind: 'fluid',
                          id: row.node.id,
                          amount: formatAmount(row.node.amount),
                          unit: row.node.unit,
                        }
                      : {
                          kind: 'fluid',
                          id: row.node.id,
                          amount: formatAmount(row.node.amount),
                        }
                  "
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                  :show-subtitle="true"
                />
                <q-badge
                  v-if="row.node.kind === 'item' && row.node.cycle"
                  color="negative"
                  class="q-ml-sm"
                >
                  {{ row.node.cycleSeed ? 'cycle seed' : 'cycle' }}
                </q-badge>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'graph'" class="q-mt-md">
          <div class="row items-center q-gutter-sm">
            <div class="text-caption text-grey-8">目标产出</div>
            <q-input
              dense
              filled
              type="number"
              style="width: 160px"
              :model-value="targetAmount"
              @update:model-value="(v) => (targetAmount = Number(v))"
            />
          </div>
          <div v-if="svg" class="q-mt-md planner__svg-wrap">
            <svg :width="svg.width" :height="svg.height" viewBox="0 0 1 1" style="display: none" />
            <svg :width="svg.width" :height="svg.height" class="planner__svg">
              <defs>
                <marker
                  id="planner-arrow"
                  viewBox="0 0 10 10"
                  refX="10"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(0, 0, 0, 0.55)" />
                </marker>
              </defs>
              <g>
                <line
                  v-for="e in svg.edges"
                  :key="e.key"
                  :x1="e.x1"
                  :y1="e.y1"
                  :x2="e.x2"
                  :y2="e.y2"
                  stroke="rgba(0, 0, 0, 0.35)"
                  stroke-width="1.5"
                  marker-end="url(#planner-arrow)"
                />
              </g>
              <g>
                <g v-for="n in svg.nodes" :key="n.nodeId" class="planner__svg-node">
                  <rect
                    :x="n.x"
                    :y="n.y"
                    :width="svg.nodeW"
                    :height="svg.nodeH"
                    rx="8"
                    ry="8"
                    fill="white"
                    stroke="rgba(0, 0, 0, 0.25)"
                  />
                  <text :x="n.x + 10" :y="n.y + 18" font-size="12" fill="rgba(0, 0, 0, 0.85)">
                    {{ n.title }}
                  </text>
                  <text :x="n.x + 10" :y="n.y + 36" font-size="11" fill="rgba(0, 0, 0, 0.65)">
                    {{ n.subtitle }}
                  </text>
                  <rect
                    v-if="n.clickable"
                    :x="n.x"
                    :y="n.y"
                    :width="svg.nodeW"
                    :height="svg.nodeH"
                    rx="8"
                    ry="8"
                    fill="transparent"
                    style="cursor: pointer"
                    @click="emit('item-click', n.itemKey!)"
                  />
                </g>
              </g>
            </svg>
          </div>
        </div>

        <div v-else class="q-mt-md">
          <div class="row items-center q-gutter-sm">
            <div class="text-caption text-grey-8">目标产出</div>
            <q-input
              dense
              filled
              type="number"
              style="width: 160px"
              :model-value="targetAmount"
              @update:model-value="(v) => (targetAmount = Number(v))"
            />
          </div>
          <div v-if="treeResult" class="q-mt-md">
            <q-table
              flat
              bordered
              dense
              row-key="id"
              :rows="leafRows"
              :columns="leafColumns"
              :pagination="{ rowsPerPage: 0 }"
              hide-bottom
            />
            <div v-if="catalystRows.length" class="q-mt-md">
              <div class="text-caption text-grey-8 q-mb-sm">
                催化剂（不计入消耗，总需求取最大值）
              </div>
              <q-table
                flat
                bordered
                dense
                row-key="id"
                :rows="catalystRows"
                :columns="leafColumns"
                :pagination="{ rowsPerPage: 0 }"
                hide-bottom
              />
            </div>
          </div>
        </div>
      </div>

      <q-dialog v-model="saveDialogOpen">
        <q-card style="min-width: 420px">
          <q-card-section class="row items-center q-gutter-sm">
            <div class="text-subtitle2">保存合成线路</div>
            <q-space />
            <q-btn flat round icon="close" v-close-popup />
          </q-card-section>
          <q-card-section>
            <q-input
              dense
              filled
              label="线路名称"
              :model-value="saveName"
              @update:model-value="(v) => (saveName = String(v ?? ''))"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="取消" color="grey-7" v-close-popup />
            <q-btn
              unelevated
              label="保存"
              color="primary"
              :disable="!saveName.trim()"
              @click="confirmSave"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ItemDef, ItemId, ItemKey, PackData, Stack } from 'src/jei/types';
import type { JeiIndex } from 'src/jei/indexing/buildIndex';
import { itemKeyHash } from 'src/jei/indexing/key';
import RecipeViewer from './RecipeViewer.vue';
import StackView from './StackView.vue';
import type {
  PlannerInitialState,
  PlannerLiveState,
  PlannerSavePayload,
} from 'src/jei/planner/plannerUi';
import {
  buildRequirementTree,
  computePlannerDecisions,
  extractRecipeStacks,
  type PlannerDecision,
  type RequirementNode,
} from 'src/jei/planner/planner';

const props = defineProps<{
  pack: PackData;
  index: JeiIndex;
  rootItemKey: ItemKey;
  itemDefsByKeyHash: Record<string, ItemDef>;
  initialState?: PlannerInitialState | null;
}>();

const emit = defineEmits<{
  (e: 'item-click', itemKey: ItemKey): void;
  (e: 'save-plan', payload: PlannerSavePayload): void;
  (e: 'state-change', payload: PlannerLiveState): void;
}>();

const selectedRecipeIdByItemKeyHash = ref<Map<string, string>>(new Map());
const selectedItemIdByTagId = ref<Map<string, ItemId>>(new Map());

const activeTab = ref<'tree' | 'graph' | 'calc'>('tree');
const targetAmount = ref(1);
const collapsed = ref<Set<string>>(new Set());

function mapToRecord<V extends string>(m: Map<string, V>): Record<string, V> {
  return Object.fromEntries(m.entries()) as Record<string, V>;
}

function emitLiveState() {
  emit('state-change', {
    targetAmount: targetAmount.value,
    selectedRecipeIdByItemKeyHash: mapToRecord(selectedRecipeIdByItemKeyHash.value),
    selectedItemIdByTagId: mapToRecord(selectedItemIdByTagId.value as Map<string, ItemId>),
  });
}

function applyInitialState() {
  const st = props.initialState;
  if (st) {
    selectedRecipeIdByItemKeyHash.value = new Map(
      Object.entries(st.selectedRecipeIdByItemKeyHash ?? {}),
    );
    selectedItemIdByTagId.value = new Map(Object.entries(st.selectedItemIdByTagId ?? {}));
    targetAmount.value = Number(st.targetAmount) || 1;
    activeTab.value = 'tree';
    collapsed.value = new Set();
    emitLiveState();
    return;
  }
  selectedRecipeIdByItemKeyHash.value = new Map();
  selectedItemIdByTagId.value = new Map();
  targetAmount.value = 1;
  activeTab.value = 'tree';
  collapsed.value = new Set();
  emitLiveState();
}

watch(
  () => [itemKeyHash(props.rootItemKey), props.initialState?.loadKey ?? ''] as const,
  () => applyInitialState(),
  { immediate: true },
);

watch(targetAmount, () => emitLiveState());

const decisions = computed(() =>
  computePlannerDecisions({
    pack: props.pack,
    index: props.index,
    rootItemKey: props.rootItemKey,
    selectedRecipeIdByItemKeyHash: selectedRecipeIdByItemKeyHash.value,
    selectedItemIdByTagId: selectedItemIdByTagId.value,
  }),
);

const treeResult = computed(() => {
  if (decisions.value.length) return null;
  return buildRequirementTree({
    pack: props.pack,
    index: props.index,
    rootItemKey: props.rootItemKey,
    targetAmount: targetAmount.value,
    selectedRecipeIdByItemKeyHash: selectedRecipeIdByItemKeyHash.value,
    selectedItemIdByTagId: selectedItemIdByTagId.value,
  });
});

function decisionKey(d: PlannerDecision) {
  if (d.kind === 'item_recipe') return `item:${d.itemKeyHash}`;
  return `tag:${d.tagId}`;
}

function itemName(key: ItemKey) {
  const def = props.itemDefsByKeyHash[itemKeyHash(key)];
  return def?.name ?? key.id;
}

function recipeOptionsForDecision(d: Extract<PlannerDecision, { kind: 'item_recipe' }>) {
  return d.recipeOptions
    .map((recipeId) => {
      const r = props.index.recipesById.get(recipeId);
      const recipeType = r ? props.index.recipeTypesByKey.get(r.type) : undefined;
      const label = r ? `${recipeType?.displayName ?? r.type}` : recipeId;
      const inputs: Stack[] = r ? extractRecipeStacks(r, recipeType).inputs : [];
      return { label, value: recipeId, inputs, recipe: r, recipeType };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function tagItemOptions(d: Extract<PlannerDecision, { kind: 'tag_item' }>) {
  return d.candidateItemIds
    .map((itemId) => {
      const keyHashes = props.index.itemKeyHashesByItemId.get(itemId) ?? [];
      const keyHash = keyHashes[0];
      const def = keyHash ? props.itemDefsByKeyHash[keyHash] : undefined;
      const label = def?.name ? `${def.name} (${itemId})` : itemId;
      return { label, value: itemId };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function setRecipeChoice(itemKeyHash: string, recipeId: string) {
  const next = new Map(selectedRecipeIdByItemKeyHash.value);
  next.set(itemKeyHash, recipeId);
  selectedRecipeIdByItemKeyHash.value = next;
  emitLiveState();
}

function setTagChoice(tagId: string, itemId: ItemId) {
  const next = new Map(selectedItemIdByTagId.value);
  next.set(tagId, itemId);
  selectedItemIdByTagId.value = next;
  emitLiveState();
}

function resetPlanner() {
  selectedRecipeIdByItemKeyHash.value = new Map();
  selectedItemIdByTagId.value = new Map();
  targetAmount.value = 1;
  activeTab.value = 'tree';
  collapsed.value = new Set();
  emitLiveState();
}

const saveDialogOpen = ref(false);
const saveName = ref('');

function openSaveDialog() {
  const base = itemName(props.rootItemKey);
  saveName.value = `${base} 线路`;
  saveDialogOpen.value = true;
}

function confirmSave() {
  const payload: PlannerSavePayload = {
    name: saveName.value.trim(),
    rootItemKey: props.rootItemKey,
    targetAmount: targetAmount.value,
    selectedRecipeIdByItemKeyHash: mapToRecord(selectedRecipeIdByItemKeyHash.value),
    selectedItemIdByTagId: mapToRecord(selectedItemIdByTagId.value as Map<string, ItemId>),
  };
  emit('save-plan', payload);
  saveDialogOpen.value = false;
}

function toggleCollapsed(nodeId: string) {
  const next = new Set(collapsed.value);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  collapsed.value = next;
}

type TreeRow = { node: RequirementNode; depth: number };

const treeRows = computed<TreeRow[]>(() => {
  const result = treeResult.value;
  if (!result) return [];
  const rows: TreeRow[] = [];

  const walk = (node: RequirementNode, depth: number) => {
    rows.push({ node, depth });
    if (node.kind !== 'item') return;
    if (collapsed.value.has(node.nodeId)) return;
    node.children.forEach((c) => walk(c, depth + 1));
  };

  walk(result.root, 0);
  return rows;
});

function formatAmount(n: number) {
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n * 1000) / 1000;
  return rounded;
}

type SvgNode = {
  nodeId: string;
  x: number;
  y: number;
  title: string;
  subtitle: string;
  clickable: boolean;
  itemKey?: ItemKey;
};
type SvgEdge = { key: string; x1: number; y1: number; x2: number; y2: number };

const svg = computed<null | {
  width: number;
  height: number;
  nodeW: number;
  nodeH: number;
  nodes: SvgNode[];
  edges: SvgEdge[];
}>(() => {
  const result = treeResult.value;
  if (!result) return null;

  const levels: RequirementNode[][] = [];
  const walk = (node: RequirementNode, depth: number) => {
    const list = levels[depth] ?? [];
    list.push(node);
    levels[depth] = list;
    if (node.kind === 'item') node.children.forEach((c) => walk(c, depth + 1));
  };
  walk(result.root, 0);

  const nodeW = 170;
  const nodeH = 52;
  const gapX = 22;
  const gapY = 36;
  const pad = 16;

  const nodes: SvgNode[] = [];
  const nodePos = new Map<string, { x: number; y: number }>();
  levels.forEach((level, depth) => {
    level.forEach((node, i) => {
      const x = pad + i * (nodeW + gapX);
      const y = pad + depth * (nodeH + gapY);
      nodePos.set(node.nodeId, { x, y });
      if (node.kind === 'item') {
        nodes.push({
          nodeId: node.nodeId,
          x,
          y,
          title: itemName(node.itemKey),
          subtitle: `${formatAmount(node.amount)}${node.machineName ? ` · ${node.machineName}` : ''}`,
          clickable: true,
          itemKey: node.itemKey,
        });
      } else {
        nodes.push({
          nodeId: node.nodeId,
          x,
          y,
          title: node.id,
          subtitle: `${formatAmount(node.amount)}${node.unit ?? ''}`,
          clickable: false,
        });
      }
    });
  });

  const edges: SvgEdge[] = [];
  const walkEdges = (node: RequirementNode) => {
    if (node.kind !== 'item') return;
    const from = nodePos.get(node.nodeId);
    if (!from) return;
    node.children.forEach((c, idx) => {
      const to = nodePos.get(c.nodeId);
      if (!to) return;
      edges.push({
        key: `${node.nodeId}->${c.nodeId}:${idx}`,
        x1: from.x + nodeW / 2,
        y1: from.y + nodeH,
        x2: to.x + nodeW / 2,
        y2: to.y,
      });
      walkEdges(c);
    });
  };
  walkEdges(result.root);

  const width =
    pad * 2 +
    Math.max(1, ...levels.map((l) => l.length)) * nodeW +
    Math.max(0, Math.max(0, ...levels.map((l) => l.length - 1))) * gapX;
  const height = pad * 2 + levels.length * nodeH + Math.max(0, levels.length - 1) * gapY;
  return { width, height, nodeW, nodeH, nodes, edges };
});

const leafColumns = [
  { name: 'name', label: '物品', field: 'name', align: 'left' as const },
  { name: 'amount', label: '数量', field: 'amount', align: 'right' as const },
  { name: 'id', label: 'ID', field: 'id', align: 'left' as const },
];

type LeafRow = { id: string; name: string; amount: number };

const leafRows = computed<LeafRow[]>(() => {
  const result = treeResult.value;
  if (!result) return [];
  const rows: LeafRow[] = [];
  result.leafItemTotals.forEach((amount, itemId) => {
    const keyHashes = props.index.itemKeyHashesByItemId.get(itemId) ?? [];
    const keyHash = keyHashes[0];
    const def = keyHash ? props.itemDefsByKeyHash[keyHash] : undefined;
    rows.push({ id: itemId, name: def?.name ?? itemId, amount: formatAmount(amount) });
  });
  result.leafFluidTotals.forEach((amount, fluidId) => {
    rows.push({ id: fluidId, name: fluidId, amount: formatAmount(amount) });
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
});

const catalystRows = computed<LeafRow[]>(() => {
  const result = treeResult.value;
  if (!result) return [];
  const rows: LeafRow[] = [];
  result.catalysts.forEach((amount, itemId) => {
    const keyHashes = props.index.itemKeyHashesByItemId.get(itemId) ?? [];
    const keyHash = keyHashes[0];
    const def = keyHash ? props.itemDefsByKeyHash[keyHash] : undefined;
    rows.push({ id: itemId, name: def?.name ?? itemId, amount: formatAmount(amount) });
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
});
</script>

<style scoped>
.planner {
  width: 100%;
}

.planner__decision {
  border-left: 4px solid rgba(0, 0, 0, 0.08);
  padding-left: 10px;
}

.planner__recipe-option-inputs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 6px;
}

.planner__recipe-option-more {
  align-self: center;
}

.planner__tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.planner__tree-indent {
  flex: 0 0 auto;
}

.planner__tree-content {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
  flex: 1 1 auto;
}

.planner__svg-wrap {
  width: 100%;
  overflow: auto;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: #fff;
}

.planner__svg {
  display: block;
}
</style>
