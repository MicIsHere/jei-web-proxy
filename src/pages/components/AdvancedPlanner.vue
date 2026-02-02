<template>
  <div class="advanced-planner column no-wrap">
    <!-- 目标产物管理区 -->
    <q-card flat bordered class="q-pa-md">
      <div class="row items-center q-gutter-sm q-mb-md">
        <div class="text-subtitle2">目标产物</div>
        <q-space />
        <q-btn
          dense
          outline
          icon="delete_sweep"
          label="清空"
          :disable="targets.length === 0"
          @click="clearTargets"
        />
      </div>

      <!-- 目标列表 -->
      <q-list v-if="targets.length" bordered separator class="rounded-borders">
        <q-item v-for="(target, index) in targets" :key="index" class="q-pa-sm">
          <q-item-section avatar class="q-pr-sm">
            <stack-view
              v-if="target.itemKey && itemDefsByKeyHash"
              :content="{
                kind: 'item',
                id: target.itemKey.id,
                amount: target.rate,
                ...(target.itemKey.meta !== undefined ? { meta: target.itemKey.meta } : {}),
                ...(target.itemKey.nbt !== undefined ? { nbt: target.itemKey.nbt } : {}),
              }"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ target.itemName }}</q-item-label>
            <q-item-label caption>
              <div class="row items-center q-gutter-sm">
                <span>生产速度:</span>
                <q-input
                  dense
                  filled
                  type="number"
                  style="width: 100px"
                  :model-value="target.rate"
                  @update:model-value="(v) => updateTargetRate(index, Number(v))"
                />
                <q-select
                  dense
                  filled
                  emit-value
                  map-options
                  style="width: 120px"
                  :options="rateUnitOptions"
                  :model-value="target.unit"
                  @update:model-value="(v) => updateTargetUnit(index, v)"
                />
              </div>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              round
              dense
              icon="close"
              size="sm"
              color="negative"
              @click="removeTarget(index)"
            >
              <q-tooltip>移除此目标</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>

      <div v-else class="text-center q-pa-md text-grey">
        <q-icon name="info" size="md" class="q-mb-sm" />
        <div class="text-caption">暂无目标产物</div>
        <div class="text-caption">使用上下文菜单或快捷键 D 添加物品</div>
      </div>

      <!-- 操作按钮 -->
      <div v-if="targets.length" class="q-mt-md row q-gutter-sm">
        <q-btn
          color="primary"
          icon="calculate"
          label="开始规划"
          :disable="targets.length === 0"
          @click="startPlanning"
        />
        <q-btn
          outline
          color="primary"
          icon="auto_awesome"
          label="自动优化"
          :disable="targets.length === 0"
          @click="autoOptimize"
        >
          <q-tooltip>自动选择最优配方组合</q-tooltip>
        </q-btn>
      </div>
    </q-card>

    <!-- 决策区域 -->
    <q-card v-if="pendingDecisions.length" flat bordered class="q-pa-md q-mt-md">
      <div class="row items-center q-gutter-sm q-mb-md">
        <div class="text-subtitle2">配方选择</div>
        <q-space />
        <q-badge color="warning">待选择：{{ pendingDecisions.length }}</q-badge>
      </div>

      <div class="column q-gutter-md">
        <div v-for="d in pendingDecisions" :key="decisionKey(d)" class="decision-card">
          <!-- 配方选择 -->
          <q-card v-if="d.kind === 'item_recipe'" flat bordered class="q-pa-md">
            <div class="text-caption text-weight-medium q-mb-sm">
              {{ itemName(d.itemKey) }} - 选择合成方式
            </div>
            <q-select
              dense
              filled
              emit-value
              map-options
              :options="recipeOptionsForDecision(d)"
              :model-value="getSelectedRecipe(d.itemKeyHash)"
              @update:model-value="(v) => setRecipeChoice(d.itemKeyHash, v as string)"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </q-card>

          <!-- 标签物品选择 -->
          <q-card v-else-if="d.kind === 'tag_item'" flat bordered class="q-pa-md">
            <div class="text-caption text-weight-medium q-mb-sm">
              标签 {{ d.tagId }} - 选择具体物品
            </div>
            <q-select
              dense
              filled
              emit-value
              map-options
              :options="tagItemOptions(d)"
              :model-value="getSelectedTag(d.tagId)"
              @update:model-value="(v) => setTagChoice(d.tagId, v as string)"
            />
          </q-card>
        </div>
      </div>
    </q-card>

    <!-- 结果展示区 -->
    <q-card
      v-if="planningComplete && mergedTree"
      flat
      bordered
      class="col q-pa-md q-mt-md advanced-planner__results"
    >
      <div class="row items-center q-mb-md">
        <div class="text-subtitle2">多目标生产规划</div>
        <q-space />
        <q-chip dense color="primary" text-color="white"> {{ targets.length }} 个目标 </q-chip>
      </div>

      <!-- 目标概览 -->
      <q-list dense bordered class="rounded-borders q-mb-md">
        <q-item v-for="(target, idx) in targets" :key="idx">
          <q-item-section avatar>
            <stack-view
              v-if="target.itemKey && itemDefsByKeyHash"
              :content="{
                kind: 'item',
                id: target.itemKey.id,
                amount: target.rate,
                ...(target.itemKey.meta !== undefined ? { meta: target.itemKey.meta } : {}),
                ...(target.itemKey.nbt !== undefined ? { nbt: target.itemKey.nbt } : {}),
              }"
              :item-defs-by-key-hash="itemDefsByKeyHash"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ target.itemName }}</q-item-label>
            <q-item-label caption
              >{{ target.rate }} {{ getRateUnitLabel(target.unit) }}</q-item-label
            >
          </q-item-section>
        </q-item>
      </q-list>

      <q-tabs v-model="activeTab" dense outside-arrows mobile-arrows inline-label>
        <q-tab name="summary" label="资源汇总" />
        <q-tab name="tree" label="合成树" />
        <q-tab name="graph" label="节点图" />
        <q-tab name="line" label="生产线" />
        <q-tab name="calc" label="计算器" />
      </q-tabs>
      <q-separator class="q-my-md" />

      <q-tab-panels v-model="activeTab" animated keep-alive class="advanced-planner-panels">
        <!-- 资源汇总视图 - 显示融合后的总需求 -->
        <q-tab-panel name="summary" class="q-pa-none">
          <div class="column q-gutter-md">
            <q-card flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">原材料需求 ({{ rawItemTotals.size }} 种)</div>
              <q-list dense bordered separator class="rounded-borders">
                <q-item v-for="[itemId, amount] in rawItemEntries" :key="itemId">
                  <q-item-section avatar>
                    <stack-view
                      :content="{ kind: 'item', id: itemId, amount }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ getItemName(itemId) }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label caption>{{ amount.toFixed(2) }} / 分钟</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>

            <q-card v-if="rawFluidEntries.length" flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">
                原材料流体需求 ({{ rawFluidTotals.size }} 种)
              </div>
              <q-list dense bordered separator class="rounded-borders">
                <q-item v-for="[fluidId, amount] in rawFluidEntries" :key="fluidId">
                  <q-item-section avatar>
                    <stack-view
                      :content="{ kind: 'fluid', id: fluidId, amount }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ fluidId }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label caption>{{ amount.toFixed(2) }} / 分钟</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>

            <q-card v-if="mergedTree.catalysts.size > 0" flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">
                催化剂需求 ({{ mergedTree.catalysts.size }} 种)
              </div>
              <q-list dense bordered separator class="rounded-borders">
                <q-item
                  v-for="[itemId, amount] in Array.from(mergedTree.catalysts.entries())"
                  :key="itemId"
                >
                  <q-item-section avatar>
                    <stack-view
                      :content="{ kind: 'item', id: itemId, amount }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ getItemName(itemId) }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label caption>{{ amount }} 个</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>

            <q-card v-if="cycleSeedEntries.length" flat bordered class="q-pa-md">
              <div class="text-subtitle2 q-mb-md">
                循环种子分析 ({{ cycleSeedEntries.length }} 种)
              </div>
              <q-list dense bordered separator class="rounded-borders">
                <q-item v-for="seed in cycleSeedEntries" :key="seed.nodeId">
                  <q-item-section avatar>
                    <stack-view
                      :content="{ kind: 'item', id: seed.itemKey.id, amount: seed.seedAmount }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ itemName(seed.itemKey) }}</q-item-label>
                    <q-item-label caption>
                      需要 {{ formatAmount(seed.amountNeeded) }} / 分钟
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label caption> 种子 {{ formatAmount(seed.seedAmount) }} </q-item-label>
                    <q-item-label caption v-if="seed.cycleFactor">
                      增长倍率 {{ formatAmount(seed.cycleFactor) }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </div>
        </q-tab-panel>

        <!-- 合成树视图 - 显示层级结构 -->
        <q-tab-panel name="tree" class="q-pa-none">
          <div class="column q-gutter-md">
            <div class="row items-center q-gutter-sm">
              <div class="text-caption text-grey-8">显示单位</div>
              <q-select
                dense
                filled
                emit-value
                map-options
                style="min-width: 120px"
                :options="rateUnitOptions"
                :model-value="treeDisplayUnit"
                @update:model-value="(v) => (treeDisplayUnit = v)"
              />
              <q-space />
              <q-btn-toggle
                v-model="treeDisplayMode"
                dense
                outline
                toggle-color="primary"
                :options="[
                  { label: '列表', value: 'list' },
                  { label: '紧凑', value: 'compact' },
                ]"
              />
            </div>

            <div v-if="mergedTree" class="q-mt-md">
              <div v-if="treeDisplayMode === 'list'" class="planner__tree-table">
                <div class="planner__tree-table-header">
                  <div class="planner__tree-col planner__tree-col--tree">树结构</div>
                  <div class="planner__tree-col planner__tree-col--rate text-right">
                    {{ rateColumnLabel }}
                  </div>
                  <div class="planner__tree-col planner__tree-col--belts text-right">传送带</div>
                  <div class="planner__tree-col planner__tree-col--machines text-right">设备</div>
                  <div class="planner__tree-col planner__tree-col--power text-right">电量</div>
                </div>
                <div
                  v-for="row in treeListRows"
                  :key="row.node.nodeId"
                  class="planner__tree-table-row"
                >
                  <div class="planner__tree-col planner__tree-col--tree">
                    <div class="planner__links">
                      <template v-if="row.connect.length">
                        <div
                          v-for="(trail, i) in row.connect"
                          :key="i"
                          class="planner__connect"
                          :class="{
                            'planner__connect--trail': trail,
                            'planner__connect--last': i === row.connect.length - 1,
                          }"
                        ></div>
                      </template>
                      <div class="planner__tree-toggle">
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
                      </div>
                      <div class="planner__tree-icon">
                        <stack-view
                          v-if="row.node.kind === 'item'"
                          :content="{ kind: 'item', id: row.node.itemKey.id, amount: 1 }"
                          :item-defs-by-key-hash="itemDefsByKeyHash"
                          variant="slot"
                          :show-name="false"
                          :show-subtitle="false"
                        />
                        <stack-view
                          v-else
                          :content="
                            row.node.unit
                              ? { kind: 'fluid', id: row.node.id, amount: 1, unit: row.node.unit }
                              : { kind: 'fluid', id: row.node.id, amount: 1 }
                          "
                          :item-defs-by-key-hash="itemDefsByKeyHash"
                          variant="slot"
                          :show-name="false"
                          :show-subtitle="false"
                        />
                      </div>
                      <div class="planner__tree-name">
                        <div class="planner__tree-name-main">
                          {{ row.node.kind === 'item' ? itemName(row.node.itemKey) : row.node.id }}
                        </div>
                        <div class="planner__tree-name-sub text-caption text-grey-7">
                          {{ formatAmount(nodeDisplayAmount(row.node)) }}
                        </div>
                      </div>
                      <q-badge
                        v-if="row.node.kind === 'item' && row.node.cycle"
                        :color="row.node.cycleSeed ? 'positive' : 'negative'"
                        class="q-ml-sm"
                      >
                        {{ row.node.cycleSeed ? 'cycle seed' : 'cycle' }}
                      </q-badge>
                    </div>
                  </div>
                  <div class="planner__tree-col planner__tree-col--rate text-right monospace">
                    {{ formatAmount(nodeDisplayRate(row.node)) }}
                  </div>
                  <div class="planner__tree-col planner__tree-col--belts text-right monospace">
                    {{ nodeBeltsText(row.node) }}
                  </div>
                  <div class="planner__tree-col planner__tree-col--machines text-right">
                    <div class="planner__machines-cell">
                      <template v-if="row.node.kind === 'item' && row.node.machineItemId">
                        <stack-view
                          :content="{ kind: 'item', id: row.node.machineItemId, amount: 1 }"
                          :item-defs-by-key-hash="itemDefsByKeyHash"
                          variant="slot"
                          :show-name="false"
                          :show-subtitle="false"
                        />
                        <div class="planner__machines-text monospace">
                          {{ nodeMachinesText(row.node) }}
                        </div>
                      </template>
                    </div>
                  </div>
                  <div class="planner__tree-col planner__tree-col--power text-right monospace">
                    {{ nodePowerText(row.node) }}
                  </div>
                </div>
              </div>
              <div v-else class="column q-gutter-xs">
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
                        amount: nodeDisplayRate(row.node),
                      }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                    />
                    <stack-view
                      v-else
                      :content="
                        row.node.unit
                          ? {
                              kind: 'fluid',
                              id: row.node.id,
                              amount: nodeDisplayRate(row.node),
                              unit: row.node.unit,
                            }
                          : { kind: 'fluid', id: row.node.id, amount: nodeDisplayRate(row.node) }
                      "
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-tab-panel>

        <!-- 节点图视图 -->
        <q-tab-panel name="graph" class="q-pa-none">
          <div class="column items-center justify-center q-pa-xl">
            <q-icon name="account_tree" size="64px" color="grey-5" class="q-mb-md" />
            <div class="text-h6 text-grey-6">节点图视图</div>
            <div class="text-caption text-grey-5 q-mt-sm">正在开发中...</div>
          </div>
        </q-tab-panel>

        <!-- 生产线视图 -->
        <q-tab-panel name="line" class="q-pa-none">
          <div class="column items-center justify-center q-pa-xl">
            <q-icon name="view_timeline" size="64px" color="grey-5" class="q-mb-md" />
            <div class="text-h6 text-grey-6">生产线视图</div>
            <div class="text-caption text-grey-5 q-mt-sm">正在开发中...</div>
          </div>
        </q-tab-panel>

        <!-- 计算器视图 -->
        <q-tab-panel name="calc" class="q-pa-none">
          <div class="column items-center justify-center q-pa-xl">
            <q-icon name="calculate" size="64px" color="grey-5" class="q-mb-md" />
            <div class="text-h6 text-grey-6">计算器视图</div>
            <div class="text-caption text-grey-5 q-mt-sm">正在开发中...</div>
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>

    <div v-else-if="!targets.length" class="col column items-center justify-center text-grey">
      <q-icon name="lightbulb" size="64px" class="q-mb-md" />
      <div class="text-h6">高级计划器</div>
      <div class="text-caption q-mt-sm">添加目标产物开始规划</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ItemKey, ItemDef, ItemId, PackData, Stack } from 'src/jei/types';
import type { JeiIndex } from 'src/jei/indexing/buildIndex';
import { itemKeyHash } from 'src/jei/indexing/key';
import { DEFAULT_BELT_SPEED } from 'src/jei/planner/units';
import {
  type PlannerDecision,
  type RequirementNode,
  type BuildTreeResult,
  autoPlanSelections,
  computePlannerDecisions,
  extractRecipeStacks,
  buildRequirementTree,
} from 'src/jei/planner/planner';
import StackView from 'src/jei/components/StackView.vue';

interface Target {
  itemKey: ItemKey;
  itemName: string;
  rate: number;
  unit: 'per_second' | 'per_minute' | 'per_hour';
}

interface Props {
  pack?: PackData | null;
  index?: JeiIndex | null;
  itemDefsByKeyHash?: Record<string, ItemDef>;
}

const props = withDefaults(defineProps<Props>(), {
  pack: null,
  index: null,
  itemDefsByKeyHash: () => ({}),
});

const targets = ref<Target[]>([]);
const activeTab = ref<'summary' | 'tree' | 'graph' | 'line' | 'calc'>('summary');
const allDecisions = ref<PlannerDecision[]>([]);
const selectedRecipeIdByItemKeyHash = ref<Map<string, string>>(new Map());
const selectedItemIdByTagId = ref<Map<string, ItemId>>(new Map());
const planningStarted = ref(false);
const mergedTree = ref<BuildTreeResult | null>(null);
const mergedRootItemKey = ref<ItemKey | null>(null);

const rateUnitOptions = [
  { label: '每秒', value: 'per_second' },
  { label: '每分钟', value: 'per_minute' },
  { label: '每小时', value: 'per_hour' },
];

const treeDisplayMode = ref<'list' | 'compact'>('list');
const treeDisplayUnit = ref<'per_second' | 'per_minute' | 'per_hour'>('per_minute');
const collapsed = ref<Set<string>>(new Set());

const pendingDecisions = computed(() => {
  return allDecisions.value.filter((d: PlannerDecision) => {
    if (d.kind === 'item_recipe') {
      return !selectedRecipeIdByItemKeyHash.value.has(d.itemKeyHash);
    } else {
      return !selectedItemIdByTagId.value.has(d.tagId);
    }
  });
});

const rawItemTotals = computed(() => {
  const totals = new Map<ItemId, number>();
  if (!mergedTree.value) return totals;

  const walk = (node: RequirementNode) => {
    if (node.kind === 'fluid') return;
    if (node.kind === 'item') {
      const isLeaf = node.children.length === 0;
      if (isLeaf && !node.cycleSeed) {
        const prev = totals.get(node.itemKey.id) ?? 0;
        totals.set(node.itemKey.id, prev + (node.amount ?? 0));
      }
      node.children.forEach(walk);
    }
  };

  walk(mergedTree.value.root);
  return totals;
});

const rawFluidTotals = computed(() => {
  const totals = new Map<string, number>();
  if (!mergedTree.value) return totals;

  const walk = (node: RequirementNode) => {
    if (node.kind === 'fluid') {
      const prev = totals.get(node.id) ?? 0;
      totals.set(node.id, prev + (node.amount ?? 0));
      return;
    }
    if (node.kind === 'item') node.children.forEach(walk);
  };

  walk(mergedTree.value.root);
  return totals;
});

const rawItemEntries = computed(() => {
  return Array.from(rawItemTotals.value.entries()).sort((a, b) => b[1] - a[1]);
});

const rawFluidEntries = computed(() => {
  return Array.from(rawFluidTotals.value.entries()).sort((a, b) => b[1] - a[1]);
});

type CycleSeedInfo = {
  nodeId: string;
  itemKey: ItemKey;
  amountNeeded: number;
  seedAmount: number;
  cycleFactor?: number;
};

const cycleSeedEntries = computed<CycleSeedInfo[]>(() => {
  if (!mergedTree.value) return [];
  const seedsByKey = new Map<string, CycleSeedInfo>();

  const walk = (node: RequirementNode) => {
    if (node.kind === 'item') {
      if (node.cycleSeed) {
        const key = itemKeyHash(node.itemKey);
        const amountNeeded = node.cycleAmountNeeded ?? node.amount ?? 0;
        const seedAmount = node.cycleSeedAmount ?? node.amount ?? 0;
        const prev = seedsByKey.get(key);
        if (prev) {
          prev.amountNeeded += amountNeeded;
          prev.seedAmount += seedAmount;
          if (node.cycleFactor && (!prev.cycleFactor || node.cycleFactor > prev.cycleFactor)) {
            prev.cycleFactor = node.cycleFactor;
          }
        } else {
          seedsByKey.set(key, {
            nodeId: node.nodeId,
            itemKey: node.itemKey,
            amountNeeded,
            seedAmount,
            cycleFactor: node.cycleFactor,
          });
        }
      }
      node.children.forEach(walk);
    }
  };

  walk(mergedTree.value.root);
  return Array.from(seedsByKey.values()).sort((a, b) => b.amountNeeded - a.amountNeeded);
});

const planningComplete = computed(() => {
  return planningStarted.value && pendingDecisions.value.length === 0;
});

// 当决策完成后，自动构建融合的需求树
watch(planningComplete, (complete) => {
  if (complete && props.pack && props.index) {
    buildMergedTree();
  }
});

const buildMergedTree = () => {
  if (!props.pack || !props.index || targets.value.length === 0) return;

  // 创建虚拟配方，将所有目标合并为一个输出
  // 为了实现多目标融合，我们需要：
  // 1. 分别为每个目标构建需求树
  // 2. 合并所有中间产物的需求
  // 3. 生成统一的树结构

  try {
    const trees: BuildTreeResult[] = targets.value.map((target) =>
      buildRequirementTree({
        pack: props.pack!,
        index: props.index!,
        rootItemKey: target.itemKey,
        targetAmount: target.rate,
        targetUnit: target.unit,
        selectedRecipeIdByItemKeyHash: selectedRecipeIdByItemKeyHash.value,
        selectedItemIdByTagId: selectedItemIdByTagId.value,
        maxDepth: 20,
      }),
    );

    const leafItemTotals = new Map<ItemId, number>();
    const leafFluidTotals = new Map<string, number>();
    const catalysts = new Map<ItemId, number>();

    for (const tree of trees) {
      for (const [itemId, amount] of tree.leafItemTotals.entries()) {
        const existing = leafItemTotals.get(itemId) ?? 0;
        leafItemTotals.set(itemId, existing + amount);
      }
      for (const [fluidId, amount] of tree.leafFluidTotals.entries()) {
        const existing = leafFluidTotals.get(fluidId) ?? 0;
        leafFluidTotals.set(fluidId, existing + amount);
      }
      for (const [itemId, amount] of tree.catalysts.entries()) {
        const existing = catalysts.get(itemId) ?? 0;
        catalysts.set(itemId, Math.max(existing, amount));
      }
    }

    if (trees.length === 1) {
      mergedTree.value = trees[0];
      mergedRootItemKey.value = trees[0].root.kind === 'item' ? trees[0].root.itemKey : null;
      return;
    }

    const virtualRoot: RequirementNode = {
      kind: 'item',
      nodeId: 'virtual-root',
      itemKey: { id: '__multi_target__' },
      amount: 1,
      children: trees.map((t) => t.root),
      catalysts: [],
      cycle: false,
    };

    mergedTree.value = {
      root: virtualRoot,
      leafItemTotals,
      leafFluidTotals,
      catalysts,
    };
    mergedRootItemKey.value = virtualRoot.itemKey;
  } catch (e) {
    console.error('Failed to build merged tree', e);
    mergedTree.value = null;
  }
};

const addTarget = (itemKey: ItemKey, itemName: string, rate = 1) => {
  const keyHash = itemKeyHash(itemKey);
  // 检查是否已存在
  const existing = targets.value.find((t) => itemKeyHash(t.itemKey) === keyHash);
  if (existing) {
    existing.rate += rate;
    invalidatePlanningIfNeeded();
  } else {
    targets.value.push({ itemKey, itemName, rate, unit: 'per_minute' });
    invalidatePlanningIfNeeded();
  }
};

const removeTarget = (index: number) => {
  targets.value.splice(index, 1);
  // 如果没有目标了，重置规划状态
  if (targets.value.length === 0) {
    resetPlanning();
  } else {
    invalidatePlanningIfNeeded();
  }
};

const updateTargetRate = (index: number, rate: number) => {
  if (rate > 0 && targets.value[index]) {
    targets.value[index].rate = rate;
    invalidatePlanningIfNeeded();
  }
};

const updateTargetUnit = (index: number, unit: 'per_second' | 'per_minute' | 'per_hour') => {
  if (targets.value[index]) {
    targets.value[index].unit = unit;
    invalidatePlanningIfNeeded();
  }
};

const clearTargets = () => {
  targets.value = [];
  resetPlanning();
};

const resetPlanning = () => {
  planningStarted.value = false;
  allDecisions.value = [];
  selectedRecipeIdByItemKeyHash.value.clear();
  selectedItemIdByTagId.value.clear();
  mergedTree.value = null;
  mergedRootItemKey.value = null;
  collapsed.value = new Set();
};

const invalidatePlanningIfNeeded = () => {
  if (planningStarted.value) resetPlanning();
};

const startPlanning = () => {
  if (!props.index || !props.pack || targets.value.length === 0) return;

  // 重置状态
  allDecisions.value = [];
  selectedRecipeIdByItemKeyHash.value.clear();
  selectedItemIdByTagId.value.clear();
  mergedTree.value = null;
  mergedRootItemKey.value = null;
  collapsed.value = new Set();

  // 为所有目标收集决策
  const allDecisionsList: PlannerDecision[] = [];

  for (const target of targets.value) {
    try {
      const decisions = computePlannerDecisions({
        pack: props.pack,
        index: props.index,
        rootItemKey: target.itemKey,
        selectedRecipeIdByItemKeyHash: new Map(),
        selectedItemIdByTagId: new Map(),
        maxDepth: 20,
      });
      allDecisionsList.push(...decisions);
    } catch (e) {
      console.error('Failed to compute decisions for', target.itemName, e);
    }
  }

  // 去重决策（基于 itemKeyHash 或 tagId）
  const decisionsMap = new Map<string, PlannerDecision>();
  for (const d of allDecisionsList) {
    const key = d.kind === 'item_recipe' ? d.itemKeyHash : `tag:${d.tagId}`;
    if (!decisionsMap.has(key)) {
      decisionsMap.set(key, d);
    }
  }

  allDecisions.value = Array.from(decisionsMap.values());
  planningStarted.value = true;
};

const autoOptimize = () => {
  if (!props.index || !props.pack || targets.value.length === 0) return;
  // 每次自动优化都重新收集决策，保证新增目标生效
  startPlanning();

  // 对每个目标运行自动选择算法
  const allRecipeSelections = new Map<string, string>();
  const allTagSelections = new Map<string, ItemId>();

  for (const target of targets.value) {
    try {
      const autoSelections = autoPlanSelections({
        pack: props.pack,
        index: props.index,
        rootItemKey: target.itemKey,
        maxDepth: 20,
      });

      // 合并选择结果
      for (const [keyHash, recipeId] of Object.entries(
        autoSelections.selectedRecipeIdByItemKeyHash,
      )) {
        allRecipeSelections.set(keyHash, recipeId);
      }

      for (const [tagId, itemId] of Object.entries(autoSelections.selectedItemIdByTagId)) {
        allTagSelections.set(tagId, itemId);
      }
    } catch (e) {
      console.error('Failed to auto optimize for', target.itemName, e);
    }
  }

  // 应用自动选择
  selectedRecipeIdByItemKeyHash.value = allRecipeSelections;
  selectedItemIdByTagId.value = allTagSelections;
};

const itemName = (itemKey: ItemKey): string => {
  if (itemKey.id === '__multi_target__') return '多目标规划';
  const keyHash = itemKeyHash(itemKey);
  return props.itemDefsByKeyHash?.[keyHash]?.name ?? itemKey.id;
};

const decisionKey = (d: PlannerDecision): string => {
  return d.kind === 'item_recipe' ? `recipe:${d.itemKeyHash}` : `tag:${d.tagId}`;
};

const recipeOptionsForDecision = (d: Extract<PlannerDecision, { kind: 'item_recipe' }>) => {
  if (!props.index) return [];

  return d.recipeOptions
    .map((recipeId: string) => {
      const r = props.index!.recipesById.get(recipeId);
      const recipeType = r ? props.index!.recipeTypesByKey.get(r.type) : undefined;
      const label = r ? `${recipeType?.displayName ?? r.type}` : recipeId;
      const inputs: Stack[] = r ? extractRecipeStacks(r, recipeType).inputs : [];
      return { label, value: recipeId, inputs, recipe: r, recipeType };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

const getSelectedRecipe = (itemKeyHash: string): string | null => {
  return selectedRecipeIdByItemKeyHash.value.get(itemKeyHash) ?? null;
};

const getSelectedTag = (tagId: string): string | null => {
  return selectedItemIdByTagId.value.get(tagId) ?? null;
};

const setRecipeChoice = (itemKeyHash: string, recipeId: string) => {
  selectedRecipeIdByItemKeyHash.value.set(itemKeyHash, recipeId);
};

const setTagChoice = (tagId: string, itemId: string) => {
  selectedItemIdByTagId.value.set(tagId, itemId);
};

const tagItemOptions = (d: Extract<PlannerDecision, { kind: 'tag_item' }>) => {
  if (!props.index) return [];

  return d.candidateItemIds
    .map((itemId: ItemId) => {
      const keyHashes = props.index!.itemKeyHashesByItemId.get(itemId) ?? [];
      const keyHash = keyHashes[0];
      const def = keyHash ? props.itemDefsByKeyHash?.[keyHash] : undefined;
      const label = def?.name ? `${def.name} (${itemId})` : itemId;
      return { label, value: itemId };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

function toggleCollapsed(nodeId: string) {
  const next = new Set(collapsed.value);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  collapsed.value = next;
}

type TreeRow = { node: RequirementNode; depth: number };
type TreeListRow = { node: RequirementNode; connect: boolean[] };

const treeRows = computed<TreeRow[]>(() => {
  if (!mergedTree.value) return [];
  const rows: TreeRow[] = [];

  const walk = (node: RequirementNode, depth: number) => {
    rows.push({ node, depth });
    if (node.kind !== 'item') return;
    if (collapsed.value.has(node.nodeId)) return;
    node.children.forEach((c) => walk(c, depth + 1));
  };

  walk(mergedTree.value.root, 0);
  return rows;
});

const treeListRows = computed<TreeListRow[]>(() => {
  if (!mergedTree.value) return [];
  const rows: TreeListRow[] = [];

  const walk = (node: RequirementNode, connect: boolean[]) => {
    rows.push({ node, connect });
    if (node.kind !== 'item') return;
    if (collapsed.value.has(node.nodeId)) return;
    node.children.forEach((c, idx) => walk(c, [...connect, idx !== node.children.length - 1]));
  };

  walk(mergedTree.value.root, []);
  return rows;
});

const rateColumnLabel = computed(() => {
  if (treeDisplayUnit.value === 'per_second') return '物品/秒';
  if (treeDisplayUnit.value === 'per_hour') return '物品/时';
  return '物品/分';
});

function finiteOr(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function nodeDisplayAmount(node: RequirementNode): number {
  return finiteOr(node.amount, 0);
}

function nodeDisplayRate(node: RequirementNode): number {
  const amount = nodeDisplayAmount(node);
  if (treeDisplayUnit.value === 'per_second') return amount / 60;
  if (treeDisplayUnit.value === 'per_hour') return amount * 60;
  return amount;
}

function nodeBeltsText(node: RequirementNode): string {
  if (node.kind !== 'item') return '';
  const perSecond = nodeDisplayAmount(node) / 60;
  const belts = perSecond / DEFAULT_BELT_SPEED;
  if (!Number.isFinite(belts) || belts <= 0) return '';
  if (belts < 0.1) return '<0.1';
  return String(formatAmount(belts));
}

function nodeMachinesText(node: RequirementNode): string {
  if (node.kind !== 'item') return '';
  const meta = node as RequirementNode & { machineCount?: unknown; machines?: unknown };
  const machineCount = finiteOr(meta.machineCount, 0);
  if (Number.isFinite(machineCount) && machineCount > 0) return String(Math.round(machineCount));
  const machines = finiteOr(meta.machines, 0);
  if (!Number.isFinite(machines) || machines <= 0) return '';
  return String(Math.ceil(machines - 1e-9));
}

function nodePowerText(node: RequirementNode): string {
  if (node.kind !== 'item') return '';
  const power = finiteOr((node as RequirementNode & { power?: unknown }).power, 0);
  if (!Number.isFinite(power) || power <= 0) return '';
  return `${formatAmount(power)} kW`;
}

function formatAmount(n: number) {
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n * 1000) / 1000;
  return rounded;
}

const getRateUnitLabel = (unit: 'per_second' | 'per_minute' | 'per_hour') => {
  return rateUnitOptions.find((o) => o.value === unit)?.label ?? unit;
};

const getItemName = (itemId: ItemId): string => {
  if (!props.index) return itemId;
  const keyHashes = props.index.itemKeyHashesByItemId.get(itemId) ?? [];
  const keyHash = keyHashes[0];
  return keyHash ? (props.itemDefsByKeyHash?.[keyHash]?.name ?? itemId) : itemId;
};

defineExpose({
  addTarget,
});
</script>

<style scoped>
.advanced-planner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
}

.advanced-planner-panels {
  flex: 1 1 auto;
  min-height: 0;
}

.advanced-planner-panels :deep(.q-tab-panel) {
  height: 100%;
  /* 不在内部产生额外滚动，使用外部容器的滚动条 */
  overflow: visible;
}

.monospace {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-variant-numeric: tabular-nums;
}

.planner__tree-table {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.planner__tree-table-header,
.planner__tree-table-row {
  display: flex;
  align-items: center;
}

.planner__tree-table-header {
  background: rgba(0, 0, 0, 0.04);
  font-size: 12px;
  font-weight: 600;
}

.planner__tree-table-row {
  min-height: 46px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.planner__tree-col {
  padding: 8px 10px;
  min-width: 0;
}

.planner__tree-col--tree {
  flex: 1 1 auto;
  overflow: hidden;
}

.planner__tree-col--rate {
  flex: 0 0 110px;
}

.planner__tree-col--belts {
  flex: 0 0 90px;
}

.planner__tree-col--machines {
  flex: 0 0 140px;
}

.planner__tree-col--power {
  flex: 0 0 110px;
}

.planner__links {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 46px;
  overflow: hidden;
}

.planner__connect {
  position: relative;
  margin-left: 12px;
  /* 与每行高度一致，避免使用视窗高度（vh）导致内层滚动 */
  height: 46px;
}

.planner__connect--last,
.planner__connect--trail {
  border-left: 2px dotted rgba(0, 0, 0, 0.35);
}

.planner__connect--last:not(.planner__connect--trail) {
  /* 仅作视觉终止，不影响高度 */
  margin-bottom: 0;
}

.planner__connect + .planner__connect {
  margin-left: 18px;
}

.planner__tree-toggle {
  display: flex;
  align-items: center;
  width: 28px;
}

.planner__tree-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
}

.planner__tree-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
  padding-left: 8px;
}

.planner__tree-name-main {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.planner__tree-name-sub {
  line-height: 1.1;
}

.planner__machines-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.planner__machines-text {
  min-width: 0;
}

.planner__tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.planner__tree-indent {
  height: 1px;
}

.planner__tree-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.decision-card {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 暗色模式支持 */
.body--dark .advanced-planner {
  background-color: var(--q-dark);
}

.body--dark .decision-card {
  border-color: rgba(255, 255, 255, 0.1);
}

/* 响应式布局 */
@media (max-width: 600px) {
  .advanced-planner :deep(.q-card) {
    padding: 8px !important;
  }
}
</style>
