export type CountryCallingCode = {
  iso: string;
  flag: string;
  dialCode: string;
  nameVi: string;
  nameEn: string;
  popular?: boolean;
};

export const COUNTRY_CALLING_CODES: CountryCallingCode[] = [
  // Phổ biến
  { iso: 'VN', flag: '🇻🇳', dialCode: '+84', nameVi: 'Việt Nam', nameEn: 'Vietnam', popular: true },
  { iso: 'SG', flag: '🇸🇬', dialCode: '+65', nameVi: 'Singapore', nameEn: 'Singapore', popular: true },
  { iso: 'TH', flag: '🇹🇭', dialCode: '+66', nameVi: 'Thái Lan', nameEn: 'Thailand', popular: true },
  { iso: 'MY', flag: '🇲🇾', dialCode: '+60', nameVi: 'Malaysia', nameEn: 'Malaysia', popular: true },
  { iso: 'ID', flag: '🇮🇩', dialCode: '+62', nameVi: 'Indonesia', nameEn: 'Indonesia', popular: true },
  { iso: 'PH', flag: '🇵🇭', dialCode: '+63', nameVi: 'Philippines', nameEn: 'Philippines', popular: true },
  { iso: 'JP', flag: '🇯🇵', dialCode: '+81', nameVi: 'Nhật Bản', nameEn: 'Japan', popular: true },
  { iso: 'KR', flag: '🇰🇷', dialCode: '+82', nameVi: 'Hàn Quốc', nameEn: 'South Korea', popular: true },
  { iso: 'CN', flag: '🇨🇳', dialCode: '+86', nameVi: 'Trung Quốc', nameEn: 'China', popular: true },
  { iso: 'TW', flag: '🇹🇼', dialCode: '+886', nameVi: 'Đài Loan', nameEn: 'Taiwan', popular: true },
  { iso: 'HK', flag: '🇭🇰', dialCode: '+852', nameVi: 'Hồng Kông', nameEn: 'Hong Kong', popular: true },
  { iso: 'US', flag: '🇺🇸', dialCode: '+1', nameVi: 'Hoa Kỳ', nameEn: 'United States', popular: true },
  { iso: 'GB', flag: '🇬🇧', dialCode: '+44', nameVi: 'Vương quốc Anh', nameEn: 'United Kingdom', popular: true },
  { iso: 'AU', flag: '🇦🇺', dialCode: '+61', nameVi: 'Úc', nameEn: 'Australia', popular: true },
  { iso: 'FR', flag: '🇫🇷', dialCode: '+33', nameVi: 'Pháp', nameEn: 'France', popular: true },
  { iso: 'DE', flag: '🇩🇪', dialCode: '+49', nameVi: 'Đức', nameEn: 'Germany', popular: true },

  // Đông Nam Á & Châu Á
  { iso: 'KH', flag: '🇰🇭', dialCode: '+855', nameVi: 'Campuchia', nameEn: 'Cambodia' },
  { iso: 'LA', flag: '🇱🇦', dialCode: '+856', nameVi: 'Lào', nameEn: 'Laos' },
  { iso: 'MM', flag: '🇲🇲', dialCode: '+95', nameVi: 'Myanmar', nameEn: 'Myanmar' },
  { iso: 'BN', flag: '🇧🇳', dialCode: '+673', nameVi: 'Brunei', nameEn: 'Brunei' },
  { iso: 'MO', flag: '🇲🇴', dialCode: '+853', nameVi: 'Ma Cao', nameEn: 'Macau' },
  { iso: 'IN', flag: '🇮🇳', dialCode: '+91', nameVi: 'Ấn Độ', nameEn: 'India' },
  { iso: 'MN', flag: '🇲🇳', dialCode: '+976', nameVi: 'Mông Cổ', nameEn: 'Mongolia' },
  { iso: 'BD', flag: '🇧🇩', dialCode: '+880', nameVi: 'Bangladesh', nameEn: 'Bangladesh' },
  { iso: 'NP', flag: '🇳🇵', dialCode: '+977', nameVi: 'Nepal', nameEn: 'Nepal' },
  { iso: 'LK', flag: '🇱🇰', dialCode: '+94', nameVi: 'Sri Lanka', nameEn: 'Sri Lanka' },
  { iso: 'PK', flag: '🇵🇰', dialCode: '+92', nameVi: 'Pakistan', nameEn: 'Pakistan' },

  // Châu Mỹ & Châu Đại Dương
  { iso: 'CA', flag: '🇨🇦', dialCode: '+1', nameVi: 'Canada', nameEn: 'Canada' },
  { iso: 'NZ', flag: '🇳🇿', dialCode: '+64', nameVi: 'New Zealand', nameEn: 'New Zealand' },
  { iso: 'BR', flag: '🇧🇷', dialCode: '+55', nameVi: 'Brazil', nameEn: 'Brazil' },
  { iso: 'MX', flag: '🇲🇽', dialCode: '+52', nameVi: 'Mexico', nameEn: 'Mexico' },
  { iso: 'AR', flag: '🇦🇷', dialCode: '+54', nameVi: 'Argentina', nameEn: 'Argentina' },
  { iso: 'CL', flag: '🇨🇱', dialCode: '+56', nameVi: 'Chile', nameEn: 'Chile' },
  { iso: 'CO', flag: '🇨🇴', dialCode: '+57', nameVi: 'Colombia', nameEn: 'Colombia' },

  // Châu Âu
  { iso: 'RU', flag: '🇷🇺', dialCode: '+7', nameVi: 'Nga', nameEn: 'Russia' },
  { iso: 'IT', flag: '🇮🇹', dialCode: '+39', nameVi: 'Ý', nameEn: 'Italy' },
  { iso: 'ES', flag: '🇪🇸', dialCode: '+34', nameVi: 'Tây Ban Nha', nameEn: 'Spain' },
  { iso: 'CH', flag: '🇨🇭', dialCode: '+41', nameVi: 'Thụy Sĩ', nameEn: 'Switzerland' },
  { iso: 'NL', flag: '🇳🇱', dialCode: '+31', nameVi: 'Hà Lan', nameEn: 'Netherlands' },
  { iso: 'SE', flag: '🇸🇪', dialCode: '+46', nameVi: 'Thụy Điển', nameEn: 'Sweden' },
  { iso: 'NO', flag: '🇳🇴', dialCode: '+47', nameVi: 'Na Uy', nameEn: 'Norway' },
  { iso: 'DK', flag: '🇩🇰', dialCode: '+45', nameVi: 'Đan Mạch', nameEn: 'Denmark' },
  { iso: 'FI', flag: '🇫🇮', dialCode: '+358', nameVi: 'Phần Lan', nameEn: 'Finland' },
  { iso: 'PL', flag: '🇵🇱', dialCode: '+48', nameVi: 'Ba Lan', nameEn: 'Poland' },
  { iso: 'CZ', flag: '🇨🇿', dialCode: '+420', nameVi: 'Cộng hòa Séc', nameEn: 'Czech Republic' },
  { iso: 'AT', flag: '🇦🇹', dialCode: '+43', nameVi: 'Áo', nameEn: 'Austria' },
  { iso: 'BE', flag: '🇧🇪', dialCode: '+32', nameVi: 'Bỉ', nameEn: 'Belgium' },
  { iso: 'PT', flag: '🇵🇹', dialCode: '+351', nameVi: 'Bồ Đào Nha', nameEn: 'Portugal' },
  { iso: 'GR', flag: '🇬🇷', dialCode: '+30', nameVi: 'Hy Lạp', nameEn: 'Greece' },
  { iso: 'IE', flag: '🇮🇪', dialCode: '+353', nameVi: 'Ireland', nameEn: 'Ireland' },
  { iso: 'HU', flag: '🇭🇺', dialCode: '+36', nameVi: 'Hungary', nameEn: 'Hungary' },
  { iso: 'UA', flag: '🇺🇦', dialCode: '+380', nameVi: 'Ukraine', nameEn: 'Ukraine' },

  // Trung Đông & Châu Phi
  { iso: 'AE', flag: '🇦🇪', dialCode: '+971', nameVi: 'Các TVQ Ả Rập Thống Nhất (UAE)', nameEn: 'United Arab Emirates' },
  { iso: 'SA', flag: '🇸🇦', dialCode: '+966', nameVi: 'Ả Rập Xê Út', nameEn: 'Saudi Arabia' },
  { iso: 'QA', flag: '🇶🇦', dialCode: '+974', nameVi: 'Qatar', nameEn: 'Qatar' },
  { iso: 'TR', flag: '🇹🇷', dialCode: '+90', nameVi: 'Thổ Nhĩ Kỳ', nameEn: 'Turkey' },
  { iso: 'IL', flag: '🇮🇱', dialCode: '+972', nameVi: 'Israel', nameEn: 'Israel' },
  { iso: 'ZA', flag: '🇿🇦', dialCode: '+27', nameVi: 'Nam Phi', nameEn: 'South Africa' },
  { iso: 'EG', flag: '🇪🇬', dialCode: '+20', nameVi: 'Ai Cập', nameEn: 'Egypt' },
];

function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function filterCountries(query: string): CountryCallingCode[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRY_CALLING_CODES;
  const qNoDiacritics = removeVietnameseDiacritics(q);
  const cleanQ = q.replace(/^\+/, '');

  return COUNTRY_CALLING_CODES.filter((c) => {
    const dialClean = c.dialCode.replace(/^\+/, '');
    if (dialClean.startsWith(cleanQ)) return true;
    if (c.iso.toLowerCase().includes(q)) return true;
    if (c.nameEn.toLowerCase().includes(q)) return true;
    if (c.nameVi.toLowerCase().includes(q)) return true;
    if (removeVietnameseDiacritics(c.nameVi).includes(qNoDiacritics)) return true;
    return false;
  });
}

export function findCountryByDialCode(dialCode: string): CountryCallingCode | undefined {
  if (!dialCode) return undefined;
  const clean = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
  return COUNTRY_CALLING_CODES.find((c) => c.dialCode === clean);
}

export function detectCountryFromPhone(raw: string): CountryCallingCode | undefined {
  if (!raw.startsWith('+')) return undefined;
  const sorted = [...COUNTRY_CALLING_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const item of sorted) {
    if (raw.startsWith(item.dialCode + ' ') || raw.startsWith(item.dialCode)) {
      return item;
    }
  }
  return undefined;
}

