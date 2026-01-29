<template>
  <q-page class="jei-page q-pa-md">
    <div v-if="error" class="text-negative">{{ error }}</div>
    <div v-else-if="loading" class="row items-center q-gutter-sm">
      <q-spinner size="20px" />
      <div>Loading…</div>
    </div>

    <div v-else class="jei-root">
      <q-card flat bordered class="jei-fav">
        <div class="jei-list__head">
          <div class="text-subtitle2">收藏夹</div>
          <div class="text-caption">A：取消收藏</div>
        </div>

        <div class="jei-list__scroll">
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

      <q-card flat bordered class="jei-panel">
        <div class="text-subtitle2">中间区域</div>
        <div class="text-caption">右侧是物品列表，左侧是收藏夹；点击物品打开悬浮窗。</div>
      </q-card>

      <q-card flat bordered class="jei-list">
        <div class="jei-list__head">
          <div class="text-subtitle2">物品列表</div>
          <div class="text-caption">pack: demo</div>
        </div>

        <div class="jei-list__scroll">
          <div class="jei-grid">
            <q-card
              v-for="it in filteredItems"
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

        <div class="jei-list__history">
          <div class="jei-list__history-title">历史</div>
          <div v-if="historyItems.length" class="jei-history-grid">
            <q-card
              v-for="it in historyItems"
              :key="it.keyHash"
              flat
              bordered
              class="jei-history-grid__cell cursor-pointer"
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
          </div>
          <div v-else class="text-caption text-grey-7">暂无历史</div>
        </div>
      </q-card>
    </div>

    <div class="jei-bottombar">
      <q-input
        v-model="filterText"
        dense
        outlined
        clearable
        :disable="filterDisabled"
        placeholder="输入名字过滤…"
      />
    </div>

    <q-dialog v-model="dialogOpen">
      <q-card class="jei-dialog">
        <div class="jei-dialog__head">
          <div class="jei-dialog__title">
            {{ currentItemTitle }}
          </div>
          <q-btn flat round icon="close" @click="closeDialog" />
        </div>

        <div class="jei-dialog__tabs">
          <q-btn
            dense
            outline
            :color="activeTab === 'recipes' ? 'primary' : 'grey-7'"
            label="Recipes (R)"
            @click="activeTab = 'recipes'"
          />
          <q-btn
            dense
            outline
            :color="activeTab === 'uses' ? 'primary' : 'grey-7'"
            label="Uses (U)"
            @click="activeTab = 'uses'"
          />
          <div class="jei-dialog__hint text-caption">Backspace: 返回 · Esc: 关闭</div>
        </div>

        <q-separator />

        <q-scroll-area class="jei-dialog__body">
          <div v-if="activeRecipeGroups.length" class="jei-dialog__type-tabs">
            <q-tabs
              v-if="activeRecipeGroups.length > 1"
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
            <q-separator v-if="activeRecipeGroups.length > 1" />

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
          <div v-else class="q-pa-md text-caption">没有找到相关配方。</div>
        </q-scroll-area>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
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
import { itemKeyHash } from 'src/jei/indexing/key';

const loading = ref(true);
const error = ref('');

const pack = ref<PackData | null>(null);
const index = ref<JeiIndex | null>(null);

const selectedKeyHash = ref<string | null>(null);
const hoveredKeyHash = ref<string | null>(null);
const filterText = ref('');
const favorites = ref<Set<string>>(new Set());
const historyKeyHashes = ref<string[]>([]);

const filterDisabled = computed(() => loading.value || !!error.value);

const dialogOpen = ref(false);
const navStack = ref<ItemKey[]>([]);
const activeTab = ref<'recipes' | 'uses'>('recipes');
const activeTypeKey = ref('');

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
    const af = favorites.value.has(a.keyHash) ? 1 : 0;
    const bf = favorites.value.has(b.keyHash) ? 1 : 0;
    if (af !== bf) return bf - af;
    return a.def.name.localeCompare(b.def.name);
  });
  return filtered;
});

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
  return historyKeyHashes.value
    .map((keyHash) => {
      const def = map.get(keyHash);
      if (!def) return null;
      return { keyHash, def };
    })
    .filter((v): v is { keyHash: string; def: ItemDef } => v !== null);
});

onMounted(async () => {
  try {
    loading.value = true;
    const p = await loadPack('demo');
    pack.value = p;
    index.value = buildJeiIndex(p);
    favorites.value = loadFavorites(p.manifest.packId);
    selectedKeyHash.value = filteredItems.value[0]?.keyHash ?? null;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }

  window.addEventListener('keydown', onKeyDown, true);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown, true);
});

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

const activeRecipeIds = computed(() =>
  activeTab.value === 'recipes' ? producingRecipeIds.value : consumingRecipeIds.value,
);

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

watch(
  () => [activeTab.value, currentItemKey.value, activeRecipeGroups.value] as const,
  () => {
    if (!activeRecipeGroups.value.length) {
      activeTypeKey.value = '';
      return;
    }
    if (!activeRecipeGroups.value.some((g) => g.typeKey === activeTypeKey.value)) {
      const first = activeRecipeGroups.value[0];
      if (first) activeTypeKey.value = first.typeKey;
    }
  },
  { immediate: true },
);

function openDialogByKeyHash(keyHash: string, tab: 'recipes' | 'uses' = 'recipes') {
  const def = index.value?.itemsByKeyHash.get(keyHash);
  if (!def) return;
  selectedKeyHash.value = keyHash;
  navStack.value = [def.key];
  activeTab.value = tab;
  dialogOpen.value = true;
  pushHistoryKeyHash(keyHash);
}

function openDialogByItemKey(key: ItemKey) {
  navStack.value = [...navStack.value, key];
  activeTab.value = 'recipes';
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
    return;
  }

  if (!hoveredKeyHash.value) return;
  if (key === 'r' || key === 'R') {
    e.preventDefault();
    openDialogByKeyHash(hoveredKeyHash.value, 'recipes');
  } else if (key === 'u' || key === 'U') {
    e.preventDefault();
    openDialogByKeyHash(hoveredKeyHash.value, 'uses');
  } else if (key === 'a' || key === 'A') {
    e.preventDefault();
    toggleFavorite(hoveredKeyHash.value);
  }
}

function favoritesStorageKey(packId: string) {
  return `jei.favorites.${packId}`;
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
  const next = [keyHash, ...historyKeyHashes.value.filter((k) => k !== keyHash)].slice(0, 12);
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
    const gid = id.split('.')[0] ?? '';
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
.jei-root {
  display: grid;
  grid-template-columns: 320px 1fr 380px;
  gap: 12px;
  align-items: start;
}

.jei-fav {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 140px);
}

.jei-list {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 140px);
}

.jei-list__head {
  padding: 12px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.jei-list__scroll {
  flex: 1 1 auto;
  min-height: 0;
  padding: 10px;
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

.jei-panel {
  padding: 12px;
  min-height: calc(100vh - 140px);
}

.jei-bottombar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  padding: 12px 16px;
  background: white;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.jei-dialog {
  width: min(1100px, 92vw);
  height: min(82vh, 900px);
  display: flex;
  flex-direction: column;
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
  min-height: 100%;
}
</style>
