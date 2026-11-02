-- CreateTable
CREATE TABLE "books" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "author" TEXT,
    "status" TEXT NOT NULL DEFAULT 'want',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id"),

    -- Added by hand: Prisma schemas can't describe CHECK constraints.
    -- The names match the ones Postgres gave them in the old db/schema.sql.
    CONSTRAINT "books_title_check" CHECK (btrim("title") <> ''),
    CONSTRAINT "books_status_check" CHECK ("status" IN ('want', 'reading', 'done'))
);
