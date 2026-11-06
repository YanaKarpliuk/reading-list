// The same statuses the backend accepts (src/books/book.ts in the API).
// The frontend is a separate project, so it keeps its own copy.
export const STATUSES = ['want', 'reading', 'done'] as const;

export type BookStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<BookStatus, string> = {
  want: 'Want to read',
  reading: 'Reading',
  done: 'Done',
};

// A book as the API sends it. JSON has no Date type, so createdAt is a string.
export interface Book {
  id: string;
  title: string;
  author: string | null;
  status: BookStatus;
  createdAt: string;
}

// What we may send on POST. id and createdAt are set by the database.
export interface NewBook {
  title: string;
  author?: string;
  status?: BookStatus;
}
