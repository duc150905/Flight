const formatters = new Map<string, Intl.DateTimeFormat>();
const maxFormatters = 16;

export function formatFlightTime(iso: string, timezone: string, locale: string): string {
  const key = JSON.stringify([timezone, locale]);
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      timeZone: timezone, hour: '2-digit', minute: '2-digit',
    });
    if (formatters.size === maxFormatters) formatters.delete(formatters.keys().next().value!);
    formatters.set(key, formatter);
  }
  return formatter.format(new Date(iso));
}
