<script setup lang="ts">
import { computed, watch, onMounted, ref } from 'vue';
import BookForm from '@/components/BookForm.vue';
import BookItem from '@/components/BookItem.vue';
import BookPagination from '@/components/BookPagination.vue';
import BookSearch from '@/components/BookSearch.vue';
import { errorText, getStats, listBooks } from '@/api';
import {
  STATUSES,
  STATUS_LABELS,
  type Book,
  type BookStats,
  type Filter,
  type Sort,
} from '@/types';

const FILTERS: Filter[] = ['all', ...STATUSES];

// Books per page. The API allows at most 10 (@Max(10) on limit).
const PAGE_SIZE = 5;

// The single source of truth: App owns the list. Child components get
// books through props and report changes back with events.
//
// Search, sort, the status filter and paging all run on the server, so
// `books` is exactly the current page, already filtered and sorted. It can't
// be filtered here in the browser: it only holds one page, not every book.
const books = ref<Book[]>([]);
const total = ref(0); // matching books on all pages, from the response
const page = ref(1);
const loading = ref(true);
const loadError = ref<string | null>(null);

const filter = ref<Filter>('all');
const q = ref('');
const sort = ref<Sort>('createdAt');

// The counts on the filter buttons, from GET /api/books/stats. They only
// depend on q: every button counts its own status, whichever one is active.
const stats = ref<BookStats>({ all: 0, want: 0, reading: 0, done: 0 });

// At least 1, so an empty list shows "Page 1 of 1", not "of 0".
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / PAGE_SIZE)),
);

const emptyMessage = computed(() => {
  const search = q.value.trim();
  if (search) return `No books match "${search}".`;
  if (filter.value !== 'all') return 'No books with this status.';
  return 'No books here yet.';
});

// Each call gets a number. Responses can arrive out of order (the request
// for "du" may finish after the one for "dune"), so only the newest call may
// change the state; older ones return without touching anything.
let latestRequest = 0;

async function loadBooks() {
  const requestId = ++latestRequest;

  loading.value = true;
  loadError.value = null;
  try {
    const result = await listBooks({
      q: q.value.trim(),
      sort: sort.value,
      status: filter.value === 'all' ? undefined : filter.value,
      page: page.value,
      limit: PAGE_SIZE,
    });
    if (requestId !== latestRequest) return;

    // The page can be past the end, e.g. after deleting the only book on the
    // last page. Go to the new last page instead of showing an empty one.
    // This stops at page 1, so it can't loop.
    if (result.items.length === 0 && page.value > 1) {
      page.value = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
      return loadBooks();
    }

    books.value = result.items;
    total.value = result.total;
  } catch (err) {
    if (requestId !== latestRequest) return;
    loadError.value = errorText(err);
  } finally {
    if (requestId === latestRequest) loading.value = false;
  }
}

// Same idea as latestRequest: typing quickly sends several stats requests.
let latestStatsRequest = 0;

async function loadStats() {
  const requestId = ++latestStatsRequest;
  try {
    const result = await getStats(q.value.trim());
    if (requestId === latestStatsRequest) stats.value = result;
  } catch {
    // Keep the old counts. If the API is down, loadBooks shows the error.
  }
}

// Reload the current page and the counts.
function refresh() {
  loadBooks();
  loadStats();
}

// Lifecycle hook: runs once the component is on the page.
onMounted(refresh);

// A page button loads right away. There is deliberately no watch on `page`:
// a filter change also sets page = 1, and a watch would then load twice.
function goToPage(n: number) {
  page.value = n;
  loadBooks();
}

// Creating, updating or deleting a book can change the counts, which books
// belong on this page (a status change with a filter active, a new book that
// matches the search, a deleted book making room for the next one) and the
// number of pages. One page and a total can't be patched by hand, so ask
// the server again.
function onChanged() {
  refresh();
}

// Typing: wait until the user stops for 300 ms, then load once, instead of
// sending a request for every key press. A new search starts at page 1, and
// the counts change with q, so both are reloaded.
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(q, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    refresh();
  }, 300);
});

// Sort and filter: one click is one change, so load right away, from page 1
// (page 3 of "All" may not exist for "Done"). The counts don't depend on
// either, so they aren't reloaded.
watch([sort, filter], () => {
  page.value = 1;
  loadBooks();
});
</script>

<template>
  <main>
    <h1>Reading list</h1>

    <!-- @created listens to the event BookForm emits. -->
    <BookForm @created="onChanged" />

    <nav class="filters">
      <!-- :class with an object: adds "active" only when the condition is true. -->
      <button
        v-for="f in FILTERS"
        :key="f"
        :class="{ active: filter === f }"
        @click="filter = f"
      >
        {{ f === 'all' ? 'All' : STATUS_LABELS[f] }} ({{ stats[f] }})
      </button>
    </nav>

    <BookSearch v-model:q="q" v-model:sort="sort" />

    <!-- v-if / v-else-if / v-else: exactly one of these is shown. -->
    <!-- "Loading…" only while there is nothing to show yet. While searching or
         changing pages, the old results stay visible until the new ones
         arrive, so the list doesn't flicker. -->
    <p v-if="loading && books.length === 0" class="muted">Loading…</p>
    <p v-else-if="loadError" class="error">
      Could not load books: {{ loadError }}
      <button @click="refresh">Try again</button>
    </p>
    <p v-else-if="books.length === 0" class="muted">{{ emptyMessage }}</p>
    <ul v-else class="book-list">
      <!-- :key="book.id" lets Vue keep each row matched to its book when the
           list is filtered or reordered. Never use the array index for this. -->
      <BookItem
        v-for="book in books"
        :key="book.id"
        :book="book"
        @updated="onChanged"
        @deleted="onChanged"
      />
    </ul>

    <!-- Only when there is more than one page, and no error to look at. -->
    <BookPagination
      v-if="!loadError && totalPages > 1"
      :page="page"
      :total-pages="totalPages"
      @change="goToPage"
    />
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
