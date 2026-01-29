<template>
  <div class="slot-layout">
    <div class="slot-layout__grid" :style="gridStyle">
      <div
        v-for="s in slots"
        :key="s.slotId"
        class="slot-layout__cell"
        :style="cellStyle(s.x, s.y)"
      >
        <q-card flat bordered class="slot-layout__slot">
          <div class="slot-layout__slot-head">
            <div class="slot-layout__slot-label">{{ s.label || s.slotId }}</div>
            <q-badge
              v-if="s.io"
              :color="s.io === 'output' ? 'positive' : s.io === 'catalyst' ? 'warning' : 'primary'"
              class="slot-layout__slot-io"
            >
              {{ s.io }}
            </q-badge>
          </div>
          <div class="slot-layout__slot-body">
            <stack-view
              :content="recipe.slotContents[s.slotId]"
              :item-defs-by-key-hash="itemDefsByKeyHash"
              @item-click="emit('item-click', $event)"
            />
          </div>
        </q-card>
      </div>
    </div>
    <recipe-params-view :recipe="recipe" :recipe-type="recipeType" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ItemDef, ItemKey, Recipe, RecipeTypeDef, SlotDef } from 'src/jei/types';
import StackView from './StackView.vue';
import RecipeParamsView from './RecipeParamsView.vue';

const props = defineProps<{
  recipe: Recipe;
  recipeType: RecipeTypeDef;
  itemDefsByKeyHash: Record<string, ItemDef>;
}>();

const emit = defineEmits<{
  (e: 'item-click', itemKey: ItemKey): void;
}>();

const slots = computed<SlotDef[]>(() => props.recipeType.slots ?? []);

const gridStyle = computed(() => {
  const maxX = slots.value.reduce((m, s) => Math.max(m, s.x), 0);
  const maxY = slots.value.reduce((m, s) => Math.max(m, s.y), 0);
  return {
    gridTemplateColumns: `repeat(${maxX + 1}, minmax(160px, 1fr))`,
    gridTemplateRows: `repeat(${maxY + 1}, auto)`,
  };
});

function cellStyle(x: number, y: number) {
  return {
    gridColumn: `${x + 1} / ${x + 2}`,
    gridRow: `${y + 1} / ${y + 2}`,
  };
}
</script>

<style scoped>
.slot-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slot-layout__grid {
  display: grid;
  gap: 10px;
}

.slot-layout__slot {
  padding: 10px;
}

.slot-layout__slot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.slot-layout__slot-label {
  font-size: 12px;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}

.slot-layout__slot-io {
  font-size: 10px;
}
</style>
