<script setup lang="ts">
import { computed, ref } from 'vue';
import { deleteBook, errorText, updateBook } from '@/api';
import { STATUSES, STATUS_LABELS, type Book, type BookStatus } from '@/types';

// Props are the component's inputs: <BookItem :book="book">.
// They are read-only here. To change the book, we ask the server and then
// tell the parent, which owns the data, with an event.
const props = defineProps<{
  book: Book;
}>();

const emit = defineEmits<{
  updated: [book: Book];
  deleted: [id: string];
}>();

const busy = ref(false);
const error = ref<string | null>(null);

// computed(): a value derived from other reactive values. Vue caches it
// and recalculates it only when props.book.createdAt changes.
const addedOn = computed(() =>
  new Date(props.book.createdAt).toLocaleDateString(),
);

async function changeStatus(event: Event) {
  const select = event.target as HTMLSelectElement;
  busy.value = true;
  error.value = null;
  try {
    const book = await updateBook(props.book.id, {
      status: select.value as BookStatus,
    });
    emit('updated', book);
  } catch (err) {
    error.value = errorText(err);
    // The prop didn't change, so Vue won't re-render the <select>.
    // Put the old value back by hand.
    select.value = props.book.status;
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (!confirm(`Delete "${props.book.title}"?`)) return;
  busy.value = true;
  error.value = null;
  try {
    await deleteBook(props.book.id);
    emit('deleted', props.book.id);
  } catch (err) {
    error.value = errorText(err);
    busy.value = false;
  }
}
</script>

<template>
  <li class="book">
    <div class="info">
      <strong>{{ book.title }}</strong>
      <span v-if="book.author" class="muted"> by {{ book.author }}</span>
      <div class="muted small">Added {{ addedOn }}</div>
      <div v-if="error" class="error small">{{ error }}</div>
    </div>
    <!-- Not v-model: v-model would try to write to the prop, which is
         read-only. :value shows the current status, @change reacts to a pick. -->
    <select
      :value="book.status"
      :disabled="busy"
      aria-label="Status"
      @change="changeStatus"
    >
      <option v-for="s in STATUSES" :key="s" :value="s">
        {{ STATUS_LABELS[s] }}
      </option>
    </select>
    <button class="danger" :disabled="busy" @click="remove">Delete</button>
  </li>
</template>

<style scoped>
.book {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.info {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
