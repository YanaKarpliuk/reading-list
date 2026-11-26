-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "book_id" UUID NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id"),

    -- Added by hand: Prisma schemas can't describe CHECK constraints.
    -- Same rule as books.title: the text must not be empty or only spaces.
    CONSTRAINT "notes_text_check" CHECK (btrim("text") <> '')
);

-- CreateIndex
CREATE INDEX "notes_book_id_idx" ON "notes"("book_id");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
