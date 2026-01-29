import type { ItemId, ItemKey, PackData, Recipe, RecipeTypeDef, SlotContent, SlotDef, Stack, StackItem, StackTag } from 'src/jei/types';
import type { JeiIndex } from 'src/jei/indexing/buildIndex';
import { recipesProducingItem } from 'src/jei/indexing/buildIndex';
import { itemKeyHash } from 'src/jei/indexing/key';
import { normalizeTagId } from 'src/jei/tags/resolve';

export type PlannerDecision =
  | {
    kind: 'item_recipe';
    itemKey: ItemKey;
    itemKeyHash: string;
    recipeOptions: string[];
  }
  | {
    kind: 'tag_item';
    tagId: string;
    candidateItemIds: ItemId[];
  };

export type RequirementNode =
  | {
    kind: 'item';
    nodeId: string;
    itemKey: ItemKey;
    amount: number;
    unit?: string;
    recipeIdUsed?: string;
    recipeTypeKeyUsed?: string;
    machineItemId?: ItemId;
    machineName?: string;
    children: RequirementNode[];
    catalysts: StackItem[];
    cycle: boolean;
    cycleSeed?: boolean;
  }
  | {
    kind: 'fluid';
    nodeId: string;
    id: string;
    amount: number;
    unit?: string;
  };

export interface BuildTreeResult {
  root: RequirementNode;
  leafItemTotals: Map<ItemId, number>;
  leafFluidTotals: Map<string, number>;
  catalysts: Map<ItemId, number>;
}

function asArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

function slotIoFallback(slotId: string): 'input' | 'output' {
  const id = slotId.toLowerCase();
  if (id.startsWith('out') || id.includes('output')) return 'output';
  return 'input';
}

function collectSlotDefsById(typeDef: RecipeTypeDef | undefined): Map<string, SlotDef> {
  const map = new Map<string, SlotDef>();
  typeDef?.slots?.forEach((s) => map.set(s.slotId, s));
  return map;
}

function finiteNumberOr(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function extractRecipeStacks(recipe: Recipe, recipeType: RecipeTypeDef | undefined): {
  inputs: Stack[];
  outputs: Stack[];
  catalysts: StackItem[];
} {
  const slotDefsById = collectSlotDefsById(recipeType);
  const inputs: Stack[] = [];
  const outputs: Stack[] = [];
  const catalysts: StackItem[] = [];

  for (const slotId of Object.keys(recipe.slotContents)) {
    const def = slotDefsById.get(slotId);
    const io = def?.io ?? slotIoFallback(slotId);
    const content: SlotContent = recipe.slotContents[slotId]!;
    const stacks = asArray<Stack>(content as Stack | Stack[]);

    if (io === 'output') outputs.push(...stacks);
    else if (io === 'catalyst') catalysts.push(...stacks.filter((s): s is StackItem => s.kind === 'item'));
    else inputs.push(...stacks);
  }

  return { inputs, outputs, catalysts };
}

function stackItemToKey(s: StackItem): ItemKey {
  const key: ItemKey = { id: s.id };
  if (s.meta !== undefined) key.meta = s.meta;
  if (s.nbt !== undefined) key.nbt = s.nbt;
  return key;
}

function stackMatchesKey(stack: StackItem, key: ItemKey): boolean {
  if (stack.id !== key.id) return false;
  if (key.meta !== undefined && stack.meta !== key.meta) return false;
  if (key.nbt !== undefined) {
    try {
      return JSON.stringify(stack.nbt) === JSON.stringify(key.nbt);
    } catch {
      return false;
    }
  }
  return true;
}

export function perCraftOutputAmountFor(recipe: Recipe, recipeType: RecipeTypeDef | undefined, itemKey: ItemKey): number {
  const { outputs } = extractRecipeStacks(recipe, recipeType);
  let total = 0;
  for (const s of outputs) {
    if (s.kind !== 'item') continue;
    if (!stackMatchesKey(s, itemKey)) continue;
    total += finiteNumberOr(s.amount, 0);
  }
  return total;
}

function perCraftInputAmountFor(recipe: Recipe, recipeType: RecipeTypeDef | undefined, itemKey: ItemKey): number {
  const { inputs } = extractRecipeStacks(recipe, recipeType);
  let total = 0;
  for (const s of inputs) {
    if (s.kind !== 'item') continue;
    if (!stackMatchesKey(s, itemKey)) continue;
    total += finiteNumberOr(s.amount, 0);
  }
  return total;
}

export function computePlannerDecisions(args: {
  pack: PackData;
  index: JeiIndex;
  rootItemKey: ItemKey;
  selectedRecipeIdByItemKeyHash: Map<string, string>;
  selectedItemIdByTagId: Map<string, ItemId>;
  maxDepth?: number;
}): PlannerDecision[] {
  const { pack, index, rootItemKey, selectedRecipeIdByItemKeyHash, selectedItemIdByTagId } = args;
  const maxDepth = args.maxDepth ?? 20;
  const defaultNs = pack.manifest.gameId;

  const decisions: PlannerDecision[] = [];
  const visiting = new Set<string>();

  const visitItem = (key: ItemKey, depth: number) => {
    if (depth > maxDepth) return;
    const h = itemKeyHash(key);
    if (visiting.has(h)) return;
    visiting.add(h);

    const options = recipesProducingItem(index, key);
    if (options.length > 1 && !selectedRecipeIdByItemKeyHash.has(h)) {
      decisions.push({ kind: 'item_recipe', itemKey: key, itemKeyHash: h, recipeOptions: options.slice() });
      visiting.delete(h);
      return;
    }

    const chosenRecipeId = selectedRecipeIdByItemKeyHash.get(h) ?? (options.length === 1 ? options[0] : undefined);
    if (!chosenRecipeId) {
      visiting.delete(h);
      return;
    }

    const recipe = index.recipesById.get(chosenRecipeId);
    if (!recipe) {
      visiting.delete(h);
      return;
    }

    const recipeType = index.recipeTypesByKey.get(recipe.type);
    const { inputs } = extractRecipeStacks(recipe, recipeType);
    for (const input of inputs) {
      if (input.kind === 'item') {
        visitItem(stackItemToKey(input), depth + 1);
      } else if (input.kind === 'tag') {
        visitTag(input, depth + 1);
      }
    }

    visiting.delete(h);
  };

  const visitTag = (tag: StackTag, depth: number) => {
    if (depth > maxDepth) return;
    const normalized = normalizeTagId(tag.id, defaultNs);
    const set = index.itemIdsByTagId.get(normalized);
    const candidates = set ? Array.from(set.values()).sort() : [];
    if (candidates.length === 0) {
      decisions.push({ kind: 'tag_item', tagId: normalized, candidateItemIds: [] });
      return;
    }
    if (candidates.length > 1 && !selectedItemIdByTagId.has(normalized)) {
      decisions.push({ kind: 'tag_item', tagId: normalized, candidateItemIds: candidates });
      return;
    }
    const chosen = selectedItemIdByTagId.get(normalized) ?? (candidates.length === 1 ? candidates[0] : undefined);
    if (!chosen) return;
    visitItem({ id: chosen }, depth + 1);
  };

  visitItem(rootItemKey, 0);
  return decisions;
}

export function buildRequirementTree(args: {
  pack: PackData;
  index: JeiIndex;
  rootItemKey: ItemKey;
  targetAmount: number;
  selectedRecipeIdByItemKeyHash: Map<string, string>;
  selectedItemIdByTagId: Map<string, ItemId>;
  maxDepth?: number;
}): BuildTreeResult {
  const { pack, index, rootItemKey, selectedRecipeIdByItemKeyHash, selectedItemIdByTagId } = args;
  const maxDepth = args.maxDepth ?? 20;
  const targetAmount = finiteNumberOr(args.targetAmount, 1);
  const defaultNs = pack.manifest.gameId;

  let seq = 0;
  const leafItemTotals = new Map<ItemId, number>();
  const leafFluidTotals = new Map<string, number>();
  const catalysts = new Map<ItemId, number>();

  const addLeafItem = (itemId: ItemId, amount: number) => {
    const prev = leafItemTotals.get(itemId) ?? 0;
    leafItemTotals.set(itemId, prev + amount);
  };
  const addLeafFluid = (fluidId: string, amount: number) => {
    const prev = leafFluidTotals.get(fluidId) ?? 0;
    leafFluidTotals.set(fluidId, prev + amount);
  };
  const addCatalyst = (itemId: ItemId, amount: number) => {
    const prev = catalysts.get(itemId) ?? 0;
    catalysts.set(itemId, Math.max(prev, amount));
  };

  const visiting = new Set<string>();
  const stackHashes: string[] = [];
  const stackKeys: ItemKey[] = [];

  const getChosenRecipe = (key: ItemKey) => {
    const h = itemKeyHash(key);
    const options = recipesProducingItem(index, key);
    const chosenRecipeId =
      selectedRecipeIdByItemKeyHash.get(h) ?? (options.length === 1 ? options[0] : undefined);
    if (!chosenRecipeId) return null;
    const recipe = index.recipesById.get(chosenRecipeId);
    if (!recipe) return null;
    const recipeType = index.recipeTypesByKey.get(recipe.type);
    return { chosenRecipeId, recipe, recipeType };
  };

  const buildForItem = (key: ItemKey, amountNeeded: number, depth: number): RequirementNode => {
    const nodeId = `n${(seq += 1)}`;
    if (depth > maxDepth) {
      addLeafItem(key.id, amountNeeded);
      return { kind: 'item', nodeId, itemKey: key, amount: amountNeeded, children: [], catalysts: [], cycle: false };
    }

    const h = itemKeyHash(key);
    if (visiting.has(h)) {
      const cycleStart = stackHashes.indexOf(h);
      const cycleKeys = cycleStart >= 0 ? stackKeys.slice(cycleStart) : [];
      const cycleFactor = (() => {
        if (!cycleKeys.length) return 0;
        let factor = 1;
        for (let i = 0; i < cycleKeys.length; i += 1) {
          const fromKey = cycleKeys[i]!;
          const toKey = (i + 1 < cycleKeys.length ? cycleKeys[i + 1] : cycleKeys[0])!;
          const chosen = getChosenRecipe(fromKey);
          if (!chosen) return 0;
          const out = perCraftOutputAmountFor(chosen.recipe, chosen.recipeType, fromKey);
          const inp = perCraftInputAmountFor(chosen.recipe, chosen.recipeType, toKey);
          if (out <= 0 || inp <= 0) return 0;
          factor *= out / inp;
        }
        return factor;
      })();

      const growth = cycleFactor > 1.000001;
      const seedFromPredecessor = (() => {
        if (!cycleKeys.length) return 0;
        const predecessorKey = cycleKeys[cycleKeys.length - 1]!;
        const chosen = getChosenRecipe(predecessorKey);
        if (!chosen) return 0;
        return perCraftInputAmountFor(chosen.recipe, chosen.recipeType, key);
      })();

      const chosenForNode = getChosenRecipe(key);
      const seedAmount =
        growth && seedFromPredecessor > 0 ? seedFromPredecessor : amountNeeded;

      addLeafItem(key.id, seedAmount);
      return {
        kind: 'item',
        nodeId,
        itemKey: key,
        amount: seedAmount,
        ...(chosenForNode ? { recipeIdUsed: chosenForNode.chosenRecipeId } : {}),
        ...(chosenForNode?.recipe.type ? { recipeTypeKeyUsed: chosenForNode.recipe.type } : {}),
        ...(chosenForNode?.recipeType?.machine?.id ? { machineItemId: chosenForNode.recipeType.machine.id } : {}),
        ...(chosenForNode?.recipeType?.machine?.name ? { machineName: chosenForNode.recipeType.machine.name } : {}),
        children: [],
        catalysts: [],
        cycle: true,
        ...(growth ? { cycleSeed: true } : {}),
      };
    }
    visiting.add(h);
    stackHashes.push(h);
    stackKeys.push(key);

    const options = recipesProducingItem(index, key);
    const chosenRecipeId = selectedRecipeIdByItemKeyHash.get(h) ?? (options.length === 1 ? options[0] : undefined);
    if (!chosenRecipeId) {
      addLeafItem(key.id, amountNeeded);
      visiting.delete(h);
      stackHashes.pop();
      stackKeys.pop();
      return { kind: 'item', nodeId, itemKey: key, amount: amountNeeded, children: [], catalysts: [], cycle: false };
    }

    const recipe = index.recipesById.get(chosenRecipeId);
    if (!recipe) {
      addLeafItem(key.id, amountNeeded);
      visiting.delete(h);
      stackHashes.pop();
      stackKeys.pop();
      return { kind: 'item', nodeId, itemKey: key, amount: amountNeeded, children: [], catalysts: [], cycle: false };
    }

    const recipeType = index.recipeTypesByKey.get(recipe.type);
    const perCraftYield = perCraftOutputAmountFor(recipe, recipeType, key);
    const multiplier = perCraftYield > 0 ? amountNeeded / perCraftYield : 0;

    const { inputs, catalysts: recipeCatalysts } = extractRecipeStacks(recipe, recipeType);
    recipeCatalysts.forEach((c) => addCatalyst(c.id, finiteNumberOr(c.amount, 0)));

    const children: RequirementNode[] = [];
    for (const input of inputs) {
      const needed = finiteNumberOr(input.amount, 0) * multiplier;
      if (needed <= 0) continue;

      if (input.kind === 'item') {
        children.push(buildForItem(stackItemToKey(input), needed, depth + 1));
      } else if (input.kind === 'tag') {
        const normalized = normalizeTagId(input.id, defaultNs);
        const set = index.itemIdsByTagId.get(normalized);
        const candidates = set ? Array.from(set.values()) : [];
        const chosen = selectedItemIdByTagId.get(normalized) ?? (candidates.length === 1 ? candidates[0] : undefined);
        if (!chosen) continue;
        children.push(buildForItem({ id: chosen }, needed, depth + 1));
      } else {
        addLeafFluid(input.id, needed);
        children.push({
          kind: 'fluid',
          nodeId: `n${(seq += 1)}`,
          id: input.id,
          amount: needed,
          ...(input.unit ? { unit: input.unit } : {}),
        });
      }
    }

    visiting.delete(h);
    stackHashes.pop();
    stackKeys.pop();
    return {
      kind: 'item',
      nodeId,
      itemKey: key,
      amount: amountNeeded,
      recipeIdUsed: chosenRecipeId,
      recipeTypeKeyUsed: recipe.type,
      ...(recipeType?.machine?.id ? { machineItemId: recipeType.machine.id } : {}),
      ...(recipeType?.machine?.name ? { machineName: recipeType.machine.name } : {}),
      children,
      catalysts: recipeCatalysts,
      cycle: false,
    };
  };

  const root = buildForItem(rootItemKey, targetAmount, 0);
  return { root, leafItemTotals, leafFluidTotals, catalysts };
}
