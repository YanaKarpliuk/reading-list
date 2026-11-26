import { CreateNoteDto } from './create-note.dto.js';

// The body of PATCH /api/notes/:id. A note has only one field you can change,
// so it's required here too: unlike UpdateBookDto, this is not a PartialType.
// A PATCH without text would change nothing, so it's rejected with a 400.
export class UpdateNoteDto extends CreateNoteDto {}
