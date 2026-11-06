<script setup lang="ts">
// <script setup>: everything declared here (variables, functions, imports)
// can be used directly in the <template> below.
import { ref } from 'vue';
import { createBook, errorText } from '@/api';
import { STATUSES, STATUS_LABELS, type Book, type BookStatus } from '@/types';

// Events this component can send to its parent: <BookForm @created="...">.
// The parent owns the list of books; we only tell it "here is a new one".
const emit = defineEmits<{
  created: [book: Book];
}>();

// ref() makes a reactive value. Read and write it as .value in the script;
// in the template Vue unwraps it, so you write just `title`.
// When .value changes, Vue re-renders whatever uses it.
const title = ref('');
const author = ref('');
const status = ref<BookStatus>('want');
const saving = ref(false);
const error = ref<string | null>(null);

async function submit() {
  saving.value = true;
  error.value = null;
  try {
    const book = await createBook({
      title: title.value,
      // An empty input means "no author", not the author "".
      author: author.value.trim() || undefined,
      status: status.value,
    });
    emit('created', book);
    // Clear the form only after the server said yes, so a failed
    // request doesn't throw away what the user typed.
    title.value = '';
    author.value = '';
    status.value = 'want';
  } catch (err) {
    error.value = errorText(err);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <!-- @submit.prevent = addEventListener('submit') + event.preventDefault(),
       so the browser doesn't reload the page. -->
  <form class="book-form" @submit.prevent="submit">
    <!-- v-model is two-way binding: the input shows title, and typing
         updates title. Short for :value="title" @input="title = $event.target.value". -->
    <input v-model="title" placeholder="Title" aria-label="Title" required />
    <input
      v-model="author"
      placeholder="Author (optional)"
      aria-label="Author"
    />
    <select v-model="status" aria-label="Status">
      <!-- v-for repeats the element. :key tells Vue which item is which. -->
      <option v-for="s in STATUSES" :key="s" :value="s">
        {{ STATUS_LABELS[s] }}
      </option>
    </select>
    <!-- :disabled (short for v-bind:disabled) sets the attribute from JS. -->
    <button type="submit" :disabled="saving">
      {{ saving ? 'Adding…' : 'Add book' }}
    </button>
  </form>
  <!-- v-if adds or removes the element; here it only exists when there is an error. -->
  <p v-if="error" class="error">{{ error }}</p>
</template>

<!-- scoped: these rules apply only to this component's elements. -->
<style scoped>
.book-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.book-form input {
  flex: 1 1 160px;
}
</style>
