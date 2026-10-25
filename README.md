# Reading List API

A small REST API for keeping track of books you want to read, are reading, or have finished.
It's a learning project: the same API is built several times, each version on its own branch.

This `main` branch is informational only. Switch to a branch to see the code.

## Versions

| Branch | Stack | What's inside |
| ------ | ----- | ------------- |
| [`v1.0.0-http-express`](https://github.com/YanaKarpliuk/reading-list/tree/v1.0.0-http-express) | Node.js, Express 5 | Two versions of the API: plain Node.js with the built-in `node:http` module (`server.js`) and Express (`server-express.js`). Books are stored in memory. |
| [`v2.0.0-express-postgres`](https://github.com/YanaKarpliuk/reading-list/tree/v2.0.0-express-postgres) | Express 5, PostgreSQL | The Express API with books stored in a PostgreSQL database, using the `pg` package and plain SQL. |
| [`v3.0.0-nest`](https://github.com/YanaKarpliuk/reading-list/tree/v3.0.0-nest) | NestJS 12, TypeScript, PostgreSQL | The same API rebuilt with NestJS: modules, controllers, services, dependency injection, and DTO validation. |

To try a version locally:

```bash
git switch v3.0.0-nest     # or another branch from the table
```

Each branch has its own README with setup instructions and curl examples.

## The API

Every version implements the same endpoints:

| Method   | Path                | Description                    |
| -------- | ------------------- | ------------------------------ |
| `GET`    | `/books`            | List all books                 |
| `GET`    | `/books?status=<s>` | List books with a given status |
| `GET`    | `/books/:id`        | Get one book                   |
| `POST`   | `/books`            | Create a book                  |
| `PATCH`  | `/books/:id`        | Update some fields of a book   |
| `DELETE` | `/books/:id`        | Delete a book                  |

A book has an `id`, a required `title`, an optional `author`, a `status` (`want`, `reading` or `done`),
and a `createdAt` date. `id` and `createdAt` are set by the server.
