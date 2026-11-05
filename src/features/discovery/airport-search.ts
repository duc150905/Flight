import type { Airport } from './model';

type SearchableAirport = Pick<Airport, 'city' | 'name' | 'iata_code'>;

const airportAliases: Readonly<Record<string, readonly string[]>> = {
  SGN: ['TPHCM', 'TP HCM', 'HCM', 'Thành phố Hồ Chí Minh', 'Ho Chi Minh City', 'Saigon', 'Sài Gòn', 'Tan Son Nhat'],
  HAN: ['Hanoi', 'Ha Noi', 'Noi Bai'],
  CXR: ['Nha Trang', 'Cam Ranh'],
};

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function compact(value: string): string {
  return value.replace(/ /g, '');
}

/** Search names and familiar aliases, with exact matches ahead of partial matches. */
export function searchAirports<T extends SearchableAirport>(
  airports: readonly T[], query: string, translatedNames: (airport: T) => readonly string[] = () => [],
): T[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return airports.slice(0, 12);
  const compactQuery = compact(normalizedQuery);
  const queryTokens = normalizedQuery.split(' ');

  return airports.map((airport, index) => {
    const code = normalize(airport.iata_code);
    const fields = [airport.city, airport.name, ...translatedNames(airport),
      ...(airportAliases[airport.iata_code.toUpperCase()] ?? [])].map(normalize).filter(Boolean);
    let rank = Infinity;
    if (compact(code) === compactQuery) rank = 0;
    else if (fields.some(field => compact(field) === compactQuery)) rank = 1;
    else if ([code, ...fields].some(field => field.includes(normalizedQuery))) rank = 2;
    else if (fields.some(field => compact(field).includes(compactQuery))) rank = 3;
    else {
      const tokens = fields.flatMap(field => field.split(' '));
      if (queryTokens.every(queryToken => tokens.some(token => token.includes(queryToken)))) rank = 4;
    }
    return { airport, index, rank };
  }).filter(match => Number.isFinite(match.rank))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, 12).map(match => match.airport);
}
