export interface CountryOption {
  code: string; // ISO-2 (e.g. VN)
  nameVi: string;
  nameEn: string;
  flag: string;
  defaultTimezone: string;
}

export interface TimezoneOption {
  tz: string; // IANA (e.g. Asia/Ho_Chi_Minh)
  labelVi: string;
  labelEn: string;
  offset: string;
  countryCodes: string[];
}

export const POPULAR_COUNTRIES: CountryOption[] = [
  { code: 'VN', nameVi: 'Việt Nam', nameEn: 'Vietnam', flag: '🇻🇳', defaultTimezone: 'Asia/Ho_Chi_Minh' },
  { code: 'TH', nameVi: 'Thái Lan', nameEn: 'Thailand', flag: '🇹🇭', defaultTimezone: 'Asia/Bangkok' },
  { code: 'SG', nameVi: 'Singapore', nameEn: 'Singapore', flag: '🇸🇬', defaultTimezone: 'Asia/Singapore' },
  { code: 'MY', nameVi: 'Malaysia', nameEn: 'Malaysia', flag: '🇲🇾', defaultTimezone: 'Asia/Kuala_Lumpur' },
  { code: 'ID', nameVi: 'Indonesia', nameEn: 'Indonesia', flag: '🇮🇩', defaultTimezone: 'Asia/Jakarta' },
  { code: 'PH', nameVi: 'Philippines', nameEn: 'Philippines', flag: '🇵🇭', defaultTimezone: 'Asia/Manila' },
  { code: 'KH', nameVi: 'Campuchia', nameEn: 'Cambodia', flag: '🇰🇭', defaultTimezone: 'Asia/Phnom_Penh' },
  { code: 'LA', nameVi: 'Lào', nameEn: 'Laos', flag: '🇱🇦', defaultTimezone: 'Asia/Vientiane' },
  { code: 'MM', nameVi: 'Myanmar', nameEn: 'Myanmar', flag: '🇲🇲', defaultTimezone: 'Asia/Yangon' },
  { code: 'JP', nameVi: 'Nhật Bản', nameEn: 'Japan', flag: '🇯🇵', defaultTimezone: 'Asia/Tokyo' },
  { code: 'KR', nameVi: 'Hàn Quốc', nameEn: 'South Korea', flag: '🇰🇷', defaultTimezone: 'Asia/Seoul' },
  { code: 'CN', nameVi: 'Trung Quốc', nameEn: 'China', flag: '🇨🇳', defaultTimezone: 'Asia/Shanghai' },
  { code: 'TW', nameVi: 'Đài Loan', nameEn: 'Taiwan', flag: '🇹🇼', defaultTimezone: 'Asia/Taipei' },
  { code: 'HK', nameVi: 'Hồng Kông', nameEn: 'Hong Kong', flag: '🇭🇰', defaultTimezone: 'Asia/Hong_Kong' },
  { code: 'MO', nameVi: 'Ma Cao', nameEn: 'Macau', flag: '🇲🇴', defaultTimezone: 'Asia/Macau' },
  { code: 'IN', nameVi: 'Ấn Độ', nameEn: 'India', flag: '🇮🇳', defaultTimezone: 'Asia/Kolkata' },
  { code: 'AE', nameVi: 'Các TVQ Ả Rập Thống Nhất (UAE)', nameEn: 'United Arab Emirates', flag: '🇦🇪', defaultTimezone: 'Asia/Dubai' },
  { code: 'QA', nameVi: 'Qatar', nameEn: 'Qatar', flag: '🇶🇦', defaultTimezone: 'Asia/Qatar' },
  { code: 'AU', nameVi: 'Úc (Australia)', nameEn: 'Australia', flag: '🇦🇺', defaultTimezone: 'Australia/Sydney' },
  { code: 'NZ', nameVi: 'New Zealand', nameEn: 'New Zealand', flag: '🇳🇿', defaultTimezone: 'Pacific/Auckland' },
  { code: 'US', nameVi: 'Hoa Kỳ (Mỹ)', nameEn: 'United States', flag: '🇺🇸', defaultTimezone: 'America/New_York' },
  { code: 'CA', nameVi: 'Canada', nameEn: 'Canada', flag: '🇨🇦', defaultTimezone: 'America/Toronto' },
  { code: 'GB', nameVi: 'Vương quốc Anh', nameEn: 'United Kingdom', flag: '🇬🇧', defaultTimezone: 'Europe/London' },
  { code: 'FR', nameVi: 'Pháp', nameEn: 'France', flag: '🇫🇷', defaultTimezone: 'Europe/Paris' },
  { code: 'DE', nameVi: 'Đức', nameEn: 'Germany', flag: '🇩🇪', defaultTimezone: 'Europe/Berlin' },
  { code: 'IT', nameVi: 'Ý (Italy)', nameEn: 'Italy', flag: '🇮🇹', defaultTimezone: 'Europe/Rome' },
  { code: 'ES', nameVi: 'Tây Ban Nha', nameEn: 'Spain', flag: '🇪🇸', defaultTimezone: 'Europe/Madrid' },
  { code: 'NL', nameVi: 'Hà Lan', nameEn: 'Netherlands', flag: '🇳🇱', defaultTimezone: 'Europe/Amsterdam' },
  { code: 'CH', nameVi: 'Thụy Sĩ', nameEn: 'Switzerland', flag: '🇨🇭', defaultTimezone: 'Europe/Zurich' },
  { code: 'RU', nameVi: 'Nga', nameEn: 'Russia', flag: '🇷🇺', defaultTimezone: 'Europe/Moscow' },
  { code: 'TR', nameVi: 'Thổ Nhĩ Kỳ', nameEn: 'Turkey', flag: '🇹🇷', defaultTimezone: 'Europe/Istanbul' },
];

export const POPULAR_TIMEZONES: TimezoneOption[] = [
  {
    tz: 'Asia/Ho_Chi_Minh',
    labelVi: 'Việt Nam (Hà Nội, TP.HCM, Đà Nẵng)',
    labelEn: 'Vietnam (Hanoi, HCMC, Da Nang)',
    offset: 'GMT+7',
    countryCodes: ['VN'],
  },
  {
    tz: 'Asia/Bangkok',
    labelVi: 'Thái Lan, Campuchia, Lào',
    labelEn: 'Thailand, Cambodia, Laos',
    offset: 'GMT+7',
    countryCodes: ['TH', 'KH', 'LA'],
  },
  {
    tz: 'Asia/Singapore',
    labelVi: 'Singapore',
    labelEn: 'Singapore',
    offset: 'GMT+8',
    countryCodes: ['SG'],
  },
  {
    tz: 'Asia/Kuala_Lumpur',
    labelVi: 'Malaysia (Kuala Lumpur)',
    labelEn: 'Malaysia (Kuala Lumpur)',
    offset: 'GMT+8',
    countryCodes: ['MY'],
  },
  {
    tz: 'Asia/Jakarta',
    labelVi: 'Indonesia (Jakarta, Tây Indonesia)',
    labelEn: 'Western Indonesia (Jakarta)',
    offset: 'GMT+7',
    countryCodes: ['ID'],
  },
  {
    tz: 'Asia/Makassar',
    labelVi: 'Indonesia (Bali, Trung Indonesia)',
    labelEn: 'Central Indonesia (Bali)',
    offset: 'GMT+8',
    countryCodes: ['ID'],
  },
  {
    tz: 'Asia/Manila',
    labelVi: 'Philippines (Manila, Cebu)',
    labelEn: 'Philippines (Manila, Cebu)',
    offset: 'GMT+8',
    countryCodes: ['PH'],
  },
  {
    tz: 'Asia/Tokyo',
    labelVi: 'Nhật Bản (Tokyo, Osaka, Narita)',
    labelEn: 'Japan (Tokyo, Osaka, Narita)',
    offset: 'GMT+9',
    countryCodes: ['JP'],
  },
  {
    tz: 'Asia/Seoul',
    labelVi: 'Hàn Quốc (Seoul, Incheon, Busan)',
    labelEn: 'South Korea (Seoul, Incheon)',
    offset: 'GMT+9',
    countryCodes: ['KR'],
  },
  {
    tz: 'Asia/Shanghai',
    labelVi: 'Trung Quốc (Bắc Kinh, Thượng Hải, Quảng Châu)',
    labelEn: 'China (Beijing, Shanghai, Guangzhou)',
    offset: 'GMT+8',
    countryCodes: ['CN'],
  },
  {
    tz: 'Asia/Taipei',
    labelVi: 'Đài Loan (Đài Bắc, Đào Viên)',
    labelEn: 'Taiwan (Taipei, Taoyuan)',
    offset: 'GMT+8',
    countryCodes: ['TW'],
  },
  {
    tz: 'Asia/Hong_Kong',
    labelVi: 'Hồng Kông (Chek Lap Kok)',
    labelEn: 'Hong Kong',
    offset: 'GMT+8',
    countryCodes: ['HK'],
  },
  {
    tz: 'Asia/Dubai',
    labelVi: 'UAE (Dubai, Abu Dhabi)',
    labelEn: 'United Arab Emirates (Dubai)',
    offset: 'GMT+4',
    countryCodes: ['AE'],
  },
  {
    tz: 'Asia/Qatar',
    labelVi: 'Qatar (Doha - Hamad)',
    labelEn: 'Qatar (Doha)',
    offset: 'GMT+3',
    countryCodes: ['QA'],
  },
  {
    tz: 'Asia/Kolkata',
    labelVi: 'Ấn Độ (Delhi, Mumbai)',
    labelEn: 'India (Delhi, Mumbai)',
    offset: 'GMT+5:30',
    countryCodes: ['IN'],
  },
  {
    tz: 'Australia/Sydney',
    labelVi: 'Úc (Sydney, Melbourne, Bờ Đông)',
    labelEn: 'Australia (Sydney, Melbourne)',
    offset: 'GMT+10',
    countryCodes: ['AU'],
  },
  {
    tz: 'Australia/Perth',
    labelVi: 'Úc (Perth, Tây Úc)',
    labelEn: 'Australia (Perth, Western Australia)',
    offset: 'GMT+8',
    countryCodes: ['AU'],
  },
  {
    tz: 'Pacific/Auckland',
    labelVi: 'New Zealand (Auckland, Wellington)',
    labelEn: 'New Zealand (Auckland)',
    offset: 'GMT+12',
    countryCodes: ['NZ'],
  },
  {
    tz: 'Europe/Paris',
    labelVi: 'Pháp, Đức, Ý, Tây Âu (CDG, FRA)',
    labelEn: 'France, Germany, Central Europe',
    offset: 'GMT+1',
    countryCodes: ['FR', 'DE', 'IT', 'ES', 'NL', 'CH'],
  },
  {
    tz: 'Europe/London',
    labelVi: 'Vương quốc Anh (London Heathrow)',
    labelEn: 'United Kingdom (London)',
    offset: 'GMT+0',
    countryCodes: ['GB'],
  },
  {
    tz: 'Europe/Moscow',
    labelVi: 'Nga (Moskva)',
    labelEn: 'Russia (Moscow)',
    offset: 'GMT+3',
    countryCodes: ['RU'],
  },
  {
    tz: 'Europe/Istanbul',
    labelVi: 'Thổ Nhĩ Kỳ (Istanbul)',
    labelEn: 'Turkey (Istanbul)',
    offset: 'GMT+3',
    countryCodes: ['TR'],
  },
  {
    tz: 'America/New_York',
    labelVi: 'Hoa Kỳ (New York JFK, Washington DC - Bờ Đông)',
    labelEn: 'United States (New York, Eastern Time)',
    offset: 'GMT-5',
    countryCodes: ['US'],
  },
  {
    tz: 'America/Los_Angeles',
    labelVi: 'Hoa Kỳ (Los Angeles LAX, San Francisco - Bờ Tây)',
    labelEn: 'United States (Los Angeles, Pacific Time)',
    offset: 'GMT-8',
    countryCodes: ['US'],
  },
  {
    tz: 'America/Chicago',
    labelVi: 'Hoa Kỳ (Chicago O’Hare - Miền Trung)',
    labelEn: 'United States (Chicago, Central Time)',
    offset: 'GMT-6',
    countryCodes: ['US'],
  },
  {
    tz: 'America/Toronto',
    labelVi: 'Canada (Toronto, Montreal)',
    labelEn: 'Canada (Toronto, Montreal)',
    offset: 'GMT-5',
    countryCodes: ['CA'],
  },
];

export function findCountry(code: string): CountryOption | undefined {
  const normalized = code.trim().toUpperCase();
  return POPULAR_COUNTRIES.find((c) => c.code === normalized);
}

export function findTimezone(tz: string): TimezoneOption | undefined {
  const normalized = tz.trim();
  return POPULAR_TIMEZONES.find((t) => t.tz.toLowerCase() === normalized.toLowerCase());
}

export function getRecommendedTimezonesForCountry(countryCode: string): TimezoneOption[] {
  const normalized = countryCode.trim().toUpperCase();
  const matched = POPULAR_TIMEZONES.filter((t) => t.countryCodes.includes(normalized));
  if (matched.length > 0) return matched;
  // If no direct country mapping found in POPULAR_TIMEZONES, check country's defaultTimezone
  const country = findCountry(normalized);
  if (country) {
    const found = POPULAR_TIMEZONES.find((t) => t.tz === country.defaultTimezone);
    if (found) return [found];
  }
  return [];
}

export function searchCountries(queryText: string): CountryOption[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return POPULAR_COUNTRIES;
  return POPULAR_COUNTRIES.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.nameVi.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q)
  );
}

export function searchTimezones(queryText: string): TimezoneOption[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return POPULAR_TIMEZONES;
  return POPULAR_TIMEZONES.filter(
    (t) =>
      t.tz.toLowerCase().includes(q) ||
      t.labelVi.toLowerCase().includes(q) ||
      t.labelEn.toLowerCase().includes(q) ||
      t.offset.toLowerCase().includes(q)
  );
}

export function getTimezoneOffsetString(
  instantOrDate: Date | string,
  timezone: string = 'Asia/Ho_Chi_Minh',
): string {
  try {
    const d = typeof instantOrDate === 'string' ? new Date(instantOrDate) : instantOrDate;
    if (isNaN(d.getTime())) return '+07:00';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(d);
    const tzName = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (!tzName) return '+07:00';
    const match = tzName.match(/GMT([+-]\d+)(?::(\d+))?/);
    if (match) {
      const sign = match[1][0];
      const hours = Math.abs(parseInt(match[1], 10)).toString().padStart(2, '0');
      const mins = (match[2] || '00').padStart(2, '0');
      return `${sign}${hours}:${mins}`;
    }
    return '+07:00';
  } catch {
    return '+07:00';
  }
}

export function parseZonedFlight(iso: string, timezone: string = 'Asia/Ho_Chi_Minh') {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return {
      dateStr: iso ? iso.slice(0, 10) : '',
      timeStr: iso && iso.length >= 16 ? iso.slice(11, 16) : '',
      minutes: 0,
      ms: 0,
    };
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  let y = '', m = '', dd = '', h = '', min = '';
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    if (p.type === 'month') m = p.value;
    if (p.type === 'day') dd = p.value;
    if (p.type === 'hour') h = p.value === '24' ? '00' : p.value;
    if (p.type === 'minute') min = p.value;
  }
  const dateStr = `${y}-${m}-${dd}`;
  const timeStr = `${h}:${min}`;
  const minutes = Number(h) * 60 + Number(min);
  return { dateStr, timeStr, minutes, ms: d.getTime() };
}

