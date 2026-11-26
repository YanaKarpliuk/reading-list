<script setup lang="ts">
// The notes of one book: the list, a form to add one, and edit/delete per
// note. BookItem shows it with v-if when "Notes" is clicked, so it's created
// on open and loads its notes then, not for every book on the page.
import { onMounted, ref } from 'vue';
import {
  createNote,
  deleteNote,
  errorText,
  listNotes,
  updateNote,
} from '@/api';
import { NOTE_MAX_LENGTH, type Note } from '@/types';

const props = defineProps<{
  bookId: string;
}>();

// Tells BookItem the new number of notes, for the "Notes (3)" button.
const emit = defineEmits<{
  countChange: [count: number];
}>();

// This component owns the list of notes for its book. Unlike the paged book
// list in App, it always has *all* notes of the book, so after a change it
// can update the array itself instead of asking the server again.
const notes = ref<Note[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const newText = ref('');
const adding = ref(false);

// At most one note is edited at a time: its id, and the text in the textarea.
const editingId = ref<string | null>(null);
const draft = ref('');
// The note that's being saved or deleted, to disable its buttons meanwhile.
const busyId = ref<string | null>(null);

// Every change of the array goes through here, so the count is never forgotten.
function setNotes(list: Note[]) {
  notes.value = list;
  emit('countChange', list.length);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    setNotes(await listNotes(props.bookId));
  } catch (err) {
    error.value = errorText(err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function add() {
  adding.value = true;
  error.value = null;
  try {
    const note = await createNote(props.bookId, newText.value);
    // The API sorts oldest first, so a new note goes at the end.
    setNotes([...notes.value, note]);
    newText.value = '';
  } catch (err) {
    // Keep the text, so the user can fix it and try again.
    error.value = errorText(err);
  } finally {
    adding.value = false;
  }
}

function startEdit(note: Note) {
  editingId.value = note.id;
  draft.value = note.text;
  error.value = null;
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(note: Note) {
  busyId.value = note.id;
  error.value = null;
  try {
    const updated = await updateNote(note.id, draft.value);
    // A new array with the one note replaced. We don't change the old note
    // object in place, so the list keeps the server's version.
    setNotes(notes.value.map((n) => (n.id === updated.id ? updated : n)));
    editingId.value = null;
  } catch (err) {
    error.value = errorText(err);
  } finally {
    busyId.value = null;
  }
}

async function remove(note: Note) {
  if (!confirm('Delete this note?')) return;
  busyId.value = note.id;
  error.value = null;
  try {
    await deleteNote(note.id);
    setNotes(notes.value.filter((n) => n.id !== note.id));
  } catch (err) {
    error.value = errorText(err);
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <section class="notes" aria-label="Notes">
    <p v-if="loading" class="muted small">Loading notes…</p>
    <p v-else-if="notes.length === 0 && !error" class="muted small">
      No notes yet.
    </p>
    <ul v-else class="note-list">
      <li v-for="note in notes" :key="note.id" class="note">
        <!-- Editing this note: a textarea instead of the text. -->
        <form v-if="editingId === note.id" @submit.prevent="saveEdit(note)">
          <textarea
            v-model="draft"
            :maxlength="NOTE_MAX_LENGTH"
            rows="3"
            required
            aria-label="Note text"
          />
          <div class="actions">
            <button type="submit" :disabled="busyId === note.id">
              {{ busyId === note.id ? 'Saving…' : 'Save' }}
            </button>
            <button type="button" @click="cancelEdit">Cancel</button>
          </div>
        </form>
        <template v-else>
          <p class="text">{{ note.text }}</p>
          <div class="actions">
            <span class="muted small">{{ formatDate(note.createdAt) }}</span>
            <button
              class="small"
              :disabled="busyId === note.id"
              @click="startEdit(note)"
            >
              Edit
            </button>
            <button
              class="danger small"
              :disabled="busyId === note.id"
              @click="remove(note)"
            >
              Delete
            </button>
          </div>
        </template>
      </li>
    </ul>

    <p v-if="error" class="error small">{{ error }}</p>

    <form v-if="!loading" class="add" @submit.prevent="add">
      <!-- maxlength stops typing at the limit; the API checks it again,
           because a request can come from anywhere, not only this form. -->
      <textarea
        v-model="newText"
        :maxlength="NOTE_MAX_LENGTH"
        rows="2"
        required
        placeholder="Add a note…"
        aria-label="New note"
      />
      <button type="submit" :disabled="adding">
        {{ adding ? 'Adding…' : 'Add note' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.notes {
  margin-top: 8px;
  padding: 8px 12px;
  border-left: 3px solid var(--border);
}

.note-list {
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
}

.note {
  padding: 6px 0;
}

.note + .note {
  border-top: 1px dashed var(--border);
}

.text {
  margin: 0;
  /* Keep the line breaks the user typed. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}

.add {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
</style>
