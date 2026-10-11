import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = 3000;
const MAX_BODY_BYTES = 100 * 1024; // 100 KB is plenty for a book

const books = [
  {
    id: randomUUID(),
    title: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    status: 'done',
    createdAt: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    title: 'Dune',
    author: 'Frank Herbert',
    status: 'reading',
    createdAt: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    title: 'Clean Code',
    status: 'want',
    createdAt: new Date().toISOString(),
  },
];

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data) + '\n');
}

// An error that already knows which HTTP status to answer with.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// req is a stream (body comes over the network in several pieces, called chunks). Node doesn't wait for all of them. Instead it gives you events:
// - 'data' fires for each chunk, and we add it to body.
// - 'end' fires when the last chunk has arrived, so the body is complete.
// - 'error' fires if something breaks, for example the client disconnects.
function readBody(req) {
  return new Promise((resolve, reject) => {
    // Content-Length is the size the client announces. If it's already too big,
    // reject before reading a single byte.
    const declared = Number(req.headers['content-length']);
    if (declared > MAX_BODY_BYTES) {
      reject(new HttpError(413, 'Request body too large'));
      return;
    }

    // The header is optional and could lie, so we also count the real bytes.
    let body = '';
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return; // ignore the rest, don't keep it in memory
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(new HttpError(413, 'Request body too large'));
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const STATUSES = ['want', 'reading', 'done'];

// Returns the parsed value, or undefined if the text isn't valid JSON.
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Returns an error message, or null if the input is valid.
// With partial: true (for PATCH), title may be left out.
function validateBook(input, { partial = false } = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return 'Body must be a JSON object';
  }
  // On PATCH, title can be left out, but if it's sent it must be valid.
  if (!partial || input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim() === '') {
      return 'title is required and must be a non-empty string';
    }
  }
  if (input.author !== undefined && typeof input.author !== 'string') {
    return 'author must be a string';
  }
  if (input.status !== undefined && !STATUSES.includes(input.status)) {
    return `status must be one of: ${STATUSES.join(', ')}`;
  }
  return null;
}

async function handleRequest(req, res) {
  console.log(`${req.method} ${req.url}`);

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === 'GET' && (path === '/' || path === '/books')) {
    const status = url.searchParams.get('status');

    if (status === null) {
      // return after each sendJson prevent the code from going to the next sendJson.
      sendJson(res, 200, books);
      return;
    }

    if (!STATUSES.includes(status)) {
      sendJson(res, 400, { error: `status must be one of: ${STATUSES.join(', ')}` });
      return;
    }

    sendJson(res, 200, books.filter((b) => b.status === status));
    return;
  }

  if (req.method === 'POST' && path === '/books') {
    // wait until the promise resolves
    const body = await readBody(req);

    const input = parseJson(body);
    if (input === undefined) {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    const error = validateBook(input);
    if (error) {
      sendJson(res, 400, { error });
      return;
    }

    const book = {
      id: randomUUID(),
      title: input.title.trim(),
      status: input.status ?? 'want',
      createdAt: new Date().toISOString(),
    };
    if (input.author !== undefined) {
      book.author = input.author;
    }

    books.push(book);
    sendJson(res, 201, book);
    return;
  }

  const parts = path.split('/').filter(Boolean);

  if (
    parts.length === 2 &&
    parts[0] === 'books' &&
    ['GET', 'PATCH', 'DELETE'].includes(req.method)
  ) {
    const id = parts[1];
    const index = books.findIndex((b) => b.id === id);

    if (index === -1) {
      sendJson(res, 404, { error: 'Book not found' });
      return;
    }

    const book = books[index];

    if (req.method === 'GET') {
      sendJson(res, 200, book);
      return;
    }

    if (req.method === 'PATCH') {
      const input = parseJson(await readBody(req));
      if (input === undefined) {
        sendJson(res, 400, { error: 'Invalid JSON' });
        return;
      }

      const error = validateBook(input, { partial: true });
      if (error) {
        sendJson(res, 400, { error });
        return;
      }

      if (input.title !== undefined) book.title = input.title.trim();
      if (input.author !== undefined) book.author = input.author;
      if (input.status !== undefined) book.status = input.status;

      sendJson(res, 200, book);
      return;
    }

    // DELETE
    books.splice(index, 1);
    res.writeHead(204);
    res.end();
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

// Every request goes through this try/catch, so a thrown error (or a rejected
// promise we awaited) becomes an error response instead of crashing the server.
const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err) {
    // The response was already started, so we can't send a new status. Just close it.
    if (res.headersSent) {
      res.destroy();
      return;
    }

    if (err instanceof HttpError) {
      if (err.status === 413) {
        // Close the connection instead of waiting for the rest of a huge body.
        res.setHeader('Connection', 'close');
      }
      sendJson(res, err.status, { error: err.message });
      return;
    }

    // Unexpected error: log the details for us, but don't leak them to the client.
    console.error(err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
