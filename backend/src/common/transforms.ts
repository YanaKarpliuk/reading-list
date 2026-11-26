import type { TransformFnParams } from 'class-transformer';

// For @Transform(trim) in DTOs: removes spaces around a string, so "  Dune "
// is saved as "Dune" and "   " counts as empty for @IsNotEmpty().
// Anything that isn't a string is passed on, for @IsString() to reject.
// Used by the books and the notes DTOs, so it lives outside both modules.
export const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;
