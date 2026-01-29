import type { ItemId, ItemKey } from 'src/jei/types';

export type PlannerSavePayload = {
  name: string;
  rootItemKey: ItemKey;
  targetAmount: number;
  selectedRecipeIdByItemKeyHash: Record<string, string>;
  selectedItemIdByTagId: Record<string, ItemId>;
};

export type PlannerInitialState = {
  loadKey: string;
  targetAmount: number;
  selectedRecipeIdByItemKeyHash: Record<string, string>;
  selectedItemIdByTagId: Record<string, ItemId>;
};

export type PlannerLiveState = {
  targetAmount: number;
  selectedRecipeIdByItemKeyHash: Record<string, string>;
  selectedItemIdByTagId: Record<string, ItemId>;
};
