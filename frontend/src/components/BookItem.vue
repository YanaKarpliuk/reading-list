<script setup lang="ts">
import { computed, ref } from 'vue';
import BookNotes from '@/components/BookNotes.vue';
import { deleteBook, errorText, updateBook } from '@/api';
import {
  STATUSES,
  STATUS_LABELS,
  type Book,
  type BookListItem,
  type BookStatus,
} from '@/types';

// Props are the component's inputs: <BookItem :book="book">.
// They are read-only here. To change the book, we ask the server and then
// tell the parent, which owns the data, with an event.
const props = defineProps<{
  book: BookListItem;
}>();

const emit = defineEmits<{
  updated: [book: Book];
  deleted: [id: string];
}>();

const busy = ref(false);
const error = ref<string | null>(null);

// Whether the notes panel is open. It's local to this row: opening the
// notes of one book doesn't affect any other.
const showNotes = ref(false);

// The count from the book list, until BookNotes reports a newer one after
// loading, adding or deleting. A note never changes which books are on the
// page, so we don't reload the whole list for it, only update the button.
const loadedNoteCount = ref<number | null>(null);
const noteCount = computed(() => loadedNoteCount.value ?? props.book.noteCount);

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
    <div class="row">
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
      <!-- aria-expanded tells screen readers whether the panel is open. -->
      <button :aria-expanded="showNotes" @click="showNotes = !showNotes">
        Notes ({{ noteCount }})
      </button>
      <button class="danger" :disabled="busy" @click="remove">Delete</button>
    </div>
    <!-- v-if, not v-show: the panel is only created when it's opened, so it
         loads the notes then, and fresh again each time it's reopened. -->
    <BookNotes
      v-if="showNotes"
      :book-id="book.id"
      @count-change="loadedNoteCount = $event"
    />
  </li>
</template>

<style scoped>
.book {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.info {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
