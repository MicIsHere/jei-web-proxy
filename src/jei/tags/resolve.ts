import type { ItemDef, ItemId, PackData, TagDef, TagValue, TagValueObject } from 'src/jei/types';

export function normalizeTagId(tagId: string, defaultNamespace: string): string {
  const t = tagId.startsWith('#') ? tagId.slice(1) : tagId;
  if (!t) return '';
  if (t.includes(':')) return t;
  return `${defaultNamespace}:${t}`;
}

export interface TagIndex {
  itemIdsByTagId: Map<string, Set<ItemId>>;
  tagIdsByItemId: Map<ItemId, Set<string>>;
}

function addTagToItem(tagIdsByItemId: Map<ItemId, Set<string>>, itemId: ItemId, tagId: string): void {
  const set = tagIdsByItemId.get(itemId) ?? new Set<string>();
  set.add(tagId);
  tagIdsByItemId.set(itemId, set);
}

function addItemToTag(itemIdsByTagId: Map<string, Set<ItemId>>, tagId: string, itemId: ItemId): void {
  const set = itemIdsByTagId.get(tagId) ?? new Set<ItemId>();
  set.add(itemId);
  itemIdsByTagId.set(tagId, set);
}

function isObjectValue(v: TagValue): v is TagValueObject {
  return typeof v !== 'string';
}

function valueId(v: TagValue): { id: string; required: boolean } {
  if (isObjectValue(v)) return { id: v.id, required: v.required !== false };
  return { id: v, required: true };
}

export function buildTagIndex(pack: PackData): TagIndex {
  const defaultNs = pack.manifest.gameId;

  const knownItemIds = new Set<ItemId>();
  pack.items.forEach((it) => knownItemIds.add(it.key.id));

  const itemIdsByTagId = new Map<string, Set<ItemId>>();
  const tagIdsByItemId = new Map<ItemId, Set<string>>();

  const addItemDefTags = (it: ItemDef) => {
    (it.tags ?? []).forEach((raw) => {
      const tagId = normalizeTagId(raw, defaultNs);
      if (!tagId) return;
      addItemToTag(itemIdsByTagId, tagId, it.key.id);
      addTagToItem(tagIdsByItemId, it.key.id, tagId);
    });
  };
  pack.items.forEach(addItemDefTags);

  const tagDefs = pack.tags?.item ?? {};
  const resolved = new Map<string, Set<ItemId>>();
  const invalid = new Set<string>();
  const visiting = new Set<string>();

  const resolveTag = (rawTagId: string): Set<ItemId> => {
    const tagId = normalizeTagId(rawTagId, defaultNs);
    if (!tagId) return new Set();
    if (invalid.has(tagId)) return new Set();
    const cached = resolved.get(tagId);
    if (cached) return cached;
    if (visiting.has(tagId)) {
      invalid.add(tagId);
      return new Set();
    }

    const def: TagDef | undefined = tagDefs[tagId];
    if (!def) {
      invalid.add(tagId);
      return new Set();
    }

    visiting.add(tagId);
    const set = new Set<ItemId>();
    for (const v of def.values) {
      const { id, required } = valueId(v);
      if (typeof id !== 'string' || !id) {
        invalid.add(tagId);
        visiting.delete(tagId);
        return new Set();
      }

      if (id.startsWith('#')) {
        const refId = normalizeTagId(id, defaultNs);
        const ref = resolveTag(refId);
        if (invalid.has(refId)) {
          invalid.add(tagId);
          visiting.delete(tagId);
          return new Set();
        }
        ref.forEach((itemId) => set.add(itemId));
        continue;
      }

      const itemId: ItemId = id;
      if (!knownItemIds.has(itemId)) {
        if (required) {
          invalid.add(tagId);
          visiting.delete(tagId);
          return new Set();
        }
        continue;
      }
      set.add(itemId);
    }

    visiting.delete(tagId);
    resolved.set(tagId, set);
    return set;
  };

  Object.keys(tagDefs).forEach((tagId) => resolveTag(tagId));

  resolved.forEach((items, tagId) => {
    items.forEach((itemId) => {
      addItemToTag(itemIdsByTagId, tagId, itemId);
      addTagToItem(tagIdsByItemId, itemId, tagId);
    });
  });

  return { itemIdsByTagId, tagIdsByItemId };
}
