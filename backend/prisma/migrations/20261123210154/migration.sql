-- DropForeignKey
ALTER TABLE "notes" DROP CONSTRAINT "notes_book_id_fkey";

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
