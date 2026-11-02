import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.generated';
import { parseQuote, quoteMatchesRequest, type quoteRequest } from './quote.ts';
export async function loadQuote(client: SupabaseClient<Database>, request: ReturnType<typeof quoteRequest>) {
  const response = await client.rpc('quote_checkout', { p_request: request });
  if (response.error) {
    const message = response.error.message;
    throw new Error(['quote.authRequired', 'quote.invalid', 'quote.unavailable', 'quote.offerUnavailable', 'quote.seatUnavailable', 'quote.seatIneligible', 'quote.soldOut'].includes(message) ? message : 'quote.loadError');
  }
  const value = parseQuote(response.data);
  if (!quoteMatchesRequest(value, request)) throw new Error('quote.invalid');
  return value;
}
