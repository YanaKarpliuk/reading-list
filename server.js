import express from 'express';
import { pool } from './db.js';

const PORT = 3000;
const STATUSES = ['want', 'reading', 'done'];

// The columns every query returns. The database uses snake_case (created_at),
// the API uses camelCase (createdAt), so we rename it with AS.
// Double quotes keep the capital C; without them Postgres would lowercase it.
const BOOK_COLUMNS = 'id, title, author, status, created_at AS "createdAt"';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

app.get(['/', '/books'], async (req, res) => {
  const { status } = req.query;

  if (status === undefined) {
    const result = await pool.query(`SELECT ${BOOK_COLUMNS} FROM books ORDER BY created_at`);
    res.json(result.rows);
    return;
  }

  // ?status=a&status=b gives an array, so check the type too.
  if (typeof status !== 'string' || !STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    return;
  }

  const result = await pool.query(
    `SELECT ${BOOK_COLUMNS} FROM books WHERE status = $1 ORDER BY created_at`,
    [status],
  );
  res.json(result.rows);
});

app.post('/books', async (req, res) => {
  const error = validateBook(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const { title, author, status } = req.body;
  const result = await pool.query(
    `INSERT INTO books (title, author, status)
     VALUES ($1, $2, $3)
     RETURNING ${BOOK_COLUMNS}`,
    [title.trim(), author ?? null, status ?? 'want'],
  );
  res.status(201).json(result.rows[0]);
});

// An id that isn't a UUID can't exist in the table. Answer 404 right away,
// otherwise Postgres would reject it with an error and we'd send a 500.
function checkId(req, res, next) {
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }
  next();
}

app
  .route('/books/:id')
  .all(checkId)
  .get(async (req, res) => {
    const result = await pool.query(`SELECT ${BOOK_COLUMNS} FROM books WHERE id = $1`, [
      req.params.id,
    ]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    res.json(result.rows[0]);
  })
  .patch(async (req, res) => {
    const error = validateBook(req.body, { partial: true });
    if (error) {
      res.status(400).json({ error });
      return;
    }

    // COALESCE(a, b) returns a, or b if a is NULL. So a field that wasn't sent
    // (passed as NULL) keeps its current value.
    const { title, author, status } = req.body;
    const result = await pool.query(
      `UPDATE books
       SET title  = COALESCE($2, title),
           author = COALESCE($3, author),
           status = COALESCE($4, status)
       WHERE id = $1
       RETURNING ${BOOK_COLUMNS}`,
      [req.params.id, title?.trim() ?? null, author ?? null, status ?? null],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    res.json(result.rows[0]);
  })
  .delete(async (req, res) => {
    const result = await pool.query('DELETE FROM books WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
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
// It receives anything thrown in a route, errors from express.json(),
// and failed database queries.
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

// Check the database connection before accepting requests, so a wrong
// password or a stopped database shows up immediately, not on the first request.
try {
  await pool.query('SELECT 1');
} catch (err) {
  console.error(`Cannot connect to the database: ${err.message}`);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Express server listening on http://localhost:${PORT}`);
});
