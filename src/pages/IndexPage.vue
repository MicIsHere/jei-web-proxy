<template>
  <q-page :class="['jei-page', { 'jei-debug': settingsStore.debugLayout }]">
    <div v-if="error" class="text-negative q-pa-md">{{ error }}</div>
    <div v-else-if="loading" class="row items-center q-gutter-sm q-pa-md">
      <q-spinner size="20px" />
      <div>Loading…</div>
    </div>

    <div v-else class="jei-root">
      <q-card flat bordered class="jei-fav column no-wrap">
        <div class="jei-list__head col-auto">
          <div class="text-subtitle2">收藏夹</div>
          <div class="text-caption">A：取消收藏</div>
        </div>

        <div class="jei-list__scroll col">
          <div v-if="savedPlans.length" class="jei-plans">
            <div class="jei-plans__head text-caption text-grey-8">已保存线路</div>
            <q-list dense class="jei-plans__list">
              <q-item
                v-for="p in savedPlans"
                :key="p.id"
                clickable
                class="jei-plans__item"
                @click="openSavedPlan(p)"
              >
                <q-item-section avatar>
                  <stack-view
                    :content="{
                      kind: 'item',
                      id: p.rootItemKey.id,
                      amount: 1,
                      ...(p.rootItemKey.meta !== undefined ? { meta: p.rootItemKey.meta } : {}),
                      ...(p.rootItemKey.nbt !== undefined ? { nbt: p.rootItemKey.nbt } : {}),
                    }"
                    :item-defs-by-key-hash="itemDefsByKeyHash"
                    variant="slot"
                    :show-name="false"
                    :show-subtitle="false"
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label lines="1">{{ p.name }}</q-item-label>
                  <q-item-label caption lines="1">{{ p.rootItemKey.id }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn
                    flat
                    round
                    dense
                    icon="delete"
                    color="grey-7"
                    @click.stop="deleteSavedPlan(p.id)"
                  />
                </q-item-section>
              </q-item>
            </q-list>
            <q-separator class="q-my-sm" />
          </div>
          <div v-if="favoriteItems.length" class="jei-grid">
            <q-card
              v-for="it in favoriteItems"
              :key="it.keyHash"
              flat
              bordered
              class="jei-grid__cell cursor-pointer"
              @mouseenter="hoveredKeyHash = it.keyHash"
              @mouseleave="hoveredKeyHash = null"
              @click="openDialogByKeyHash(it.keyHash)"
            >
              <q-btn
                flat
                round
                dense
                size="sm"
                icon="star"
                color="amber"
                class="jei-grid__fav"
                @click.stop="toggleFavorite(it.keyHash)"
              />
              <div class="jei-grid__cell-body">
                <stack-view
                  :content="{
                    kind: 'item',
                    id: it.def.key.id,
                    amount: 1,
                    ...(it.def.key.meta !== undefined ? { meta: it.def.key.meta } : {}),
                    ...(it.def.key.nbt !== undefined ? { nbt: it.def.key.nbt } : {}),
                  }"
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                />
              </div>
            </q-card>
          </div>
          <div v-else class="text-caption text-grey-7">暂无收藏（悬停物品按 A 收藏）</div>
        </div>
      </q-card>

      <q-card flat bordered class="jei-panel column no-wrap">
        <template v-if="settingsStore.recipeViewMode === 'panel'">
          <div class="jei-panel__head row items-center q-gutter-sm col-auto">
            <div class="text-subtitle2">{{ navStack.length ? currentItemTitle : '中间区域' }}</div>
            <q-space />
            <q-btn
              v-if="navStack.length > 1"
              flat
              round
              dense
              icon="arrow_back"
              @click="goBackInDialog"
            />
            <q-btn v-if="navStack.length" flat round dense icon="close" @click="closeDialog" />
          </div>
          <div v-if="navStack.length" class="jei-panel__tabs col-auto">
            <q-tabs
              v-model="activeTab"
              dense
              outside-arrows
              mobile-arrows
              inline-label
              class="q-px-sm q-pt-sm"
            >
              <q-tab name="recipes" label="Recipes (R)" />
              <q-tab name="uses" label="Uses (U)" />
              <q-tab name="planner" label="Planner (P)" />
            </q-tabs>
          </div>
          <q-separator />
          <div v-if="navStack.length" class="col jei-panel__body">
            <crafting-planner-view
              v-if="pack && index && currentItemKey"
              v-show="activeTab === 'planner'"
              class="q-pa-md"
              :pack="pack"
              :index="index"
              :root-item-key="currentItemKey"
              :item-defs-by-key-hash="itemDefsByKeyHash"
              :initial-state="plannerInitialState"
              @item-click="openDialogByItemKey"
              @save-plan="savePlannerPlan"
              @state-change="onPlannerStateChange"
            />
            <div v-show="activeTab !== 'planner'" class="jei-dialog__type-tabs">
              <div v-if="activeRecipeGroups.length" class="jei-type-layout">
                <div v-if="typeMachineIcons.length" class="jei-type-sidebar">
                  <q-btn
                    v-for="m in typeMachineIcons"
                    :key="m.typeKey"
                    flat
                    dense
                    class="jei-type-sidebar__btn"
                    :color="m.typeKey === activeTypeKey ? 'primary' : 'grey-7'"
                    @click="activeTypeKey = m.typeKey"
                  >
                    <stack-view
                      :content="{ kind: 'item', id: m.machineItemId, amount: 1 }"
                      :item-defs-by-key-hash="itemDefsByKeyHash"
                      variant="slot"
                      :show-name="false"
                      :show-subtitle="false"
                    />
                  </q-btn>
                </div>

                <div class="jei-type-main">
                  <q-tabs
                    v-model="activeTypeKey"
                    dense
                    outside-arrows
                    mobile-arrows
                    inline-label
                    class="q-px-sm q-pt-sm"
                  >
                    <q-tab
                      v-for="g in activeRecipeGroups"
                      :key="g.typeKey"
                      :name="g.typeKey"
                      :label="`${g.label} (${g.recipeIds.length})`"
                    />
                  </q-tabs>
                  <q-separator />

                  <q-tab-panels v-model="activeTypeKey" animated class="jei-panel__panels">
                    <q-tab-panel
                      v-for="g in activeRecipeGroups"
                      :key="g.typeKey"
                      :name="g.typeKey"
                      class="q-pa-md"
                    >
                      <div class="column q-gutter-md">
                        <q-card v-for="rid in g.recipeIds" :key="rid" flat bordered class="q-pa-md">
                          <recipe-viewer
                            :recipe="recipesById.get(rid)!"
                            :recipe-type="recipeTypesByKey.get(recipesById.get(rid)!.type)!"
                            :item-defs-by-key-hash="itemDefsByKeyHash"
                            @item-click="openDialogByItemKey"
                          />
                        </q-card>
                      </div>
                    </q-tab-panel>
                  </q-tab-panels>
                </div>
              </div>
              <div v-else class="q-pa-md text-caption">没有找到相关配方。</div>
            </div>
          </div>
          <div v-else class="q-pa-md text-caption text-grey-7 col">
            选择物品以查看 Recipes/Uses。
          </div>
        </template>
        <template v-else>
          <div class="text-subtitle2">中间区域</div>
          <div class="text-caption">右侧是物品列表，左侧是收藏夹；点击物品打开悬浮窗。</div>
        </template>
      </q-card>

      <q-card flat bordered class="jei-list column no-wrap">
        <div class="jei-list__head col-auto">
          <div class="text-subtitle2">物品列表</div>
          <div class="text-caption">pack: {{ pack?.manifest.packId }}</div>
        </div>

        <div ref="listScrollEl" class="jei-list__scroll col" @wheel="onListWheel">
          <div ref="listGridEl" class="jei-grid">
            <div v-if="firstPagedItem" ref="sampleCellEl">
              <q-card
                :key="firstPagedItem.keyHash"
                flat
                bordered
                class="jei-grid__cell cursor-pointer"
                @mouseenter="hoveredKeyHash = firstPagedItem.keyHash"
                @mouseleave="hoveredKeyHash = null"
                @click="openDialogByKeyHash(firstPagedItem.keyHash)"
              >
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  :icon="isFavorite(firstPagedItem.keyHash) ? 'star' : 'star_outline'"
                  :color="isFavorite(firstPagedItem.keyHash) ? 'amber' : 'grey-6'"
                  class="jei-grid__fav"
                  @click.stop="toggleFavorite(firstPagedItem.keyHash)"
                />
                <div class="jei-grid__cell-body">
                  <stack-view
                    :content="{
                      kind: 'item',
                      id: firstPagedItem.def.key.id,
                      amount: 1,
                      ...(firstPagedItem.def.key.meta !== undefined
                        ? { meta: firstPagedItem.def.key.meta }
                        : {}),
                      ...(firstPagedItem.def.key.nbt !== undefined
                        ? { nbt: firstPagedItem.def.key.nbt }
                        : {}),
                    }"
                    :item-defs-by-key-hash="itemDefsByKeyHash"
                  />
                </div>
              </q-card>
            </div>

            <q-card
              v-for="it in restPagedItems"
              :key="it.keyHash"
              flat
              bordered
              class="jei-grid__cell cursor-pointer"
              @mouseenter="hoveredKeyHash = it.keyHash"
              @mouseleave="hoveredKeyHash = null"
              @click="openDialogByKeyHash(it.keyHash)"
            >
              <q-btn
                flat
                round
                dense
                size="sm"
                :icon="isFavorite(it.keyHash) ? 'star' : 'star_outline'"
                :color="isFavorite(it.keyHash) ? 'amber' : 'grey-6'"
                class="jei-grid__fav"
                @click.stop="toggleFavorite(it.keyHash)"
              />
              <div class="jei-grid__cell-body">
                <stack-view
                  :content="{
                    kind: 'item',
                    id: it.def.key.id,
                    amount: 1,
                    ...(it.def.key.meta !== undefined ? { meta: it.def.key.meta } : {}),
                    ...(it.def.key.nbt !== undefined ? { nbt: it.def.key.nbt } : {}),
                  }"
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                />
              </div>
            </q-card>
          </div>
        </div>

        <div class="jei-list__pager col-auto">
          <div class="text-caption text-grey-7">共 {{ filteredItems.length }} 个</div>
          <div class="text-caption text-grey-7">每页 {{ pageSize }} 个</div>
          <q-space />
          <q-pagination
            v-model="page"
            :max="pageCount"
            max-pages="7"
            boundary-numbers
            direction-links
            dense
          />
        </div>

        <div ref="historyEl" class="jei-list__history col-auto">
          <div class="jei-list__history-title">历史</div>
          <div class="jei-grid">
            <template
              v-for="(it, idx) in paddedHistoryItems"
              :key="it ? it.keyHash : `placeholder-${idx}`"
            >
              <q-card
                v-if="it"
                flat
                bordered
                class="jei-grid__cell cursor-pointer"
                @mouseenter="hoveredKeyHash = it.keyHash"
                @mouseleave="hoveredKeyHash = null"
                @click="openDialogByKeyHash(it.keyHash)"
              >
                <stack-view
                  :content="{
                    kind: 'item',
                    id: it.def.key.id,
                    amount: 1,
                    ...(it.def.key.meta !== undefined ? { meta: it.def.key.meta } : {}),
                    ...(it.def.key.nbt !== undefined ? { nbt: it.def.key.nbt } : {}),
                  }"
                  :item-defs-by-key-hash="itemDefsByKeyHash"
                />
              </q-card>
              <div
                v-else
                class="jei-grid__cell placeholder"
                :style="{ height: measuredCellHeight + 'px' }"
              ></div>
            </template>
          </div>
        </div>
      </q-card>
    </div>

    <div class="jei-bottombar">
      <div class="row items-center q-gutter-sm">
        <q-select
          v-model="activePackId"
          :options="packOptions"
          dense
          outlined
          emit-value
          map-options
          :disable="loading"
          style="min-width: 220px"
        />
        <q-input
          v-model="filterText"
          dense
          outlined
          clearable
          :disable="filterDisabled"
          placeholder="输入名字过滤…（支持 @itemid/@gameid/@tag）"
          class="col"
        />
        <q-btn flat round icon="settings" @click="settingsOpen = true" />
      </div>
    </div>

    <pre v-if="settingsStore.debugLayout" class="jei-debug-overlay">{{ debugText }}</pre>

    <q-dialog v-model="settingsOpen">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-h6">设置</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input
            type="number"
            label="历史记录显示数量"
            dense
            outlined
            :model-value="settingsStore.historyLimit"
            @update:model-value="(v) => settingsStore.setHistoryLimit(Number(v) || 0)"
          />
          <q-toggle
            label="开启调试滚动"
            :model-value="settingsStore.debugLayout"
            @update:model-value="(v) => settingsStore.setDebugLayout(!!v)"
          />
          <q-select
            dense
            outlined
            label="合成表显示方式"
            :options="[
              { label: '弹窗', value: 'dialog' },
              { label: '中间区域', value: 'panel' },
            ]"
            emit-value
            map-options
            :model-value="settingsStore.recipeViewMode"
            @update:model-value="(v) => settingsStore.setRecipeViewMode(v as 'dialog' | 'panel')"
          />
          <q-toggle
            label="合成表物品显示名字"
            :model-value="settingsStore.recipeSlotShowName"
            @update:model-value="(v) => settingsStore.setRecipeSlotShowName(!!v)"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="关闭" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="dialogOpen" content-class="jei-dialog-content">
      <q-card class="jei-dialog">
        <div class="jei-dialog__head">
          <div class="jei-dialog__title">
            {{ currentItemTitle }}
          </div>
          <q-btn flat round icon="close" @click="closeDialog" />
        </div>

        <div class="jei-dialog__tabs">
          <q-tabs
            v-model="activeTab"
            dense
            outside-arrows
            mobile-arrows
            inline-label
            class="q-px-sm q-pt-sm"
          >
            <q-tab name="recipes" label="Recipes (R)" />
            <q-tab name="uses" label="Uses (U)" />
            <q-tab name="planner" label="Planner (P)" />
          </q-tabs>
          <div class="jei-dialog__hint text-caption">Backspace: 返回 · Esc: 关闭</div>
        </div>

        <q-scroll-area class="jei-dialog__body">
          <crafting-planner-view
            v-if="pack && index && currentItemKey"
            v-show="activeTab === 'planner'"
            class="q-pa-md"
            :pack="pack"
            :index="index"
            :root-item-key="currentItemKey"
            :item-defs-by-key-hash="itemDefsByKeyHash"
            :initial-state="plannerInitialState"
            @item-click="openDialogByItemKey"
            @save-plan="savePlannerPlan"
            @state-change="onPlannerStateChange"
          />
          <div v-show="activeTab !== 'planner'" class="jei-dialog__type-tabs">
            <div v-if="activeRecipeGroups.length" class="jei-type-layout">
              <div v-if="typeMachineIcons.length" class="jei-type-sidebar">
                <q-btn
                  v-for="m in typeMachineIcons"
                  :key="m.typeKey"
                  flat
                  dense
                  class="jei-type-sidebar__btn"
                  :color="m.typeKey === activeTypeKey ? 'primary' : 'grey-7'"
                  @click="activeTypeKey = m.typeKey"
                >
                  <stack-view
                    :content="{ kind: 'item', id: m.machineItemId, amount: 1 }"
                    :item-defs-by-key-hash="itemDefsByKeyHash"
                    variant="slot"
                    :show-name="false"
                    :show-subtitle="false"
                  />
                </q-btn>
              </div>

              <div class="jei-type-main">
                <q-tabs
                  v-model="activeTypeKey"
                  dense
                  outside-arrows
                  mobile-arrows
                  inline-label
                  class="q-px-sm q-pt-sm"
                >
                  <q-tab
                    v-for="g in activeRecipeGroups"
                    :key="g.typeKey"
                    :name="g.typeKey"
                    :label="`${g.label} (${g.recipeIds.length})`"
                  />
                </q-tabs>
                <q-separator />

                <q-tab-panels v-model="activeTypeKey" animated>
                  <q-tab-panel
                    v-for="g in activeRecipeGroups"
                    :key="g.typeKey"
                    :name="g.typeKey"
                    class="q-pa-md"
                  >
                    <div class="column q-gutter-md">
                      <q-card v-for="rid in g.recipeIds" :key="rid" flat bordered class="q-pa-md">
                        <recipe-viewer
                          :recipe="recipesById.get(rid)!"
                          :recipe-type="recipeTypesByKey.get(recipesById.get(rid)!.type)!"
                          :item-defs-by-key-hash="itemDefsByKeyHash"
                          @item-click="openDialogByItemKey"
                        />
                      </q-card>
                    </div>
                  </q-tab-panel>
                </q-tab-panels>
              </div>
            </div>
            <div v-else class="q-pa-md text-caption">没有找到相关配方。</div>
          </div>
        </q-scroll-area>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { ItemDef, ItemKey, PackData } from 'src/jei/types';
import { loadPack } from 'src/jei/pack/loader';
import {
  buildJeiIndex,
  recipesConsumingItem,
  recipesProducingItem,
  type JeiIndex,
} from 'src/jei/indexing/buildIndex';
import StackView from 'src/jei/components/StackView.vue';
import RecipeViewer from 'src/jei/components/RecipeViewer.vue';
import CraftingPlannerView from 'src/jei/components/CraftingPlannerView.vue';
import type {
  PlannerInitialState,
  PlannerLiveState,
  PlannerSavePayload,
} from 'src/jei/planner/plannerUi';
import { itemKeyHash } from 'src/jei/indexing/key';
import { useSettingsStore } from 'src/stores/settings';

const settingsStore = useSettingsStore();

const loading = ref(true);
const error = ref('');

const pack = ref<PackData | null>(null);
const index = ref<JeiIndex | null>(null);

const activePackId = ref<'aef' | 'demo'>('aef');
const packOptions = [
  { label: 'Arknights: Endfield', value: 'aef' },
  { label: 'demo', value: 'demo' },
];

const selectedKeyHash = ref<string | null>(null);
const hoveredKeyHash = ref<string | null>(null);
const filterText = ref('');
const favorites = ref<Set<string>>(new Set());
type SavedPlan = {
  id: string;
  name: string;
  rootItemKey: ItemKey;
  rootKeyHash: string;
  targetAmount: number;
  selectedRecipeIdByItemKeyHash: Record<string, string>;
  selectedItemIdByTagId: Record<string, string>;
  createdAt: number;
};

const savedPlans = ref<SavedPlan[]>([]);
const plannerInitialState = ref<PlannerInitialState | null>(null);
const plannerLiveState = ref<PlannerLiveState>({
  targetAmount: 1,
  selectedRecipeIdByItemKeyHash: {},
  selectedItemIdByTagId: {},
});
const historyKeyHashes = ref<string[]>([]);

const filterDisabled = computed(() => loading.value || !!error.value);

const page = ref(1);
const listScrollEl = ref<HTMLElement | null>(null);
const listGridEl = ref<HTMLElement | null>(null);
const sampleCellEl = ref<HTMLElement | null>(null);
const measuredCellHeight = ref(84);
const gridGap = 8;
const gridColumns = 2;

const pageSize = ref(120);

const settingsOpen = ref(false);
const dialogOpen = ref(false);
const navStack = ref<ItemKey[]>([]);
const activeTab = ref<'recipes' | 'uses' | 'planner'>('recipes');
const lastRecipeTab = ref<'recipes' | 'uses'>('recipes');
const activeRecipesTypeKey = ref('');
const activeUsesTypeKey = ref('');
const activeTypeKey = computed({
  get: () =>
    lastRecipeTab.value === 'recipes' ? activeRecipesTypeKey.value : activeUsesTypeKey.value,
  set: (v: string) => {
    if (lastRecipeTab.value === 'recipes') activeRecipesTypeKey.value = v;
    else activeUsesTypeKey.value = v;
  },
});

const itemDefsByKeyHash = computed<Record<string, ItemDef>>(() => {
  const map = index.value?.itemsByKeyHash;
  if (!map) return {};
  return Object.fromEntries(map.entries());
});

type ParsedSearch = {
  text: string[];
  itemId: string[];
  gameId: string[];
  tag: string[];
};

const parsedSearch = computed<ParsedSearch>(() => parseSearch(filterText.value));

const filteredItems = computed(() => {
  const map = index.value?.itemsByKeyHash;
  if (!map) return [];
  const entries = Array.from(map.entries()).map(([keyHash, def]) => ({ keyHash, def }));
  const search = parsedSearch.value;

  const filtered = entries.filter((e) => matchesSearch(e.def, search));
  filtered.sort((a, b) => {
    return a.def.name.localeCompare(b.def.name);
  });
  return filtered;
});

const pageCount = computed(() => {
  const total = filteredItems.value.length;
  const size = pageSize.value;
  if (!size) return 1;
  return Math.max(1, Math.ceil(total / size));
});

watch(
  () => [filterText.value, activePackId.value] as const,
  () => {
    page.value = 1;
  },
);

watch(
  () => pageCount.value,
  (max) => {
    if (page.value > max) page.value = max;
  },
);

watch(
  () => settingsStore.recipeViewMode,
  (mode) => {
    if (mode === 'panel') dialogOpen.value = false;
    if (mode === 'dialog' && navStack.value.length) dialogOpen.value = true;
  },
);

const pagedItems = computed(() => {
  const size = pageSize.value;
  const start = (page.value - 1) * size;
  return filteredItems.value.slice(start, start + size);
});

const firstPagedItem = computed(() => pagedItems.value[0] ?? null);
const restPagedItems = computed(() => pagedItems.value.slice(1));

const historyEl = ref<HTMLElement | null>(null);

const debugMetrics = ref({
  containerClientHeight: 0,
  containerPaddingTop: 0,
  containerPaddingBottom: 0,
  contentHeight: 0,
  available: 0,
  cell: 0,
  rows: 0,
  pageSize: 0,
  gridHeight: 0,
});

const debugText = computed(() => {
  const m = debugMetrics.value;
  return [
    `pageSize=${pageSize.value}`,
    `rows=${m.rows}`,
    `cell=${m.cell}`,
    `available=${m.available}`,
    `contentHeight=${m.contentHeight}`,
    `gridHeight=${m.gridHeight}`,
    `clientHeight=${m.containerClientHeight}`,
    `padding=${m.containerPaddingTop}+${m.containerPaddingBottom}`,
  ].join('\n');
});

function debugLog(event: string, data?: Record<string, unknown>) {
  if (!settingsStore.debugLayout) return;
  const ts = new Date().toISOString().slice(11, 23);
  if (data) console.log(`[jei][layout ${ts}] ${event}`, data);
  else console.log(`[jei][layout ${ts}] ${event}`);
}

function getContentBoxHeight(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const pt = Number.parseFloat(cs.paddingTop || '0') || 0;
  const pb = Number.parseFloat(cs.paddingBottom || '0') || 0;
  debugMetrics.value.containerClientHeight = el.clientHeight;
  debugMetrics.value.containerPaddingTop = pt;
  debugMetrics.value.containerPaddingBottom = pb;
  return Math.max(0, el.clientHeight - pt - pb);
}

let validateSeq = 0;
function scheduleValidate() {
  const seq = (validateSeq += 1);
  void nextTick(() => {
    requestAnimationFrame(() => {
      if (seq !== validateSeq) return;
      const container = listScrollEl.value;
      const grid = listGridEl.value;
      if (!container || !grid) return;
      const contentHeight = getContentBoxHeight(container);
      const gridHeight = Math.ceil(grid.getBoundingClientRect().height);
      debugMetrics.value.gridHeight = gridHeight;
      if (gridHeight > contentHeight + 1) {
        const nextSize = Math.max(gridColumns, pageSize.value - gridColumns);
        if (nextSize !== pageSize.value) {
          debugLog('validate: overflow -> shrink', {
            contentHeight,
            gridHeight,
            pageSize: pageSize.value,
            nextSize,
          });
          pageSize.value = nextSize;
          scheduleValidate();
        }
      } else {
        debugLog('validate: ok', { contentHeight, gridHeight, pageSize: pageSize.value });
      }
    });
  });
}

function recomputePageSize(explicitHeight?: number) {
  const container = listScrollEl.value;
  if (!container && typeof explicitHeight !== 'number') return;

  const sample = sampleCellEl.value;
  if (sample) {
    const h = sample.offsetHeight;
    if (h > 0) measuredCellHeight.value = h;
  }

  const contentHeight =
    typeof explicitHeight === 'number'
      ? explicitHeight
      : container
        ? getContentBoxHeight(container)
        : 0;
  const available = Math.max(0, Math.floor(contentHeight) - 4);
  const cell = Math.max(1, measuredCellHeight.value);
  debugLog('recompute: input', {
    explicitHeight,
    contentHeight,
    available,
    cell,
    gridColumns,
    gridGap,
  });

  // 计算能放下的行数，考虑 grid-gap
  // rows * cell + (rows - 1) * gap <= available
  // rows * (cell + gap) - gap <= available
  // rows * (cell + gap) <= available + gap
  let rows = Math.floor((available + gridGap) / (cell + gridGap));

  if (rows < 1) rows = 1;

  // 双重检查，确保计算出的行数绝对不会溢出
  let used = rows * (cell + gridGap) - gridGap;
  while (rows > 1 && used > available) {
    rows -= 1;
    used = rows * (cell + gridGap) - gridGap;
  }

  const size = Math.max(gridColumns, rows * gridColumns);

  debugMetrics.value.contentHeight = Math.floor(contentHeight);
  debugMetrics.value.available = available;
  debugMetrics.value.cell = cell;
  debugMetrics.value.rows = rows;
  debugMetrics.value.pageSize = size;

  if (pageSize.value !== size) pageSize.value = size;
  debugLog('recompute: result', { rows, size, pageSize: pageSize.value, used });
  scheduleValidate();
}

const favoriteItems = computed(() => {
  const map = index.value?.itemsByKeyHash;
  if (!map) return [];
  const entries = Array.from(favorites.value.values())
    .map((keyHash) => {
      const def = map.get(keyHash);
      if (!def) return null;
      return { keyHash, def };
    })
    .filter((v): v is { keyHash: string; def: ItemDef } => v !== null);
  entries.sort((a, b) => a.def.name.localeCompare(b.def.name));
  return entries;
});

const historyItems = computed(() => {
  const map = index.value?.itemsByKeyHash;
  if (!map) return [];
  // 按照 settings.historyLimit 截取
  const limit = settingsStore.historyLimit;
  const sliced = historyKeyHashes.value.slice(0, limit);

  return sliced
    .map((keyHash) => {
      const def = map.get(keyHash);
      if (!def) return null;
      return { keyHash, def };
    })
    .filter((v): v is { keyHash: string; def: ItemDef } => v !== null);
});

// 生成带占位的历史记录列表，长度固定为 historyLimit
const paddedHistoryItems = computed(() => {
  const limit = settingsStore.historyLimit;
  const real = historyItems.value;
  const list: ({ keyHash: string; def: ItemDef } | null)[] = [...real];
  // 补齐 null
  while (list.length < limit) {
    list.push(null);
  }
  return list;
});

onMounted(async () => {
  try {
    loading.value = true;
    await reloadPack(activePackId.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', onWindowResize);
});

const resizeObserver = ref<ResizeObserver | null>(null);

// 监听 listScrollEl 的出现，初始化 ResizeObserver
// 这比在 onMounted 里写死更可靠，因为 listScrollEl 受 v-if (loading) 控制
watch(
  listScrollEl,
  (el) => {
    // 先清理旧的
    if (resizeObserver.value) {
      resizeObserver.value.disconnect();
      resizeObserver.value = null;
    }

    if (!el) return;
    debugLog('listScrollEl: mounted', {
      clientHeight: el.clientHeight,
      rectHeight: Math.ceil(el.getBoundingClientRect().height),
    });

    // 初始化新的 ResizeObserver
    const ro = new ResizeObserver((entries) => {
      // 使用 requestAnimationFrame 确保在下一帧（布局稳定后）再计算
      requestAnimationFrame(() => {
        for (const entry of entries) {
          if (entry.target === el) {
            debugLog('resizeObserver', { contentRectHeight: entry.contentRect.height });
            recomputePageSize(entry.contentRect.height);
          }
        }
      });
    });

    ro.observe(el);
    resizeObserver.value = ro;

    // 立即计算一次，但也延后一帧
    requestAnimationFrame(() => {
      pageSize.value = 0;
      recomputePageSize();
    });
  },
  { immediate: true, flush: 'post' }, // flush: 'post' 确保在 DOM 更新后触发
);

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('resize', onWindowResize);
  resizeObserver.value?.disconnect();
});

const wheelState = ref({ lastAt: 0, acc: 0 });

function wrapPage(next: number) {
  const max = pageCount.value;
  if (max <= 1) return 1;
  if (next < 1) return max;
  if (next > max) return 1;
  return next;
}

function onListWheel(e: WheelEvent) {
  if (loading.value || error.value) return;
  if (e.ctrlKey) return;
  const now = performance.now();
  const state = wheelState.value;
  if (now - state.lastAt > 180) state.acc = 0;
  state.lastAt = now;
  state.acc += e.deltaY;

  const threshold = 60;
  if (Math.abs(state.acc) < threshold) return;

  const dir = state.acc > 0 ? 1 : -1;
  state.acc = 0;
  page.value = wrapPage(page.value + dir);
  e.preventDefault();
}

function onWindowResize() {
  debugLog('window: resize');
  void recomputePageSize();
}

watch(activePackId, async (next) => {
  debugLog('pack: change', { next });
  await reloadPack(next);
  void recomputePageSize(); // 切 pack 后重新计算一次
});

async function reloadPack(packId: string) {
  error.value = '';
  loading.value = true;
  try {
    closeDialog();
    historyKeyHashes.value = [];
    const p = await loadPack(packId);
    pack.value = p;
    index.value = buildJeiIndex(p);
    favorites.value = loadFavorites(p.manifest.packId);
    savedPlans.value = loadPlans(p.manifest.packId);
    plannerInitialState.value = null;
    selectedKeyHash.value = filteredItems.value[0]?.keyHash ?? null;

    // 等待 DOM 渲染（v-else 切换显示列表）
    loading.value = false;
    await nextTick();
    recomputePageSize();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    loading.value = false;
  }
}

const currentItemKey = computed<ItemKey | null>(
  () => navStack.value[navStack.value.length - 1] ?? null,
);

const currentItemDef = computed<ItemDef | null>(() => {
  const key = currentItemKey.value;
  if (!key) return null;
  const h = itemKeyHash(key);
  return index.value?.itemsByKeyHash.get(h) ?? null;
});

const currentItemTitle = computed(() => {
  const def = currentItemDef.value;
  const key = currentItemKey.value;
  if (def) return `${def.name} (${def.key.id})`;
  if (!key) return '';
  return key.id;
});

const recipesById = computed(() => index.value?.recipesById ?? new Map());
const recipeTypesByKey = computed(() => index.value?.recipeTypesByKey ?? new Map());

const producingRecipeIds = computed(() => {
  if (!index.value || !currentItemKey.value) return [];
  return recipesProducingItem(index.value, currentItemKey.value);
});

const consumingRecipeIds = computed(() => {
  if (!index.value || !currentItemKey.value) return [];
  return recipesConsumingItem(index.value, currentItemKey.value);
});

watch(
  activeTab,
  (t) => {
    if (t === 'recipes' || t === 'uses') lastRecipeTab.value = t;
  },
  { immediate: true },
);

const activeRecipeIds = computed(() => {
  return lastRecipeTab.value === 'recipes' ? producingRecipeIds.value : consumingRecipeIds.value;
});

type RecipeGroup = { typeKey: string; label: string; recipeIds: string[] };

const activeRecipeGroups = computed<RecipeGroup[]>(() => {
  const map = new Map<string, string[]>();
  activeRecipeIds.value.forEach((rid) => {
    const r = recipesById.value.get(rid);
    if (!r) return;
    const list = map.get(r.type) ?? [];
    list.push(rid);
    map.set(r.type, list);
  });

  const groups = Array.from(map.entries()).map(([typeKey, recipeIds]) => {
    const label = recipeTypesByKey.value.get(typeKey)?.displayName ?? typeKey;
    return { typeKey, label, recipeIds };
  });
  groups.sort((a, b) => a.label.localeCompare(b.label));
  return groups;
});

const preferredRecipeTypeKey = computed(() => {
  if (!index.value || !currentItemKey.value) return null;
  const rootHash = itemKeyHash(currentItemKey.value);
  const rid = plannerLiveState.value.selectedRecipeIdByItemKeyHash[rootHash];
  if (!rid) return null;
  const r = index.value.recipesById.get(rid);
  return r?.type ?? null;
});

const typeMachineIcons = computed(() => {
  const groups = (() => {
    const preferred = preferredRecipeTypeKey.value;
    if (!preferred) return activeRecipeGroups.value;
    if (!activeRecipeGroups.value.some((g) => g.typeKey === preferred))
      return activeRecipeGroups.value;
    return activeRecipeGroups.value.filter((g) => g.typeKey === preferred);
  })();

  return groups
    .map((g) => {
      const rt = recipeTypesByKey.value.get(g.typeKey);
      const machineItemId = rt?.machine?.id;
      if (!machineItemId) return null;
      return { typeKey: g.typeKey, machineItemId };
    })
    .filter((v): v is { typeKey: string; machineItemId: string } => !!v);
});

watch(
  () => [activeTab.value, currentItemKey.value, activeRecipeGroups.value] as const,
  () => {
    if (!activeRecipeGroups.value.length) {
      activeTypeKey.value = '';
      return;
    }
    if (
      !activeTypeKey.value ||
      !activeRecipeGroups.value.some((g) => g.typeKey === activeTypeKey.value)
    ) {
      const preferred = preferredRecipeTypeKey.value;
      if (preferred && activeRecipeGroups.value.some((g) => g.typeKey === preferred)) {
        activeTypeKey.value = preferred;
        return;
      }
      const first = activeRecipeGroups.value[0];
      if (first) activeTypeKey.value = first.typeKey;
    }
  },
  { immediate: true },
);

function openDialogByKeyHash(keyHash: string, tab: 'recipes' | 'uses' | 'planner' = 'recipes') {
  const def = index.value?.itemsByKeyHash.get(keyHash);
  if (!def) return;
  selectedKeyHash.value = keyHash;
  navStack.value = [def.key];
  activeTab.value = tab;
  plannerInitialState.value = null;
  dialogOpen.value = settingsStore.recipeViewMode === 'dialog';
  pushHistoryKeyHash(keyHash);
}

function openDialogByItemKey(key: ItemKey) {
  navStack.value = [...navStack.value, key];
  activeTab.value = 'recipes';
  plannerInitialState.value = null;
  pushHistoryKeyHash(itemKeyHash(key));
}

function goBackInDialog() {
  if (navStack.value.length <= 1) return;
  navStack.value = navStack.value.slice(0, -1);
}

function closeDialog() {
  dialogOpen.value = false;
  navStack.value = [];
}

function onKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName?.toLowerCase() ?? '';
  const isTyping =
    tag === 'input' || tag === 'textarea' || target?.getAttribute('contenteditable') === 'true';
  if (isTyping) return;

  const key = e.key;
  if (dialogOpen.value) {
    if (key === 'Escape') {
      e.preventDefault();
      closeDialog();
      return;
    }
    if (key === 'Backspace') {
      e.preventDefault();
      goBackInDialog();
      return;
    }
    if (key === 'r' || key === 'R') {
      e.preventDefault();
      activeTab.value = 'recipes';
      return;
    }
    if (key === 'u' || key === 'U') {
      e.preventDefault();
      activeTab.value = 'uses';
      return;
    }
    if (key === 'p' || key === 'P') {
      e.preventDefault();
      activeTab.value = 'planner';
      return;
    }
    return;
  }

  if (!hoveredKeyHash.value) return;
  if (key === 'r' || key === 'R') {
    e.preventDefault();
    openDialogByKeyHash(hoveredKeyHash.value, 'recipes');
  } else if (key === 'u' || key === 'U') {
    e.preventDefault();
    openDialogByKeyHash(hoveredKeyHash.value, 'uses');
  } else if (key === 'p' || key === 'P') {
    e.preventDefault();
    openDialogByKeyHash(hoveredKeyHash.value, 'planner');
  } else if (key === 'a' || key === 'A') {
    e.preventDefault();
    toggleFavorite(hoveredKeyHash.value);
  }
}

function favoritesStorageKey(packId: string) {
  return `jei.favorites.${packId}`;
}

function plansStorageKey(packId: string) {
  return `jei.plans.${packId}`;
}

function loadPlans(packId: string): SavedPlan[] {
  const raw = localStorage.getItem(plansStorageKey(packId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => {
        if (!v || typeof v !== 'object') return null;
        const obj = v as Record<string, unknown>;
        const id = typeof obj.id === 'string' ? obj.id : '';
        const name = typeof obj.name === 'string' ? obj.name : '';
        const rootItemKey = obj.rootItemKey as ItemKey | undefined;
        const rootKeyHash = typeof obj.rootKeyHash === 'string' ? obj.rootKeyHash : '';
        const targetAmount =
          typeof obj.targetAmount === 'number' ? obj.targetAmount : Number(obj.targetAmount);
        const selectedRecipeIdByItemKeyHash =
          (obj.selectedRecipeIdByItemKeyHash as Record<string, string> | undefined) ?? {};
        const selectedItemIdByTagId =
          (obj.selectedItemIdByTagId as Record<string, string> | undefined) ?? {};
        const createdAt = typeof obj.createdAt === 'number' ? obj.createdAt : 0;
        if (!id || !name || !rootItemKey?.id || !rootKeyHash || !Number.isFinite(targetAmount))
          return null;
        return {
          id,
          name,
          rootItemKey,
          rootKeyHash,
          targetAmount,
          selectedRecipeIdByItemKeyHash,
          selectedItemIdByTagId,
          createdAt,
        } satisfies SavedPlan;
      })
      .filter((p): p is SavedPlan => !!p)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function savePlans(packId: string, plans: SavedPlan[]) {
  localStorage.setItem(plansStorageKey(packId), JSON.stringify(plans));
}

function newPlanId() {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `plan_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function onPlannerStateChange(s: PlannerLiveState) {
  plannerLiveState.value = s;
}

function savePlannerPlan(payload: PlannerSavePayload) {
  const packId = pack.value?.manifest.packId ?? 'default';
  const plan: SavedPlan = {
    id: newPlanId(),
    name: payload.name,
    rootItemKey: payload.rootItemKey,
    rootKeyHash: itemKeyHash(payload.rootItemKey),
    targetAmount: payload.targetAmount,
    selectedRecipeIdByItemKeyHash: payload.selectedRecipeIdByItemKeyHash,
    selectedItemIdByTagId: payload.selectedItemIdByTagId,
    createdAt: Date.now(),
  };
  const next = [plan, ...savedPlans.value];
  savedPlans.value = next;
  savePlans(packId, next);
}

function openSavedPlan(p: SavedPlan) {
  selectedKeyHash.value = p.rootKeyHash;
  navStack.value = [p.rootItemKey];
  activeTab.value = 'planner';
  plannerInitialState.value = {
    loadKey: `${p.id}:${Date.now()}`,
    targetAmount: p.targetAmount,
    selectedRecipeIdByItemKeyHash: p.selectedRecipeIdByItemKeyHash,
    selectedItemIdByTagId: p.selectedItemIdByTagId,
  };
  dialogOpen.value = settingsStore.recipeViewMode === 'dialog';
  pushHistoryKeyHash(p.rootKeyHash);
}

function deleteSavedPlan(id: string) {
  const packId = pack.value?.manifest.packId ?? 'default';
  const next = savedPlans.value.filter((p) => p.id !== id);
  savedPlans.value = next;
  savePlans(packId, next);
}

function loadFavorites(packId: string): Set<string> {
  const raw = localStorage.getItem(favoritesStorageKey(packId));
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v) => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveFavorites(packId: string, fav: Set<string>) {
  localStorage.setItem(favoritesStorageKey(packId), JSON.stringify(Array.from(fav)));
}

function isFavorite(keyHash: string) {
  return favorites.value.has(keyHash);
}

function toggleFavorite(keyHash: string) {
  const packId = pack.value?.manifest.packId ?? 'default';
  const next = new Set(favorites.value);
  if (next.has(keyHash)) next.delete(keyHash);
  else next.add(keyHash);
  favorites.value = next;
  saveFavorites(packId, next);
}

function pushHistoryKeyHash(keyHash: string) {
  // 保持历史记录多一点，展示的时候再截断
  const next = [keyHash, ...historyKeyHashes.value.filter((k) => k !== keyHash)].slice(0, 100);
  historyKeyHashes.value = next;
}

function parseSearch(input: string): ParsedSearch {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const out: ParsedSearch = { text: [], itemId: [], gameId: [], tag: [] };

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!t) continue;
    if (!t.startsWith('@')) {
      out.text.push(t.toLowerCase());
      continue;
    }

    const raw = t.slice(1);
    const [nameRaw, valueInline] = splitDirective(raw);
    const name = nameRaw.toLowerCase();
    let value: string | undefined = valueInline || undefined;

    const next = tokens[i + 1];
    if (!value && next && !next.startsWith('@')) {
      value = next;
      i += 1;
    }

    const v = (value ?? '').trim();
    if (!v) continue;

    if (name === 'itemid' || name === 'id') out.itemId.push(v.toLowerCase());
    else if (name === 'gameid' || name === 'game') out.gameId.push(v.toLowerCase());
    else if (name === 'tag' || name === 't') out.tag.push(v.toLowerCase());
    else {
      out.tag.push(raw.toLowerCase());
    }
  }

  return out;
}

function splitDirective(raw: string): [string, string] {
  const idx = raw.search(/[:=]/);
  if (idx < 0) return [raw, ''];
  return [raw.slice(0, idx), raw.slice(idx + 1)];
}

function matchesSearch(def: ItemDef, search: ParsedSearch): boolean {
  const name = (def.name ?? '').toLowerCase();
  const id = def.key.id.toLowerCase();

  for (const t of search.text) {
    if (!name.includes(t)) return false;
  }
  for (const t of search.itemId) {
    if (!id.includes(t)) return false;
  }
  for (const t of search.gameId) {
    const gid = (id.includes(':') ? id.split(':')[0] : id.split('.')[0]) ?? '';
    if (!gid.includes(t)) return false;
  }
  for (const t of search.tag) {
    const tagId = normalizeSearchTagId(t);
    if (!tagId) return false;
    const tags = index.value?.tagIdsByItemId.get(def.key.id);
    if (!tags?.has(tagId)) return false;
  }
  return true;
}

function normalizeSearchTagId(raw: string): string {
  const s = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!s) return '';
  if (s.includes(':')) return s;
  const ns = pack.value?.manifest.gameId ?? 'minecraft';
  return `${ns}:${s}`;
}
</script>

<style scoped>
.jei-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 !important;
  min-height: 0;
}

.jei-root {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 320px 1fr 380px;
  gap: 12px;
  align-items: stretch;
  padding: 12px;
  padding-bottom: 0;
}

.jei-fav {
  height: 100%;
  min-height: 0;
}

.jei-list {
  height: 100%;
  min-height: 0;
}

.jei-list__head {
  padding: 12px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.jei-list__scroll {
  padding: 10px;
  overflow: hidden;
  min-height: 0;
}

.jei-plans__head {
  padding: 2px 2px 6px 2px;
  font-weight: 600;
}

.jei-plans__list {
  padding: 0;
}

.jei-plans__item :deep(.q-item__section--avatar) {
  min-width: 38px;
}

.jei-debug .jei-list__scroll {
  overflow: auto;
}

.jei-list__history {
  padding: 10px;
  background: #f3f4f6;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.jei-list__history-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}

.jei-history-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.jei-history-grid__cell {
  padding: 8px;
}

.jei-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.jei-grid__cell {
  box-sizing: border-box;
  padding: 8px;
  position: relative;
}

.jei-grid__fav {
  position: absolute;
  top: 4px;
  right: 4px;
}

.jei-grid__cell-body {
  min-width: 0;
}

.jei-grid__cell.placeholder {
  border: 1px dashed rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.02);
}

.jei-debug-overlay {
  position: fixed;
  right: 10px;
  bottom: 80px;
  z-index: 9999;
  max-width: 320px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  color: #fff;
  background: rgba(0, 0, 0, 0.75);
  font-size: 12px;
  line-height: 1.25;
  white-space: pre-wrap;
  pointer-events: none;
}

.jei-panel {
  padding: 12px;
  height: 100%;
  min-height: 0;
}

.jei-panel__head {
  padding-bottom: 8px;
}

.jei-panel__tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
}

.jei-panel__body {
  min-height: 0;
  overflow: auto;
}

.jei-panel__panels {
  min-height: 0;
}

.jei-bottombar {
  flex: 0 0 auto;
  z-index: 10;
  padding: 12px 16px;
  background: white;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.jei-dialog {
  width: min(1800px, calc(100dvw - 32px));
  max-width: calc(100dvw - 32px);
  height: min(86vh, 960px);
  display: flex;
  flex-direction: column;
}

:deep(.jei-dialog-content) {
  padding: 0 !important;
}

.jei-dialog__head {
  padding: 10px 10px 6px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.jei-dialog__title {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jei-dialog__tabs {
  padding: 0 14px 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.jei-dialog__hint {
  margin-left: auto;
  opacity: 0.75;
}

.jei-dialog__body {
  flex: 1 1 auto;
}

.jei-dialog__type-tabs {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.jei-type-layout {
  display: flex;
  min-height: 0;
}

.jei-type-sidebar {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 6px 8px 10px;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
}

.jei-type-sidebar__btn {
  padding: 0;
  min-height: 0;
  border-radius: 8px;
}

.jei-type-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.jei-list__pager {
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}
</style>
