# Reading List

A small app for keeping track of books you want to read, are reading, or have finished, built
as a learning project. It has two parts, each in its own folder:

- `backend/`: a REST API with [NestJS 12](https://nestjs.com/), TypeScript, PostgreSQL and the
  [Prisma](https://www.prisma.io/) ORM
- `frontend/`: a web page with [Vue 3](https://vuejs.org/) and [Vite](https://vite.dev/) that uses the API

Earlier versions of the same API are kept on their own branches:

| Branch                    | Version                                   |
| ------------------------- | ----------------------------------------- |
| `v1.0.0-http-express`     | Plain Node.js (`node:http`) and Express, in-memory data |
| `v2.0.0-express-postgres` | Express with PostgreSQL                   |
| `v3.0.0-nest`             | NestJS with PostgreSQL through Prisma     |
| `v4.0.0-vue`              | The API in `backend/` plus a Vue frontend in `frontend/` (this version) |

## Requirements

- Node.js 24 (pinned in `.nvmrc`; `nvm use` finds it from any folder in the project)
- PostgreSQL
- `curl` for trying out requests. `jq` is optional, for pretty output.

## Project structure

`backend/` and `frontend/` are two separate npm projects. Each has its own `package.json`,
`node_modules` and TypeScript config, so **run npm commands inside the folder of the app you mean**.
The root only holds what both share:

```
.gitignore                          Ignore rules for both apps
.gitattributes                      LF line endings everywhere
.nvmrc                              Node version for both apps
.prettierrc                         Code style for both apps (Prettier looks for it in parent folders)
backend/                            The API, see below
frontend/                           The Vue app, see below
```

## Quick start

```bash
nvm use

# terminal 1: the API on http://localhost:3000
cd backend
npm install
npm run start:dev

# terminal 2: the page on http://localhost:5173
cd frontend
npm install
npm run dev
```

The first time, set up the database first (next section).

## Backend

All commands in this section run in `backend/`.

### Database setup

```bash
cd backend
cp .env.example .env                       # then fill in DATABASE_URL in .env
createdb reading_list                      # create an empty database
npm install                                # also runs `prisma generate`
npm run db:deploy                          # apply prisma/migrations: creates the books table
```

`.env` is read by `ConfigModule` when the app starts, and by `prisma.config.ts` when you run the
Prisma CLI. Both look for it in the current folder, so start the API and run Prisma commands from
`backend/`. It is in `.gitignore`, so the password is never committed.

There are two ways to connect:

- **TCP with a password:** `postgresql://USER:PASSWORD@localhost:5432/reading_list`.
  If the password contains special characters like `@`, `:` or `/`, URL-encode them (`@` → `%40`).
- **Unix socket, no password** (local only, uses your Linux username):
  `postgresql://USER@localhost/reading_list?host=/var/run/postgresql`.
  The app would also accept the shorter `postgres:///reading_list?host=...`, but the Prisma CLI
  needs the user and `localhost` in the URL.

Check that the connection string works:

```bash
psql "$(grep '^DATABASE_URL' .env | cut -d= -f2-)" -c 'SELECT count(*) FROM books;'
```

#### Already have a `books` table from the earlier versions?

Then don't run `db:deploy`, because the table exists and `0_init` would fail. Tell Prisma that the
first migration is already applied instead. This only records it in the `_prisma_migrations`
table and doesn't touch your books:

```bash
npx prisma migrate resolve --applied 0_init
npx prisma migrate status                  # "Database schema is up to date!"
```

### Running the API

```bash
cd backend
npm run start:dev        # compile, start, and restart on every file save
```

The server runs at http://localhost:3000, and every route is under `/api`, e.g.
http://localhost:3000/api/books (set `PORT` in `backend/.env` to change the port). If it can't
reach the database, or `DATABASE_URL` is missing, it stops right away with an error.

| Script (in `backend/`) | What it does                                     |
| ---------------------- | ------------------------------------------------ |
| `npm run start:dev`    | Compiles and starts in watch mode                |
| `npm run start`        | Compiles and starts once                         |
| `npm run build`        | Compiles TypeScript from `src/` into `dist/`     |
| `npm run start:prod`   | Runs the compiled app from `dist/` (build first) |
| `npm run lint`         | Checks the code with oxlint                      |
| `npm run format`       | Formats the code with Prettier                   |
| `npm run db:migrate`   | After editing `schema.prisma`: create and apply a new migration |
| `npm run db:deploy`    | Apply migrations that haven't run yet            |
| `npm run db:studio`    | Open Prisma Studio, a web UI for browsing the data |
| `npx prisma generate`  | Regenerate the client after editing `schema.prisma` (also runs on `npm install` and `npm run build`) |

### Backend files

```
backend/
├── .env.example                    Template for .env (DATABASE_URL, PORT)
├── package.json                    Dependencies and scripts of the API
├── nest-cli.json                   Nest CLI settings (source folder: src)
├── tsconfig.json                   TypeScript settings; tsconfig.build.json is used by `nest build`
├── vitest.config.ts                Unit test settings (*.spec.ts); vitest.config.e2e.ts for e2e
├── .oxlintrc.json                  Lint rules
├── prisma.config.ts                Prisma CLI settings: schema path, migrations path, DATABASE_URL
├── prisma/
│   ├── schema.prisma               The Book model; the source for the generated client
│   └── migrations/
│       └── 0_init/migration.sql    Creates the books table (with hand-added CHECK constraints)
└── src/
    ├── main.ts                     Bootstrap: create the app, global ValidationPipe, listen
    ├── app.module.ts               Root module: ConfigModule, PrismaModule, BooksModule
    ├── generated/prisma/           Prisma Client, generated by `prisma generate` (not in git)
    ├── prisma/
    │   ├── prisma.module.ts        Global module that provides PrismaService
    │   └── prisma.service.ts       PrismaClient as a Nest provider: connects, checks, disconnects
    └── books/
        ├── books.module.ts         Groups the books controller and service
        ├── books.controller.ts     HTTP routes → service calls
        ├── books.service.ts        Prisma queries (list, stats, CRUD), throws NotFoundException
        ├── book.ts                 STATUSES, SORT and the BookStatus, Sort, BookPage, BookStats types
        └── dto/
            ├── create-book.dto.ts  Validation rules for POST
            ├── update-book.dto.ts  Same rules, all optional (PATCH)
            ├── list-books-query.dto.ts  Validation for ?status=, ?q=, ?sort=, ?page= and ?limit=
            └── stats-books-query.dto.ts Validation for ?q= on /books/stats
```

## Frontend

All commands in this section run in `frontend/`. Start the API first (see above), then:

```bash
cd frontend
npm install              # first time only
npm run dev              # http://localhost:5173
```

Open http://localhost:5173. You can add books, search them by title or author, sort them by date
added or title, filter them by status, change a book's status, and delete books.

The page loads all matching books in one request: it reads `items` from the response and sends no
`limit`, because the status filter and its counts need every book. Search and sort run on the API
(`?q=` and `?sort=`): the list reloads 300 ms after you stop typing, and an older response that
arrives late is ignored. The status filter buttons run in the browser on top of the search result,
so their counts count the books that match the search.

The page calls `/api/books` on its own origin, and the Vite dev server forwards those requests
unchanged to the API (`server.proxy` in `frontend/vite.config.ts`): `/api/books` on port 5173
becomes http://localhost:3000/api/books. The browser only talks to one origin, so the API needs no
CORS setup. The API has to be running, otherwise the page shows "Could not load books".

| Script (in `frontend/`) | What it does                                          |
| ----------------------- | ----------------------------------------------------- |
| `npm run dev`           | Starts the Vite dev server with hot reload            |
| `npm run type-check`    | Type-checks `.ts` and `.vue` files with `vue-tsc`     |
| `npm run build`         | Type-checks and builds static files into `dist/`      |
| `npm run preview`       | Serves the built `dist/` locally (no API proxy)       |
| `npm run format`        | Formats the code with Prettier                        |

### Frontend files

```
frontend/
├── index.html                      The page; Vue renders into <div id="app">
├── package.json                    Dependencies and scripts of the frontend
├── vite.config.ts                  Vue plugin, DevTools, `@` alias, /api proxy to :3000
├── tsconfig.json                   Points to tsconfig.app.json (src/) and tsconfig.node.json (vite.config.ts)
└── src/
    ├── main.ts                     createApp(App).mount('#app'), global CSS
    ├── style.css                   Global styles and colors (light and dark)
    ├── types.ts                    Book type, statuses and sort fields, matching the API
    ├── api.ts                      fetch wrappers for the endpoints, Nest error messages
    ├── App.vue                     Owns the list and the search/sort state: loading, filters, counts
    └── components/
        ├── BookForm.vue            Form to add a book (v-model, emits `created`)
        ├── BookSearch.vue          Search input and sort select (defineModel: v-model:q, v-model:sort)
        └── BookItem.vue            One book: change status, delete (props in, events out)
```

## Changing the database schema

In `backend/`:

1. Edit `prisma/schema.prisma`, for example add `rating Int?` to `Book`.
2. Run `npm run db:migrate -- --name add-rating`. Prisma compares the schema with the database,
   writes `prisma/migrations/<timestamp>_add-rating/migration.sql`, applies it, and regenerates
   the client, so `book.rating` is now typed.
3. Commit the new migration folder together with the code that uses it.

`migrate dev` creates a temporary "shadow" database to check the migrations, so your database user
needs permission to create databases.

## Data model

| Field       | Type           | Notes                                                |
| ----------- | -------------- | ---------------------------------------------------- |
| `id`        | string         | UUID, set by the database                            |
| `title`     | string         | **Required**, must not be empty (spaces are trimmed) |
| `author`    | string \| null | Optional. `null` when not set                        |
| `status`    | string         | One of `want`, `reading`, `done`. Defaults to `want` |
| `createdAt` | string         | ISO 8601 date, set by the database                   |

`id` and `createdAt` are always generated by the database. If a client sends them, or any other
unknown field, they are removed before the request reaches the code. In the database the column
is called `created_at`; `@map("created_at")` in `schema.prisma` renames it to `createdAt`.

For optional fields, `null` counts as "not sent": `"author": null` on POST creates a book without
an author, and `"title": null` on PATCH leaves the title unchanged.

## Endpoints

All routes start with `/api` (`app.setGlobalPrefix('api')` in `backend/src/main.ts`). That keeps
API URLs apart from page URLs, so the same server can later serve the built frontend too.

| Method   | Path                | Description                    | Success         |
| -------- | ------------------- | ------------------------------ | --------------- |
| `GET`    | `/api/books`        | List books (see query parameters below) | `200`  |
| `GET`    | `/api/books/stats`  | Count books per status (see [below](#counts-per-status)) | `200` |
| `GET`    | `/api/books/:id`    | Get one book                   | `200`           |
| `POST`   | `/api/books`        | Create a book                  | `201`           |
| `PATCH`  | `/api/books/:id`    | Update some fields of a book   | `200`           |
| `DELETE` | `/api/books/:id`    | Delete a book                  | `204` (no body) |

Query parameters of `GET /api/books`. All are optional and can be combined:

| Parameter | Values                  | What it does                                                    |
| --------- | ----------------------- | --------------------------------------------------------------- |
| `status`  | `want`, `reading`, `done` | Only books with this status                                   |
| `q`       | any text                | Only books whose title or author contains it, ignoring case. Spaces around it are trimmed; an empty `q` means no search |
| `sort`    | `createdAt`, `title`    | Order of the list, ascending. Default: `createdAt` (oldest first). Books with the same value are ordered by `id`, so the order is always the same and pages never overlap |
| `page`    | integer, 1 or more      | Which page to return. Default: `1`. Only allowed together with `limit` |
| `limit`   | integer, 1 to 10        | Books per page. Without it, all matching books are returned in one response |

The response is one page of books plus what a client needs to show page buttons:

```json
{
  "items": [{ "id": "…", "title": "Project Hail Mary", "author": "Andy Weir", "status": "reading", "createdAt": "…" }],
  "total": 7,
  "page": 1,
  "limit": 2
}
```

| Field   | Meaning                                                                        |
| ------- | ------------------------------------------------------------------------------ |
| `items` | The books on this page (an empty array after the last page)                    |
| `total` | How many books match `status` and `q` in total, on all pages                   |
| `page`  | The page number, `1` when no `page` was sent                                   |
| `limit` | The page size that was used, or `null` when no `limit` was sent (all books)    |

The number of pages is `Math.ceil(total / limit)`. `items` and `total` are read with the same filter
in one `prisma.$transaction`, so `total` always counts the same books that `items` comes from.

### Counts per status

`GET /api/books/stats` counts the books for each status, for example for filter buttons like
"Reading (1)":

```json
{ "all": 7, "want": 5, "reading": 1, "done": 1 }
```

It takes one optional query parameter, `q`, with the same search as `GET /api/books` (title or
author, ignoring case, trimmed). With `q`, only matching books are counted. It has no `status`
parameter: every status is counted, so each button can show its own number. A status without books
is `0`, and `all` is the sum of the other three, so it equals `total` from `GET /api/books` with the
same `q`.

In `books.controller.ts`, `@Get('stats')` is declared before `@Get(':id')`. Nest checks routes in
the order they're declared, so otherwise `stats` would be taken as an ID, and `ParseUUIDPipe` would
answer with a `400`.

### Request bodies

Request bodies must be JSON and sent with `Content-Type: application/json`. Without that header
the body is not parsed, and you get a `400` because `title` is missing.

## Errors

Errors use Nest's standard format. Validation errors list every problem in `message`:

```json
{ "message": ["title should not be empty", "title must be a string"], "error": "Bad Request", "statusCode": 400 }
```

Other errors have a single message:

```json
{ "message": "Book not found", "error": "Not Found", "statusCode": 404 }
```

| Status | When                                                                  |
| ------ | --------------------------------------------------------------------- |
| `400`  | Invalid JSON, a failed validation, an unknown `status` or `sort`, a repeated `q`, a `page` or `limit` that isn't a whole number in range, a `page` without `limit`, or an ID that isn't a UUID |
| `404`  | Unknown book ID, unknown route, or unsupported method (e.g. `PUT`)    |
| `413`  | Request body larger than 100 KB                                       |
| `500`  | Unexpected server or database error                                   |

## Using the API with curl

Useful curl flags:

- `-i` shows the status line and headers, not just the body
- `-s` hides the progress meter
- `-X METHOD` sets the HTTP method (`POST`, `PATCH`, `DELETE`)
- `-H 'Header: value'` adds a request header
- `-d '...'` sends a request body
- `-w '\n'` prints a newline after the response, so your prompt starts on its own line

Always put URLs that contain `?` or `&` in quotes.

To add the newline to every curl command automatically:

```bash
echo '-w "\n"' >> ~/.curlrc
```

### List all books

```bash
curl -i http://localhost:3000/api/books
```

The books are in `items` (see [Endpoints](#endpoints)). To print only the titles:

```bash
curl -s http://localhost:3000/api/books | jq '[.items[].title]'
```

Pretty-printed with `jq`:

```bash
curl -s http://localhost:3000/api/books | jq
```

### Filter by status

```bash
curl -i "http://localhost:3000/api/books?status=reading"
curl -i "http://localhost:3000/api/books?status=want"
curl -i "http://localhost:3000/api/books?status=done"
```

An unknown status gives a `400`:

```bash
curl -i "http://localhost:3000/api/books?status=banana"
# {"message":["status must be one of the following values: want, reading, done"],"error":"Bad Request","statusCode":400}
```

### Search and sort

```bash
curl -s "http://localhost:3000/api/books?q=weir" | jq           # title or author contains "weir", any case
curl -s "http://localhost:3000/api/books?sort=title" | jq       # A to Z by title
curl -s "http://localhost:3000/api/books?q=hail&status=reading&sort=title" | jq   # all combined
```

Put spaces or special characters in the search through `--data-urlencode`, so curl encodes them:

```bash
curl -s -G http://localhost:3000/api/books --data-urlencode "q=hail mary" | jq
```

An unknown sort field gives a `400`:

```bash
curl -i "http://localhost:3000/api/books?sort=banana"
# {"message":["sort must be one of the following values: title, createdAt"],"error":"Bad Request","statusCode":400}
```

### Pages

```bash
curl -s "http://localhost:3000/api/books?page=1&limit=2" | jq    # the first 2 books, plus total/page/limit
curl -s "http://localhost:3000/api/books?page=2&limit=2" | jq    # the next 2
curl -s "http://localhost:3000/api/books?q=weir&sort=title&page=1&limit=5" | jq   # combined with search and sort
```

A page after the last one returns `"items": []`, with the correct `total`. Invalid values give a
`400`. Every failed rule of a field is listed, so a missing `limit` reports several messages:

```bash
curl -s "http://localhost:3000/api/books?limit=11" | jq .message
# ["limit must not be greater than 10"]
curl -s "http://localhost:3000/api/books?page=2" | jq .message
# ["limit is required when page is set", "limit must not be less than 1", ...]
```

### Count books per status

```bash
curl -s http://localhost:3000/api/books/stats | jq            # {"all":7,"want":5,"reading":1,"done":1}
curl -s "http://localhost:3000/api/books/stats?q=hail" | jq   # only books matching "hail"
```

### Create a book

```bash
curl -i -X POST http://localhost:3000/api/books \
  -H 'Content-Type: application/json' \
  -d '{"title": "Project Hail Mary", "author": "Andy Weir", "status": "reading"}'
```

Only `title` is required. `status` defaults to `want`:

```bash
curl -i -X POST http://localhost:3000/api/books \
  -H 'Content-Type: application/json' \
  -d '{"title": "Neuromancer"}'
```

The response (`201 Created`) contains the new book with its `id`. Copy the `id` for the next requests.

### Save an ID in a shell variable

IDs are long and random, so it's handy to store one in a variable. With `jq`:

```bash
ID=$(curl -s -X POST http://localhost:3000/api/books \
  -H 'Content-Type: application/json' \
  -d '{"title": "Test Book"}' | jq -r '.id')
echo $ID
```

Without `jq`, copy the `id` from the response by hand:

```bash
ID=paste-the-id-here
```

The examples below use `$ID`.

### Get one book

```bash
curl -i http://localhost:3000/api/books/$ID
```

### Update a book

Send only the fields you want to change:

```bash
curl -i -X PATCH http://localhost:3000/api/books/$ID \
  -H 'Content-Type: application/json' \
  -d '{"status": "done"}'
```

```bash
curl -i -X PATCH http://localhost:3000/api/books/$ID \
  -H 'Content-Type: application/json' \
  -d '{"title": "A Better Title", "author": "Someone"}'
```

### Delete a book

```bash
curl -i -X DELETE http://localhost:3000/api/books/$ID
# HTTP/1.1 204 No Content
```

Check that it's gone:

```bash
curl -i http://localhost:3000/api/books/$ID
# 404 {"message":"Book not found","error":"Not Found","statusCode":404}
```

### Error examples

Broken JSON:

```bash
curl -i -X POST http://localhost:3000/api/books \
  -H 'Content-Type: application/json' \
  -d '{"title": "Dune",'
# 400 {"message":"Unexpected end of JSON input","error":"Bad Request","statusCode":400}
```

Empty title:

```bash
curl -i -X POST http://localhost:3000/api/books \
  -H 'Content-Type: application/json' \
  -d '{"title": ""}'
# 400 {"message":["title should not be empty"],"error":"Bad Request","statusCode":400}
```

Invalid status:

```bash
curl -i -X POST http://localhost:3000/api/books \
  -H 'Content-Type: application/json' \
  -d '{"title": "Dune", "status": "lost"}'
# 400 {"message":["status must be one of the following values: want, reading, done"],"error":"Bad Request","statusCode":400}
```

Missing `Content-Type` header:

```bash
curl -i -X POST http://localhost:3000/api/books -d '{"title": "Dune"}'
# 400 {"message":["title should not be empty","title must be a string"],"error":"Bad Request","statusCode":400}
```

An ID that isn't a UUID:

```bash
curl -i http://localhost:3000/api/books/made-up-id
# 400 {"message":"Validation failed (uuid is expected)","error":"Bad Request","statusCode":400}
```

Unknown route:

```bash
curl -i http://localhost:3000/api/anything
# 404 {"message":"Cannot GET /api/anything","error":"Not Found","statusCode":404}
```

## Working with the database directly

```bash
psql reading_list
```

Useful `psql` commands: `\dt` (list tables), `\d books` (describe the table), `\q` (quit).

```sql
SELECT * FROM books ORDER BY created_at;
```

Or browse and edit the data in the browser with `npm run db:studio` (in `backend/`).

To start over with an empty table (this deletes all books), in `backend/`:

```bash
npx prisma migrate reset
```
