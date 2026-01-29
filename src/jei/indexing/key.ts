import type { ItemKey, ItemId, StackItem } from 'src/jei/types';
import { stableJsonStringify } from 'src/jei/utils/stableJson';

export function itemKeyHash(itemKey: ItemKey): string {
  return itemKeyHashFromParts(itemKey.id, itemKey.meta, itemKey.nbt);
}

export function itemKeyHashFromParts(id: ItemId, meta?: number | string, nbt?: unknown): string {
  return `${id}::${meta ?? ''}::${stableJsonStringify(nbt ?? null)}`;
}

export function stackItemToItemKey(stack: StackItem): ItemKey {
  const key: ItemKey = { id: stack.id };
  if (stack.meta !== undefined) key.meta = stack.meta;
  if (stack.nbt !== undefined) key.nbt = stack.nbt;
  return key;
}

export function isExactItemKey(itemKey: ItemKey): boolean {
  return itemKey.meta !== undefined || itemKey.nbt !== undefined;
}
