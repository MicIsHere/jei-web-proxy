<template>
  <div v-if="displayParams.length" class="params-view">
    <q-chip
      v-for="p in displayParams"
      :key="p.key"
      dense
      square
      color="grey-2"
      text-color="grey-10"
      class="params-view__chip"
    >
      <span class="params-view__label">{{ p.label }}:</span>
      <span class="params-view__value">{{ p.value }}</span>
    </q-chip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Recipe, RecipeTypeDef } from 'src/jei/types';

const props = defineProps<{
  recipe: Recipe;
  recipeType: RecipeTypeDef;
}>();

type DisplayParam = { key: string; label: string; value: string };

const displayParams = computed<DisplayParam[]>(() => {
  const schema = props.recipeType.paramSchema ?? {};
  const defaults = props.recipeType.defaults ?? {};
  const params = props.recipe.params ?? {};

  return Object.entries(schema).map(([key, def]) => {
    if (!def) return undefined;
    const rawValue = params[key] ?? defaults[key] ?? def.default;
    if (rawValue === undefined || rawValue === null) return undefined;
    const formatted = formatValue(rawValue, def.format, def.unit);
    return { key, label: def.displayName, value: formatted };
  }).filter((v): v is DisplayParam => v !== undefined);
});

function formatValue(value: unknown, format?: string, unit?: string): string {
  if (typeof value === 'number') {
    if (format === 'integer') return `${Math.round(value)}${unit ?? ''}`;
    if (format === 'percent') return `${(value * 100).toFixed(0)}%`;
    if (format === 'duration') return `${value}${unit ?? 't'}`;
    return `${value}${unit ?? ''}`;
  }
  if (typeof value === 'string') return unit ? `${value}${unit}` : value;
  return unit ? `${JSON.stringify(value)}${unit}` : JSON.stringify(value);
}
</script>

<style scoped>
.params-view {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.params-view__chip {
  margin: 0;
}

.params-view__label {
  margin-right: 4px;
  opacity: 0.75;
}
</style>
