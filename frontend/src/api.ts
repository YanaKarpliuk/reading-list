import type {
  Book,
  BookPage,
  BookStats,
  BookStatus,
  NewBook,
  Sort,
} from './types';

// Requests go to our own origin; Vite forwards /api to Nest (vite.config.ts).
const BASE_URL = '/api/books';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    ...init,
    // Without this header Nest doesn't parse the body (see the API README).
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
  });

  // fetch only rejects when the network fails. A 400 or 404 is still a
  // "successful" fetch, so we have to check the status ourselves.
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  // DELETE answers 204 No Content: there is no body, and res.json() would throw.
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// Nest errors look like { message: string | string[], error, statusCode }.
async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (body.message) return body.message;
  } catch {
    // Not JSON, e.g. the Vite proxy couldn't reach the API at all.
  }
  return `Request failed: ${res.status} ${res.statusText}`;
}

// Turns whatever was thrown into text we can show on the page.
export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// The query parameters of GET /api/books. All are optional; the backend
// requires limit whenever page is set. (A `type`, not an `interface`: only
// a type alias can be passed where a Record<string, ...> is expected.)
export type ListBooksParams = {
  q?: string;
  sort?: Sort;
  status?: BookStatus;
  page?: number;
  limit?: number;
};

// Builds "?q=...&page=2" from the values that are set, or "" if none are.
// URLSearchParams encodes special characters and only takes strings.
function queryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function listBooks(params: ListBooksParams = {}): Promise<BookPage> {
  return request<BookPage>(queryString(params));
}

export function getStats(q?: string): Promise<BookStats> {
  return request<BookStats>(`/stats${queryString({ q })}`);
}

export function createBook(book: NewBook): Promise<Book> {
  return request<Book>('', { method: 'POST', body: JSON.stringify(book) });
}

export function updateBook(
  id: string,
  changes: Partial<NewBook>,
): Promise<Book> {
  return request<Book>(`/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

export function deleteBook(id: string): Promise<void> {
  return request<void>(`/${id}`, { method: 'DELETE' });
}
