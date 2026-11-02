import { router, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { ActionButton, Notice, colors } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { useAdminI18n } from '../i18n';
import { formatAdminError } from '../model';
import { AdminLoadingState, AdminShell, adminStyles } from '../ui';

async function loadF09Summary() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const [airports, airlines, destinations, aircraft, flights, fares, addons] = await Promise.all([
    supabase.from('airports').select('id,is_active'),
    supabase.from('airlines').select('id,is_active'),
    supabase.from('destinations').select('id,is_active,is_featured'),
    supabase.from('aircraft').select('id,is_active'),
    supabase.from('flight_instances').select('id,status,published_at'),
    supabase.from('flight_fares').select('id,is_active'),
    supabase.from('addon_products').select('id,is_active'),
  ]);
  const firstError =
    airports.error ??
    airlines.error ??
    destinations.error ??
    aircraft.error ??
    flights.error ??
    fares.error ??
    addons.error;
  if (firstError) throw firstError;

  return {
    airportsTotal: airports.data?.length ?? 0,
    airportsActive: airports.data?.filter((r) => r.is_active).length ?? 0,
    airlinesTotal: airlines.data?.length ?? 0,
    airlinesActive: airlines.data?.filter((r) => r.is_active).length ?? 0,
    destinationsTotal: destinations.data?.length ?? 0,
    destinationsFeatured: destinations.data?.filter((r) => r.is_active && r.is_featured).length ?? 0,
    aircraftTotal: aircraft.data?.length ?? 0,
    aircraftActive: aircraft.data?.filter((r) => r.is_active).length ?? 0,
    flightsTotal: flights.data?.length ?? 0,
    flightsPublished: flights.data?.filter((r) => r.published_at !== null).length ?? 0,
    faresTotal: fares.data?.length ?? 0,
    addonsTotal: addons.data?.length ?? 0,
  };
}

export function AdminHomeScreen() {
  const { ta, bi, language } = useAdminI18n();
  const summaryQuery = useQuery({
    queryKey: ['admin-f09-summary'],
    queryFn: loadF09Summary,
  });

  const s = summaryQuery.data;

  const modules = [
    {
      href: '/admin/catalogues' as const,
      title: bi('1. Danh mục Sân bay, Hãng bay & Điểm đến', '1. Airports, Airlines & Destinations'),
      desc: bi(
        'Quản lý mã IATA, thành phố, quốc gia, múi giờ IANA của sân bay; hãng hàng không và nội dung điểm đến gợi ý trên Trang chủ.',
        'Manage airport IATA codes, cities, ISO countries, IANA timezones; airlines and featured home destinations.',
      ),
      stats: s
        ? bi(
            `${s.airportsActive}/${s.airportsTotal} sân bay · ${s.airlinesActive}/${s.airlinesTotal} hãng bay · ${s.destinationsFeatured}/${s.destinationsTotal} điểm đến nổi bật`,
            `${s.airportsActive}/${s.airportsTotal} airports · ${s.airlinesActive}/${s.airlinesTotal} airlines · ${s.destinationsFeatured}/${s.destinationsTotal} featured destinations`,
          )
        : '',
    },
    {
      href: '/admin/aircraft' as const,
      title: bi('2. Máy bay & Sơ đồ ghế mẫu', '2. Aircraft & Seat Templates'),
      desc: bi(
        'Quản lý đội tàu bay theo hãng và thiết lập sơ đồ ghế mẫu 4 hạng ghế (First, Business, Premium Economy, Economy, hàng thoát hiểm).',
        'Manage airline fleet and configure 4-cabin seat templates (First, Business, Premium Economy, Economy, exit rows).',
      ),
      stats: s
        ? bi(
            `${s.aircraftActive}/${s.aircraftTotal} tàu bay đang hoạt động`,
            `${s.aircraftActive}/${s.aircraftTotal} active aircraft`,
          )
        : '',
    },
    {
      href: '/admin/flights' as const,
      title: bi('3. Lịch bay, Kho ghế & Bảng giá Hạng vé', '3. Flight Schedules, Seat Inventory & Fares'),
      desc: bi(
        'Lập lịch chuyến bay chống trùng lịch tàu bay, hiển thị theo múi giờ IANA của sân bay, đóng/mở bán, quản lý kho ghế và bảng giá vé.',
        'Schedule flights with aircraft conflict protection, airport IANA timezones, stop/reopen sales, manage seat inventory and fares.',
      ),
      stats: s
        ? bi(
            `${s.flightsPublished}/${s.flightsTotal} chuyến đã công bố · ${s.faresTotal} gói giá vé`,
            `${s.flightsPublished}/${s.flightsTotal} published flights · ${s.faresTotal} fares`,
          )
        : '',
    },
    {
      href: '/admin/addons' as const,
      title: bi('4. Hành lý, Suất ăn & Dịch vụ bổ sung', '4. Baggage, Meals & Add-on Offers'),
      desc: bi(
        'Quản lý danh mục gói hành lý ký gửi, suất ăn, bảo hiểm mô phỏng (Demo) và cấu hình đơn giá bán trên từng chuyến bay.',
        'Manage checked baggage packages, meals, simulated insurance products, and per-flight add-on offer pricing.',
      ),
      stats: s
        ? bi(`${s.addonsTotal} sản phẩm dịch vụ bổ sung`, `${s.addonsTotal} add-on products`)
        : '',
    },
  ];

  return (
    <AdminShell
      activeSection="home"
      title={ta('admin.title')}
      subtitle={ta('admin.subtitle')}
      rightAction={
        <Pressable
          accessibilityRole="button"
          onPress={() => void summaryQuery.refetch()}
          style={adminStyles.secondaryBtnSmall}
        >
          <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.refresh')}</Text>
        </Pressable>
      }
    >
      {summaryQuery.isPending && <AdminLoadingState />}
      {summaryQuery.isError && (
        <View style={adminStyles.card}>
          <Notice text={formatAdminError(summaryQuery.error, language)} />
          <ActionButton
            title={ta('admin.action.retry')}
            secondary
            onPress={() => void summaryQuery.refetch()}
          />
        </View>
      )}

      {modules.map((mod) => (
        <View key={mod.href} style={adminStyles.card}>
          <Text style={adminStyles.sectionTitle}>{mod.title}</Text>
          <Text style={adminStyles.muted}>{mod.desc}</Text>
          {!!mod.stats && (
            <Text style={[adminStyles.label, { color: colors.primary }]}>{mod.stats}</Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(mod.href as Href)}
            style={[adminStyles.primaryBtnSmall, { alignSelf: 'flex-start' }]}
          >
            <Text style={adminStyles.primaryBtnText}>
              {bi('Mở phân hệ quản lý →', 'Open management module →')}
            </Text>
          </Pressable>
        </View>
      ))}
    </AdminShell>
  );
}
