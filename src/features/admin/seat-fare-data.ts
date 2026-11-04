export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

export interface FarePreset {
  code: string;
  nameVi: string;
  nameEn: string;
  adultBase: number;
  childBase: number;
  infantBase: number;
  adultTax: number;
  adultFee: number;
  cabinPieces: number;
  cabinKg: number;
  checkedPieces: number;
  checkedKg: number;
  cancellationAllowed: boolean;
  cancellationCutoffMinutes: number;
  cancellationFeeAmount: number;
}

export interface CabinTemplate {
  key: CabinClass;
  vi: string;
  en: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  presets: FarePreset[];
}

export const CABIN_TEMPLATES: Record<CabinClass, CabinTemplate> = {
  economy: {
    key: 'economy',
    vi: 'Phổ thông (Economy)',
    en: 'Economy',
    icon: '💺',
    color: '#0369A1',
    bgColor: '#E0F2FE',
    borderColor: '#7DD3FC',
    presets: [
      {
        code: 'ECO_SAVER',
        nameVi: 'Phổ thông Tiết kiệm',
        nameEn: 'Economy Saver',
        adultBase: 1290000,
        childBase: 980000,
        infantBase: 150000,
        adultTax: 180000,
        adultFee: 100000,
        cabinPieces: 1,
        cabinKg: 7,
        checkedPieces: 1,
        checkedKg: 20,
        cancellationAllowed: true,
        cancellationCutoffMinutes: 180,
        cancellationFeeAmount: 300000,
      },
      {
        code: 'ECO_STANDARD',
        nameVi: 'Phổ thông Tiêu chuẩn',
        nameEn: 'Economy Standard',
        adultBase: 1690000,
        childBase: 1280000,
        infantBase: 150000,
        adultTax: 180000,
        adultFee: 100000,
        cabinPieces: 1,
        cabinKg: 10,
        checkedPieces: 1,
        checkedKg: 23,
        cancellationAllowed: true,
        cancellationCutoffMinutes: 120,
        cancellationFeeAmount: 200000,
      },
      {
        code: 'ECO_FLEX',
        nameVi: 'Phổ thông Linh hoạt',
        nameEn: 'Economy Flex',
        adultBase: 2190000,
        childBase: 1650000,
        infantBase: 150000,
        adultTax: 180000,
        adultFee: 100000,
        cabinPieces: 1,
        cabinKg: 12,
        checkedPieces: 2,
        checkedKg: 23,
        cancellationAllowed: true,
        cancellationCutoffMinutes: 60,
        cancellationFeeAmount: 100000,
      },
    ],
  },
  premium_economy: {
    key: 'premium_economy',
    vi: 'Phổ thông Đặc biệt (Premium Economy)',
    en: 'Premium Economy',
    icon: '🌟',
    color: '#0D9488',
    bgColor: '#CCFBF1',
    borderColor: '#5EEAD4',
    presets: [
      {
        code: 'PRE_STANDARD',
        nameVi: 'Phổ thông Đặc biệt Tiêu chuẩn',
        nameEn: 'Premium Economy Standard',
        adultBase: 2490000,
        childBase: 1880000,
        infantBase: 200000,
        adultTax: 220000,
        adultFee: 120000,
        cabinPieces: 2,
        cabinKg: 10,
        checkedPieces: 1,
        checkedKg: 32,
        cancellationAllowed: true,
        cancellationCutoffMinutes: 120,
        cancellationFeeAmount: 200000,
      },
      {
        code: 'PRE_FLEX',
        nameVi: 'Phổ thông Đặc biệt Linh hoạt',
        nameEn: 'Premium Economy Flex',
        adultBase: 3190000,
        childBase: 2400000,
        infantBase: 200000,
        adultTax: 220000,
        adultFee: 120000,
        cabinPieces: 2,
        cabinKg: 12,
        checkedPieces: 2,
        checkedKg: 23,
        cancellationAllowed: true,
        cancellationCutoffMinutes: 60,
        cancellationFeeAmount: 100000,
      },
    ],
  },
  business: {
    key: 'business',
    vi: 'Thương gia (Business)',
    en: 'Business',
    icon: '💼',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
    borderColor: '#C4B5FD',
    presets: [
      {
        code: 'BUS_STANDARD',
        nameVi: 'Thương gia Tiêu chuẩn',
        nameEn: 'Business Standard',
        adultBase: 4590000,
        childBase: 3450000,
        infantBase: 300000,
        adultTax: 300000,
        adultFee: 150000,
        cabinPieces: 2,
        cabinKg: 14,
        checkedPieces: 2,
        checkedKg: 32,
        cancellationAllowed: true,
        cancellationCutoffMinutes: 60,
        cancellationFeeAmount: 150000,
      },
      {
        code: 'BUS_FLEX',
        nameVi: 'Thương gia Linh hoạt',
        nameEn: 'Business Flex',
        adultBase: 5890000,
        childBase: 4420000,
        infantBase: 300000,
        adultTax: 300000,
        adultFee: 150000,
        cabinPieces: 2,
        cabinKg: 18,
        checkedPieces: 2,
        checkedKg: 40,
        cancellationAllowed: true,
        cancellationCutoffMinutes: 30,
        cancellationFeeAmount: 0,
      },
    ],
  },
  first: {
    key: 'first',
    vi: 'Hạng nhất (First Class)',
    en: 'First Class',
    icon: '👑',
    color: '#B45309',
    bgColor: '#FEF3C7',
    borderColor: '#FCD34D',
    presets: [
      {
        code: 'FIRST_ROYAL',
        nameVi: 'Hạng nhất Hoàng gia',
        nameEn: 'First Class Royal',
        adultBase: 8900000,
        childBase: 6680000,
        infantBase: 500000,
        adultTax: 450000,
        adultFee: 200000,
        cabinPieces: 2,
        cabinKg: 18,
        checkedPieces: 3,
        checkedKg: 32,
        cancellationAllowed: true,
        cancellationCutoffMinutes: 30,
        cancellationFeeAmount: 0,
      },
      {
        code: 'FIRST_FLEX',
        nameVi: 'Hạng nhất Linh hoạt',
        nameEn: 'First Class Flex',
        adultBase: 11900000,
        childBase: 8920000,
        infantBase: 500000,
        adultTax: 450000,
        adultFee: 200000,
        cabinPieces: 2,
        cabinKg: 20,
        checkedPieces: 3,
        checkedKg: 40,
        cancellationAllowed: true,
        cancellationCutoffMinutes: 15,
        cancellationFeeAmount: 0,
      },
    ],
  },
};

export function getCabinInfo(cabin: CabinClass, bi: (v: string, e: string) => string) {
  const tpl = CABIN_TEMPLATES[cabin] || CABIN_TEMPLATES.economy;
  return {
    key: tpl.key,
    label: bi(tpl.vi, tpl.en),
    shortLabel: bi(
      cabin === 'economy'
        ? 'Phổ thông'
        : cabin === 'premium_economy'
          ? 'Phổ thông ĐB'
          : cabin === 'business'
            ? 'Thương gia'
            : 'Hạng nhất',
      tpl.en,
    ),
    icon: tpl.icon,
    color: tpl.color,
    bgColor: tpl.bgColor,
    borderColor: tpl.borderColor,
    presets: tpl.presets,
  };
}

export function getSeatPositionInfo(
  pos: 'window' | 'aisle' | 'middle',
  isExit: boolean,
  bi: (v: string, e: string) => string,
) {
  let posText = '';
  let icon = '';
  if (pos === 'window') {
    posText = bi('Cửa sổ', 'Window');
    icon = '🪟';
  } else if (pos === 'aisle') {
    posText = bi('Lối đi', 'Aisle');
    icon = '🚶';
  } else {
    posText = bi('Ở giữa', 'Middle');
    icon = '👥';
  }

  const exitText = isExit ? bi('🚪 Cửa thoát hiểm (Chân rộng)', '🚪 Exit Row (Extra legroom)') : '';

  return {
    label: `${icon} ${posText}`,
    fullLabel: `${icon} ${posText}${exitText ? ' · ' + exitText : ''}`,
    icon,
    posText,
    exitText,
    isExit,
  };
}

