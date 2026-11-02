import { LanguagePicker, useLanguage } from '@/features/i18n/provider';
import { formatMoney, formatTime } from '@/features/i18n/translate';
import type { Language } from '@/features/i18n/language';

const viMessages: Record<string, string> = {
  'admin.title': 'Quản trị hệ thống Flight',
  'admin.subtitle': 'Quản lý danh mục, tàu bay, lịch bay, bảng giá và dịch vụ bổ sung (F09).',
  'admin.backToAccount': '← Tài khoản',
  'admin.backToHome': '← Tổng quan Quản trị',
  'admin.nav.home': 'Tổng quan',
  'admin.nav.catalogues': 'Danh mục',
  'admin.nav.aircraft': 'Máy bay & Ghế',
  'admin.nav.flights': 'Chuyến bay & Giá',
  'admin.nav.addons': 'Hành lý & Dịch vụ',
  'admin.status.active': 'Đang hoạt động',
  'admin.status.inactive': 'Ngừng hoạt động',
  'admin.filter.all': 'Tất cả',
  'admin.filter.active': 'Đang bật',
  'admin.filter.inactive': 'Đã tắt',
  'admin.search.placeholder': 'Tìm theo mã, tên hoặc thành phố…',
  'admin.pagination.summary': 'Trang {page}/{totalPages} · Tổng {total} mục',
  'admin.pagination.prev': '← Trang trước',
  'admin.pagination.next': 'Trang sau →',
  'admin.action.create': '+ Thêm mới',
  'admin.action.edit': 'Chỉnh sửa',
  'admin.action.save': 'Lưu thay đổi',
  'admin.action.cancel': 'Hủy',
  'admin.action.retry': 'Thử tải lại',
  'admin.action.refresh': 'Làm mới',
  'admin.action.deactivate': 'Ngừng hoạt động',
  'admin.action.activate': 'Kích hoạt lại',
  'admin.loading': 'Đang tải dữ liệu quản trị…',
  'admin.empty': 'Không có bản ghi nào khớp với bộ lọc hiện tại.',
  'admin.saved': 'Đã lưu dữ liệu thành công.',
};

const enMessages: Record<string, string> = {
  'admin.title': 'Flight Administration',
  'admin.subtitle': 'Manage catalogues, aircraft, flight schedules, fares, and add-on services (F09).',
  'admin.backToAccount': '← Account',
  'admin.backToHome': '← Admin Overview',
  'admin.nav.home': 'Overview',
  'admin.nav.catalogues': 'Catalogues',
  'admin.nav.aircraft': 'Aircraft & Seats',
  'admin.nav.flights': 'Flights & Fares',
  'admin.nav.addons': 'Baggage & Add-ons',
  'admin.status.active': 'Active',
  'admin.status.inactive': 'Inactive',
  'admin.filter.all': 'All',
  'admin.filter.active': 'Active',
  'admin.filter.inactive': 'Inactive',
  'admin.search.placeholder': 'Search by code, name, or city…',
  'admin.pagination.summary': 'Page {page}/{totalPages} · {total} items',
  'admin.pagination.prev': '← Previous',
  'admin.pagination.next': 'Next →',
  'admin.action.create': '+ Create new',
  'admin.action.edit': 'Edit',
  'admin.action.save': 'Save changes',
  'admin.action.cancel': 'Cancel',
  'admin.action.retry': 'Retry',
  'admin.action.refresh': 'Refresh',
  'admin.action.deactivate': 'Deactivate',
  'admin.action.activate': 'Activate',
  'admin.loading': 'Loading administration data…',
  'admin.empty': 'No records match the current filter.',
  'admin.saved': 'Changes saved successfully.',
};

export function translateAdmin(
  language: Language,
  key: string,
  params: Record<string, string | number> = {},
): string {
  const dict = language === 'vi' ? viMessages : enMessages;
  const template = dict[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, token: string) =>
    Object.hasOwn(params, token) ? String(params[token]) : match,
  );
}

function formatUtcOffsetLabel(instant: string, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date(instant));
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value;
    return offset ? `${offset} · ${timezone}` : timezone;
  } catch {
    return timezone;
  }
}

export function useAdminI18n() {
  const { language, setLanguage } = useLanguage();
  return {
    language,
    setLanguage,
    ta: (key: string, params?: Record<string, string | number>) =>
      translateAdmin(language, key, params),
    bi: (viText: string, enText: string) => (language === 'vi' ? viText : enText),
    money: (amount: number, currency = 'VND') => formatMoney(language, amount, currency),
    airportTime: (instant: string, timezone: string) =>
      `${formatTime(language, instant, timezone)} (${formatUtcOffsetLabel(instant, timezone)})`,
  };
}

export { LanguagePicker };

