<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h4">Recipe Types</div>
      <q-space />
      <q-btn color="primary" icon="add" label="Add Type" @click="addType" />
    </div>

    <div class="row q-col-gutter-md">
      <!-- List -->
      <div class="col-12 col-md-3">
        <q-list bordered separator>
          <q-item
            v-for="(type, index) in store.recipeTypes"
            :key="index"
            clickable
            :active="selectedTypeIndex === index"
            @click="selectType(index)"
          >
            <q-item-section>
              <q-item-label>{{ type.displayName }}</q-item-label>
              <q-item-label caption>{{ type.key }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                @click.stop="deleteType(index)"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- Editor -->
      <div class="col-12 col-md-9" v-if="currentType">
        <q-card>
          <q-card-section>
            <div class="text-h6">Basic Info</div>
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <q-input v-model="currentType.key" label="Key" />
              </div>
              <div class="col-6">
                <q-input v-model="currentType.displayName" label="Display Name" />
              </div>
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-h6">Machines</div>
              <q-space />
              <q-btn size="sm" color="primary" icon="add" label="Add Machine" @click="addMachine" />
            </div>

            <div v-if="currentMachines.length > 0">
              <div
                v-for="(machine, idx) in currentMachines"
                :key="idx"
                class="row q-col-gutter-sm q-mb-sm items-center"
              >
                <div class="col-5">
                  <q-input v-model="machine.id" label="Machine ID" dense />
                </div>
                <div class="col-5">
                  <q-input v-model="machine.name" label="Machine Name" dense />
                </div>
                <div class="col-2 text-right">
                  <q-btn
                    flat
                    round
                    dense
                    icon="delete"
                    color="negative"
                    @click="removeMachine(idx)"
                  />
                </div>
              </div>
            </div>
            <div v-else class="text-grey q-pa-sm">No machines defined</div>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-h6">Param Schema</div>
              <q-space />
              <q-btn size="sm" color="primary" icon="add" label="Add Param" @click="addParam" />
            </div>

            <div
              v-for="(param, key) in currentType.paramSchema"
              :key="key"
              class="row q-col-gutter-sm q-mb-sm items-center"
            >
              <div class="col-3">
                <q-input
                  :model-value="key"
                  @update:model-value="(val) => updateParamKey(key, val as string)"
                  label="Key"
                  dense
                />
              </div>
              <div class="col-3">
                <q-input v-model="param.displayName" label="Display Name" dense />
              </div>
              <div class="col-2">
                <q-select
                  v-model="param.format"
                  :options="['number', 'integer', 'percent', 'duration']"
                  label="Format"
                  dense
                />
              </div>
              <div class="col-2">
                <q-input v-model="param.unit" label="Unit" dense />
              </div>
              <div class="col-2 text-right">
                <q-btn flat round dense icon="delete" color="negative" @click="deleteParam(key)" />
              </div>
            </div>
            <div
              v-if="!currentType.paramSchema || Object.keys(currentType.paramSchema).length === 0"
              class="text-grey q-pa-sm"
            >
              No parameters defined
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-h6">Defaults</div>
              <q-space />
              <q-btn size="sm" color="primary" icon="add" label="Add Default" @click="addDefault" />
            </div>

            <div
              v-for="(val, key) in currentType.defaults"
              :key="key"
              class="row q-col-gutter-sm q-mb-sm items-center"
            >
              <div class="col-4">
                <q-input
                  :model-value="key"
                  @update:model-value="(next) => updateDefaultKey(key, next as string)"
                  label="Key"
                  dense
                />
              </div>
              <div class="col-6">
                <q-input
                  v-if="typeof val === 'number'"
                  type="number"
                  :model-value="val"
                  @update:model-value="(next) => setDefaultValue(key, Number(next))"
                  label="Value"
                  dense
                />
                <q-toggle
                  v-else-if="typeof val === 'boolean'"
                  :model-value="val"
                  @update:model-value="(next) => setDefaultValue(key, next)"
                  label="Value"
                  dense
                />
                <q-input
                  v-else
                  :model-value="defaultValueToString(val)"
                  @update:model-value="
                    (next) => updateDefaultValueFromString(key, next as string, val)
                  "
                  label="Value"
                  dense
                />
              </div>
              <div class="col-2 text-right">
                <q-btn
                  flat
                  round
                  dense
                  icon="delete"
                  color="negative"
                  @click="deleteDefault(key)"
                />
              </div>
            </div>
            <div
              v-if="!currentType.defaults || Object.keys(currentType.defaults).length === 0"
              class="text-grey q-pa-sm"
            >
              No defaults defined
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-h6">Slots Layout</div>
              <q-space />
              <q-btn size="sm" color="primary" icon="add" label="Add Slot" @click="addSlot" />
            </div>

            <!-- Canvas -->
            <div
              class="slot-canvas relative-position"
              :class="$q.dark.isActive ? 'bg-dark-canvas' : 'bg-grey-3'"
              style="width: 100%; height: 300px; border: 1px solid #ccc; overflow: auto"
              @dragover.prevent
              @drop="onDrop"
            >
              <!-- Grid background hint -->
              <div class="grid-bg" :class="{ 'grid-bg-dark': $q.dark.isActive }"></div>

              <div
                v-for="(slot, idx) in currentType.slots"
                :key="idx"
                class="slot-item absolute flex flex-center"
                :class="{
                  'bg-primary text-white': selectedSlotIndex === idx,
                  'bg-white text-black': selectedSlotIndex !== idx && !$q.dark.isActive,
                  'bg-grey-8 text-white': selectedSlotIndex !== idx && $q.dark.isActive,
                }"
                :style="{
                  left: slot.x * 18 + 'px',
                  top: slot.y * 18 + 'px',
                  width: '18px',
                  height: '18px',
                  border: '1px solid #666',
                  cursor: 'move',
                  zIndex: selectedSlotIndex === idx ? 10 : 1,
                }"
                draggable="true"
                @dragstart="onDragStart($event, idx)"
                @click.stop="selectedSlotIndex = idx"
              >
                <q-tooltip>{{ slot.slotId }} ({{ slot.io }})</q-tooltip>
              </div>
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section
            v-if="
              selectedSlotIndex !== -1 && currentType.slots && currentType.slots[selectedSlotIndex]
            "
          >
            <div class="text-h6">Selected Slot Properties</div>
            <div class="row q-col-gutter-sm">
              <div class="col-3">
                <q-input v-model="currentType.slots[selectedSlotIndex]!.slotId" label="Slot ID" />
              </div>
              <div class="col-3">
                <q-select
                  v-model="currentType.slots[selectedSlotIndex]!.io"
                  :options="['input', 'output', 'catalyst']"
                  label="IO Type"
                />
              </div>
              <div class="col-3">
                <q-input
                  v-model.number="currentType.slots[selectedSlotIndex]!.x"
                  type="number"
                  label="X (grid)"
                />
              </div>
              <div class="col-3">
                <q-input
                  v-model.number="currentType.slots[selectedSlotIndex]!.y"
                  type="number"
                  label="Y (grid)"
                />
              </div>
              <div class="col-12">
                <q-select
                  v-model="currentType.slots[selectedSlotIndex]!.accept"
                  :options="['item', 'tag', 'fluid']"
                  multiple
                  use-chips
                  label="Accepts"
                />
              </div>
              <div class="col-12 text-right">
                <q-btn color="negative" flat label="Remove Slot" @click="removeSlot" />
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-9 flex flex-center text-grey" v-else>
        Select or add a recipe type to edit
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useEditorStore } from 'src/stores/editor';
import type { RecipeTypeMachine } from 'src/jei/types';
import { useQuasar } from 'quasar';

const store = useEditorStore();
const $q = useQuasar();

const selectedTypeIndex = ref(-1);
const selectedSlotIndex = ref(-1);

const currentType = computed(() => {
  if (selectedTypeIndex.value === -1) return null;
  return store.recipeTypes[selectedTypeIndex.value];
});

// Helper for managing machines array/object
const currentMachines = computed<RecipeTypeMachine[]>({
  get() {
    if (!currentType.value || !currentType.value.machine) return [];
    if (Array.isArray(currentType.value.machine)) return currentType.value.machine;
    return [currentType.value.machine];
  },
  set(val) {
    if (!currentType.value) return;
    // Always save as array for simplicity in editor, or convert to single if needed
    // For now, let's keep it as array if > 1, or if it was already array.
    // To minimize changes, let's stick to array in memory if we are editing.
    currentType.value.machine = val;
  },
});

function addMachine() {
  if (!currentType.value) return;
  const newMachine = { id: '', name: '' };

  if (!currentType.value.machine) {
    currentType.value.machine = [newMachine];
  } else if (Array.isArray(currentType.value.machine)) {
    currentType.value.machine.push(newMachine);
  } else {
    // Convert single to array
    currentType.value.machine = [currentType.value.machine, newMachine];
  }
}

function removeMachine(index: number) {
  if (!currentType.value) return;
  if (Array.isArray(currentType.value.machine)) {
    currentType.value.machine.splice(index, 1);
    if (currentType.value.machine.length === 0) {
      delete currentType.value.machine;
    }
  } else {
    delete currentType.value.machine;
  }
}

function addType() {
  store.addRecipeType({
    key: 'new.recipe.type',
    displayName: 'New Recipe Type',
    renderer: 'slot_layout',
    slots: [],
  });
  selectedTypeIndex.value = store.recipeTypes.length - 1;
}

function selectType(index: number) {
  selectedTypeIndex.value = index;
  selectedSlotIndex.value = -1;
}

function deleteType(index: number) {
  $q.dialog({
    title: 'Confirm',
    message: 'Delete this recipe type?',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    store.deleteRecipeType(index);
    if (selectedTypeIndex.value === index) {
      selectedTypeIndex.value = -1;
    } else if (selectedTypeIndex.value > index) {
      selectedTypeIndex.value--;
    }
  });
}

function addSlot() {
  if (!currentType.value) return;
  if (!currentType.value.slots) currentType.value.slots = [];

  currentType.value.slots.push({
    slotId: `slot_${currentType.value.slots.length}`,
    io: 'input',
    accept: ['item'],
    x: 0,
    y: 0,
  });
  selectedSlotIndex.value = currentType.value.slots.length - 1;
}

function removeSlot() {
  if (!currentType.value || selectedSlotIndex.value === -1 || !currentType.value.slots) return;
  currentType.value.slots.splice(selectedSlotIndex.value, 1);
  selectedSlotIndex.value = -1;
}

function addParam() {
  if (!currentType.value) return;
  if (!currentType.value.paramSchema) currentType.value.paramSchema = {};

  const key = `param_${Object.keys(currentType.value.paramSchema).length + 1}`;
  currentType.value.paramSchema[key] = {
    displayName: 'New Param',
    format: 'number',
  };
}

function updateParamKey(oldKey: string, newKey: string) {
  if (!currentType.value || !currentType.value.paramSchema) return;
  if (oldKey === newKey) return;
  if (currentType.value.paramSchema[newKey]) {
    $q.notify({ type: 'warning', message: 'Key already exists' });
    return;
  }

  const val = currentType.value.paramSchema[oldKey];
  if (!val) return;
  delete currentType.value.paramSchema[oldKey];
  currentType.value.paramSchema[newKey] = val;
}

function deleteParam(key: string) {
  if (!currentType.value || !currentType.value.paramSchema) return;
  delete currentType.value.paramSchema[key];
}

function ensureDefaults() {
  if (!currentType.value) return;
  if (!currentType.value.defaults) currentType.value.defaults = {};
}

function addDefault() {
  if (!currentType.value) return;
  ensureDefaults();
  $q.dialog({
    title: 'New Default',
    message: 'Enter default key (e.g. "power")',
    prompt: {
      model: '',
      isValid: (val) => val.length > 0 && !currentType.value?.defaults?.[val],
    },
    cancel: true,
    persistent: true,
  }).onOk((key) => {
    if (!currentType.value) return;
    ensureDefaults();
    currentType.value.defaults![key] = 0;
  });
}

function updateDefaultKey(oldKey: string, newKey: string) {
  if (!currentType.value || !currentType.value.defaults) return;
  if (oldKey === newKey) return;
  if (currentType.value.defaults[newKey] !== undefined) {
    $q.notify({ type: 'warning', message: 'Key already exists' });
    return;
  }
  const val = currentType.value.defaults[oldKey];
  delete currentType.value.defaults[oldKey];
  currentType.value.defaults[newKey] = val;
}

function deleteDefault(key: string) {
  if (!currentType.value || !currentType.value.defaults) return;
  delete currentType.value.defaults[key];
}

function setDefaultValue(key: string, val: unknown) {
  if (!currentType.value) return;
  ensureDefaults();
  currentType.value.defaults![key] = val;
}

function defaultValueToString(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint')
    return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return '';
  }
}

function updateDefaultValueFromString(key: string, raw: string, prev: unknown) {
  if (!currentType.value) return;
  ensureDefaults();
  if (typeof prev === 'string') {
    currentType.value.defaults![key] = raw;
    return;
  }
  if (prev && typeof prev === 'object') {
    try {
      currentType.value.defaults![key] = JSON.parse(raw);
    } catch {
      currentType.value.defaults![key] = raw;
    }
    return;
  }
  currentType.value.defaults![key] = raw;
}

// Drag and Drop Logic
let draggedSlotIndex = -1;

function onDragStart(e: DragEvent, index: number) {
  draggedSlotIndex = index;
  selectedSlotIndex.value = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }
}

function onDrop(e: DragEvent) {
  if (draggedSlotIndex === -1 || !currentType.value || !currentType.value.slots) return;

  const canvasRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX - canvasRect.left;
  const y = e.clientY - canvasRect.top;

  // Snap to grid (18px)
  const gridX = Math.floor(x / 18);
  const gridY = Math.floor(y / 18);

  const slot = currentType.value.slots[draggedSlotIndex];
  if (!slot) return;
  slot.x = Math.max(0, gridX);
  slot.y = Math.max(0, gridY);

  draggedSlotIndex = -1;
}
</script>

<style scoped>
.bg-dark-canvas {
  background-color: #1d1d1d;
}

.grid-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: 18px 18px;
  background-image:
    linear-gradient(to right, #ddd 1px, transparent 1px),
    linear-gradient(to bottom, #ddd 1px, transparent 1px);
}

.grid-bg-dark {
  background-image:
    linear-gradient(to right, #333 1px, transparent 1px),
    linear-gradient(to bottom, #333 1px, transparent 1px);
}
</style>
