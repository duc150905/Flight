/** Accent-insensitive tokens keep codes/emails intact while accepting natural VI/EN queries. */
export function normalizeAdminSearch(value: string | null | undefined): string {
  return (value ?? '').toLocaleLowerCase('vi-VN').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim().replace(/\s+/g, ' ');
}
export function matchesAdminSearch(text: string, query: string): boolean {
  const needle = normalizeAdminSearch(query);
  if (!needle) return true;
  const haystack = normalizeAdminSearch(text);
  return needle.split(' ').every(token => haystack.includes(token));
}
export function adminQuickSearchRoute(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return '/admin/bookings';
  const flight = /^([a-z0-9]{2})\s*(\d{1,4})$/i.exec(trimmed);
  if (flight) return `/admin/flights?q=${encodeURIComponent(`${flight[1]}${flight[2]}`.toUpperCase())}`;
  return `/admin/bookings?q=${encodeURIComponent(trimmed)}`;
}
