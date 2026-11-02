import { z } from 'zod';

/** PostgreSQL UUID stores any 128-bit value, including deterministic seed hashes. */
export function databaseIdSchema(message = 'Invalid database ID.') {
  return z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, message).toLowerCase();
}
