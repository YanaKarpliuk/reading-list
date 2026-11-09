<script setup lang="ts">
import { type Sort, SORT_LABELS, SORT } from '@/types';

// The parent owns the values: <BookSearch v-model:q="q" v-model:sort="sort" />.
// defineModel turns each into a ref that reads the prop and, when written,
// emits update:q / update:sort so the parent can change it.
const q = defineModel<string>('q', { required: true });
const sort = defineModel<Sort>('sort', { required: true });
</script>

<template>
  <input
    v-model="q"
    placeholder="Search by title or author"
    aria-label="Search by title or author"
  />
  <select v-model="sort" aria-label="Sort by">
    <option v-for="s in SORT" :key="s" :value="s">
      {{ SORT_LABELS[s] }}
    </option>
  </select>
</template>

<style scoped>
input,
select {
  height: 38px;
  display: inline-block;
  box-sizing: border-box;
  margin-right: 8px;
}
</style>
