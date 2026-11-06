<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import BookForm from '@/components/BookForm.vue';
import BookItem from '@/components/BookItem.vue';
import { errorText, listBooks } from '@/api';
import { STATUSES, STATUS_LABELS, type Book, type BookStatus } from '@/types';

type Filter = BookStatus | 'all';
const FILTERS: Filter[] = ['all', ...STATUSES];

// The single source of truth: App owns the list. Child components get
// books through props and report changes back with events.
const books = ref<Book[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);
const filter = ref<Filter>('all');

// Filtering happens here in the browser: we already have every book, and
// the counts on the buttons need them all anyway. (The API also supports
// GET /books?status=..., which would be the choice for a very long list.)
const visibleBooks = computed(() =>
  filter.value === 'all'
    ? books.value
    : books.value.filter((book) => book.status === filter.value),
);

const counts = computed(() => {
  const result: Record<Filter, number> = {
    all: books.value.length,
    want: 0,
    reading: 0,
    done: 0,
  };
  for (const book of books.value) result[book.status]++;
  return result;
});

async function loadBooks() {
  loading.value = true;
  loadError.value = null;
  try {
    books.value = await listBooks();
  } catch (err) {
    loadError.value = errorText(err);
  } finally {
    loading.value = false;
  }
}

// Lifecycle hook: runs once the component is on the page.
onMounted(loadBooks);

// The handlers just update local state with what the server returned.
// Vue sees the array change and re-renders the list.
function onCreated(book: Book) {
  books.value.push(book);
}

function onUpdated(book: Book) {
  const index = books.value.findIndex((b) => b.id === book.id);
  if (index !== -1) books.value[index] = book;
}

function onDeleted(id: string) {
  books.value = books.value.filter((b) => b.id !== id);
}
</script>

<template>
  <main>
    <h1>Reading list</h1>

    <!-- @created listens to the event BookForm emits. -->
    <BookForm @created="onCreated" />

    <nav class="filters">
      <!-- :class with an object: adds "active" only when the condition is true. -->
      <button
        v-for="f in FILTERS"
        :key="f"
        :class="{ active: filter === f }"
        @click="filter = f"
      >
        {{ f === 'all' ? 'All' : STATUS_LABELS[f] }} ({{ counts[f] }})
      </button>
    </nav>

    <!-- v-if / v-else-if / v-else: exactly one of these is shown. -->
    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="loadError" class="error">
      Could not load books: {{ loadError }}
      <button @click="loadBooks">Try again</button>
    </p>
    <p v-else-if="visibleBooks.length === 0" class="muted">
      No books here yet.
    </p>
    <ul v-else class="book-list">
      <!-- :key="book.id" lets Vue keep each row matched to its book when the
           list is filtered or reordered. Never use the array index for this. -->
      <BookItem
        v-for="book in visibleBooks"
        :key="book.id"
        :book="book"
        @updated="onUpdated"
        @deleted="onDeleted"
      />
    </ul>
  </main>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 24px 0 8px;
}

.filters .active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
}

.book-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
