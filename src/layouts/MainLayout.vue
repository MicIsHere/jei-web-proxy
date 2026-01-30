<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>JEI-web</q-toolbar-title>

        <div>v{{ appVersion }}</div>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" bordered>
      <q-list>
        <q-item-label header> Essential Links </q-item-label>

        <EssentialLink v-for="link in linksList" :key="link.title" v-bind="link" />
      </q-list>
    </q-drawer>

    <q-page-container :class="settingsStore.debugLayout ? 'debug-scroll' : 'no-scroll'">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import EssentialLink, { type EssentialLinkProps } from 'components/EssentialLink.vue';
import { useSettingsStore } from 'src/stores/settings';

const settingsStore = useSettingsStore();
// 开发环境使用 package.json 版本，生产环境使用 git commit hash
const appVersion = import.meta.env.DEV ? '0.0.1-dev' : (__APP_VERSION__ ?? 'unknown');

const linksList: EssentialLinkProps[] = [
  {
    title: 'GitHub',
    caption: 'github.com/AndreaFrederica',
    icon: 'code',
    link: 'https://github.com/AndreaFrederica/jei-web',
  },
  {
    title: 'Blog',
    caption: 'blog.sirrus.cc',
    icon: 'article',
    link: 'https://blog.sirrus.cc',
  },
  {
    title: 'Wiki',
    caption: 'wiki.sirrus.cc',
    icon: 'menu_book',
    link: 'https://wiki.sirrus.cc',
  },
  {
    title: '小说助手',
    caption: 'anh.sirrus.cc',
    icon: 'auto_stories',
    link: 'https://anh.sirrus.cc',
  },
  {
    title: 'License',
    caption: 'Mozilla Public License 2.0',
    icon: 'gavel',
    link: 'https://github.com/AndreaFrederica/jei-web/blob/main/LICENSE',
  },
  {
    title: 'Third-Party Licenses',
    caption: 'factoriolab-zmd (MIT)',
    icon: 'description',
    link: 'https://github.com/AndreaFrederica/jei-web/blob/main/THIRD-PARTY_LICENSES.md',
  },
];

const leftDrawerOpen = ref(false);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}
</script>

<style>
.no-scroll {
  height: 100vh;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.debug-scroll {
  overflow: auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.no-scroll > .q-page,
.debug-scroll > .q-page {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
