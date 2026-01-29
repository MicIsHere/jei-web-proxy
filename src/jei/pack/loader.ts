import type { ItemDef, PackData, PackManifest, PackTags, Recipe, RecipeTypeDef } from 'src/jei/types';
import { stableJsonStringify } from 'src/jei/utils/stableJson';
import { assertItemDef, assertPackManifest, assertPackTags, assertRecipe, assertRecipeTypeDef } from './validate';

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to fetch ${url} (${res.status}): ${body || res.statusText}`);
  }
  return res.json();
}

function packBaseUrl(packId: string): string {
  const safe = encodeURIComponent(packId);
  return `/packs/${safe}`;
}

function itemKeyHash(def: { key: { id: string; meta?: number | string; nbt?: unknown } }): string {
  return `${def.key.id}::${def.key.meta ?? ''}::${stableJsonStringify(def.key.nbt ?? null)}`;
}

function mergeInlineItems(items: ItemDef[], recipes: Recipe[]): ItemDef[] {
  const byHash = new Map<string, ItemDef>();
  items.forEach((it) => byHash.set(itemKeyHash(it), it));
  recipes.forEach((r) => {
    r.inlineItems?.forEach((it) => {
      const key = itemKeyHash(it);
      if (!byHash.has(key)) byHash.set(key, it);
    });
  });
  return Array.from(byHash.values());
}

async function loadManifest(packId: string): Promise<PackManifest> {
  const base = packBaseUrl(packId);
  const raw = await fetchJson(`${base}/manifest.json`);
  const manifest = assertPackManifest(raw, '$.manifest');
  if (manifest.packId !== packId) {
    throw new Error(`packId mismatch: requested "${packId}", manifest has "${manifest.packId}"`);
  }
  return manifest;
}

async function loadItems(base: string, manifest: PackManifest): Promise<ItemDef[]> {
  if (!manifest.files.items) return [];
  const raw = await fetchJson(`${base}/${manifest.files.items}`);
  if (!Array.isArray(raw)) {
    throw new Error('$.items: expected array');
  }
  return raw.map((v, i) => assertItemDef(v, `$.items[${i}]`));
}

async function loadRecipeTypes(base: string, manifest: PackManifest): Promise<RecipeTypeDef[]> {
  const raw = await fetchJson(`${base}/${manifest.files.recipeTypes}`);
  if (!Array.isArray(raw)) {
    throw new Error('$.recipeTypes: expected array');
  }
  return raw.map((v, i) => assertRecipeTypeDef(v, `$.recipeTypes[${i}]`));
}

async function loadRecipes(base: string, manifest: PackManifest): Promise<Recipe[]> {
  const raw = await fetchJson(`${base}/${manifest.files.recipes}`);
  if (!Array.isArray(raw)) {
    throw new Error('$.recipes: expected array');
  }
  return raw.map((v, i) => assertRecipe(v, `$.recipes[${i}]`));
}

async function loadTags(base: string, manifest: PackManifest): Promise<PackTags | undefined> {
  if (!manifest.files.tags) return undefined;
  const raw = await fetchJson(`${base}/${manifest.files.tags}`);
  return assertPackTags(raw, '$.tags');
}

export async function loadPack(packId: string): Promise<PackData> {
  const base = packBaseUrl(packId);
  const manifest = await loadManifest(packId);

  const [items, tags, recipeTypes, recipes] = await Promise.all([
    loadItems(base, manifest),
    loadTags(base, manifest),
    loadRecipeTypes(base, manifest),
    loadRecipes(base, manifest),
  ]);

  const out: PackData = {
    manifest,
    items: mergeInlineItems(items, recipes),
    recipeTypes,
    recipes,
  };
  if (tags !== undefined) out.tags = tags;
  return out;
}
