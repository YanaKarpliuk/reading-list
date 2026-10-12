import express from 'express';
import { randomUUID } from 'node:crypto';

const PORT = 3000;
const STATUSES = ['want', 'reading', 'done'];

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

const app = express();

// ---------- Middleware: runs for every request, in this order ----------

// Log every request.
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Read the body and parse it as JSON (replaces readBody + parseJson).
// Only runs when the request has Content-Type: application/json.
app.use(express.json({ limit: '100kb' }));

// ---------- Routes ----------

app.get(['/', '/books'], (req, res) => {
  const { status } = req.query;

  if (status === undefined) {
    res.json(books);
    return;
  }

  // ?status=a&status=b gives an array, so check the type too.
  if (typeof status !== 'string' || !STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    return;
  }

  res.json(books.filter((b) => b.status === status));
});

app.post('/books', (req, res) => {
  const error = validateBook(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const book = {
    id: randomUUID(),
    title: req.body.title.trim(),
    status: req.body.status ?? 'want',
    createdAt: new Date().toISOString(),
  };
  if (req.body.author !== undefined) {
    book.author = req.body.author;
  }

  books.push(book);
  res.status(201).json(book);
});

// Shared by all /books/:id routes: find the book or answer 404.
function findBook(req, res, next) {
  const book = books.find((b) => b.id === req.params.id);
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }
  req.book = book;
  next();
}

app
  .route('/books/:id')
  .get(findBook, (req, res) => {
    res.json(req.book);
  })
  .patch(findBook, (req, res) => {
    const error = validateBook(req.body, { partial: true });
    if (error) {
      res.status(400).json({ error });
      return;
    }

    const { book } = req;
    if (req.body.title !== undefined) book.title = req.body.title.trim();
    if (req.body.author !== undefined) book.author = req.body.author;
    if (req.body.status !== undefined) book.status = req.body.status;

    res.json(book);
  })
  .delete(findBook, (req, res) => {
    books.splice(books.indexOf(req.book), 1);
    // sends a 204 with no body.
    res.status(204).end();
  })
  .all((req, res) => {
    res.set('Allow', 'GET, PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  });

// ---------- Fallbacks: only reached if nothing above responded ----------

// No route matched.
// It must come after all the routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler: Express recognizes it by the 4 parameters.
// It receives anything thrown in a route, and errors from express.json().
app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err); // let Express close the broken response
    return;
  }
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  if (err.type === 'entity.too.large') {
    res.set('Connection', 'close');
    res.status(413).json({ error: 'Request body too large' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Express server listening on http://localhost:${PORT}`);
});
