<script setup lang="ts">
// Previous / Next buttons for the book list: <BookPagination :page :total-pages @change>.
// It only shows the current page and asks for another one. App owns the page
// number and decides when to load, so this emits `change` instead of using
// v-model: a page click should load right away, without a watch on `page`.
defineProps<{
  page: number;
  totalPages: number;
}>();

const emit = defineEmits<{
  change: [page: number];
}>();
</script>

<template>
  <nav class="pagination" aria-label="Pages">
    <button :disabled="page <= 1" @click="emit('change', page - 1)">
      ← Previous
    </button>
    <span class="muted">Page {{ page }} of {{ totalPages }}</span>
    <button :disabled="page >= totalPages" @click="emit('change', page + 1)">
      Next →
    </button>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}
</style>
