export const STATUSES = ['want', 'reading', 'done'] as const;

export type BookStatus = (typeof STATUSES)[number];

// The shape of a book as the API returns it.
export interface Book {
  id: string;
  title: string;
  author: string | null;
  status: BookStatus;
  createdAt: Date;
}
