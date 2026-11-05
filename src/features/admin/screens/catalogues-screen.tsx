import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { useAdminI18n } from '../i18n';
import {
  filterAndPaginate,
  formatAdminError,
  saveAdminAirline,
  saveAdminAirport,
  saveAdminDestination,
  type AirlineRow,
  type AirportRow,
  type DestinationRow,
  type StatusFilter,
} from '../model';
import {
  AdminLoadingState,
  AdminPaginationBar,
  AdminSearchFilterBar,
  AdminShell,
  AdminStatusBadge,
  AdminTextField,
  adminStyles,
} from '../ui';

import { CataloguePicker } from '../catalogue-picker';
import { isHttpsMediaPath, validateAirlineMedia, validateDestinationMedia } from '../../discovery/media-paths';
import { loadCatalogues } from '../catalogue-data';

type CatalogueTab = 'airports' | 'airlines' | 'destinations';


export function AdminCataloguesScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  return <AdminCataloguesContent key={initialQuery} initialQuery={initialQuery} />;
}

function AdminCataloguesContent({ initialQuery }: { initialQuery: string }) {
  const { ta, bi, language } = useAdminI18n();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<CatalogueTab>('airports');
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states for Airport
  const [editingAirport, setEditingAirport] = useState<AirportRow | null>(null);
  const [showAirportForm, setShowAirportForm] = useState(false);
  const [apIata, setApIata] = useState('');
  const [apName, setApName] = useState('');
  const [apCity, setApCity] = useState('');
  const [apCountry, setApCountry] = useState('VN');
  const [apTimezone, setApTimezone] = useState('Asia/Ho_Chi_Minh');
  const [apActive, setApActive] = useState(true);

  // Form states for Airline
  const [editingAirline, setEditingAirline] = useState<AirlineRow | null>(null);
  const [showAirlineForm, setShowAirlineForm] = useState(false);
  const [alIata, setAlIata] = useState('');
  const [alName, setAlName] = useState('');
  const [alLogo, setAlLogo] = useState('');
  const [alActive, setAlActive] = useState(true);

  // Form states for Destination
  const [editingDest, setEditingDest] = useState<DestinationRow | null>(null);
  const [showDestForm, setShowDestForm] = useState(false);
  const [destAirportId, setDestAirportId] = useState('');
  const [destSlug, setDestSlug] = useState('');
  const [destTitle, setDestTitle] = useState('');
  const [destDesc, setDestDesc] = useState('');
  const [destImage, setDestImage] = useState('');
  const [destFeatured, setDestFeatured] = useState(true);
  const [destSort, setDestSort] = useState('1');
  const [destActive, setDestActive] = useState(true);

  const dataQuery = useQuery({
    queryKey: ['admin-catalogues'],
    queryFn: () => {
      if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
      return loadCatalogues(supabase);
    },
  });

  const airports = dataQuery.data?.airports ?? [];
  const airlines = dataQuery.data?.airlines ?? [];
  const destinations = dataQuery.data?.destinations ?? [];
  const airportById = new Map(airports.map((a) => [a.id, a]));

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-catalogues'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-f09-summary'] });
    await queryClient.invalidateQueries({ queryKey: ['airports'] });
    await queryClient.invalidateQueries({ queryKey: ['featured-destinations'] });
  };

  const openAirportEditor = (airport?: AirportRow) => {
    setError('');
    setSuccess('');
    setEditingAirport(airport ?? null);
    setApIata(airport?.iata_code ?? '');
    setApName(airport?.name ?? '');
    setApCity(airport?.city ?? '');
    setApCountry(airport?.country_code ?? 'VN');
    setApTimezone(airport?.timezone ?? 'Asia/Ho_Chi_Minh');
    setApActive(airport?.is_active ?? true);
    setShowAirportForm(true);
  };

  const submitAirport = async () => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await saveAdminAirport(supabase, {
        id: editingAirport?.id ?? null,
        iataCode: apIata,
        name: apName,
        city: apCity,
        countryCode: apCountry,
        timezone: apTimezone,
        isActive: apActive,
      });
      await refreshAll();
      setShowAirportForm(false);
      setSuccess(ta('admin.saved'));
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const toggleAirportActive = async (airport: AirportRow) => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await saveAdminAirport(supabase, {
        id: airport.id,
        iataCode: airport.iata_code,
        name: airport.name,
        city: airport.city,
        countryCode: airport.country_code,
        timezone: airport.timezone,
        isActive: !airport.is_active,
      });
      await refreshAll();
      setSuccess(ta('admin.saved'));
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const openAirlineEditor = (airline?: AirlineRow) => {
    setError('');
    setSuccess('');
    setEditingAirline(airline ?? null);
    setAlIata(airline?.iata_code ?? '');
    setAlName(airline?.name ?? '');
    setAlLogo(airline?.logo_path ?? '');
    setAlActive(airline?.is_active ?? true);
    setShowAirlineForm(true);
  };

  const submitAirline = async () => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (!validateAirlineMedia(alLogo, editingAirline?.logo_path).valid) throw new Error(bi(
        'Dùng URL logo HTTPS. Đường dẫn hãng cũ chỉ hiển thị chữ cái đầu; không thể thay bằng đường dẫn tương đối mới.',
        'Use an HTTPS logo URL. Legacy airline paths show the initial only; new relative paths are unsupported.'));
      await saveAdminAirline(supabase, {
        id: editingAirline?.id ?? null,
        iataCode: alIata,
        name: alName,
        logoPath: alLogo,
        isActive: alActive,
      });
      await refreshAll();
      setShowAirlineForm(false);
      setSuccess(ta('admin.saved'));
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const toggleAirlineActive = async (airline: AirlineRow) => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await saveAdminAirline(supabase, {
        id: airline.id,
        iataCode: airline.iata_code,
        name: airline.name,
        logoPath: airline.logo_path ?? undefined,
        isActive: !airline.is_active,
      });
      await refreshAll();
      setSuccess(ta('admin.saved'));
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const openDestEditor = (dest?: DestinationRow) => {
    setError('');
    setSuccess('');
    setEditingDest(dest ?? null);
    setDestAirportId(dest?.airport_id ?? airports[0]?.id ?? '');
    setDestSlug(dest?.slug ?? '');
    setDestTitle(dest?.title ?? '');
    setDestDesc(dest?.description ?? '');
    setDestImage(dest?.image_path ?? '');
    setDestFeatured(dest?.is_featured ?? true);
    setDestSort(String(dest?.sort_order ?? 1));
    setDestActive(dest?.is_active ?? true);
    setShowDestForm(true);
  };

  const submitDest = async () => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (!validateDestinationMedia(destImage).valid) throw new Error(bi(
        'Dùng URL ảnh HTTPS hoặc đường dẫn ảnh có sẵn, ví dụ destinations/da-nang.jpg.',
        'Use an HTTPS image URL or a bundled path such as destinations/da-nang.jpg.'));
      await saveAdminDestination(supabase, {
        id: editingDest?.id ?? null,
        airportId: destAirportId,
        slug: destSlug,
        title: destTitle,
        description: destDesc,
        imagePath: destImage,
        isFeatured: destFeatured,
        sortOrder: Number(destSort),
        isActive: destActive,
      });
      await refreshAll();
      setShowDestForm(false);
      setSuccess(ta('admin.saved'));
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const toggleDestActive = async (dest: DestinationRow) => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await saveAdminDestination(supabase, {
        id: dest.id,
        airportId: dest.airport_id,
        slug: dest.slug,
        title: dest.title,
        description: dest.description ?? undefined,
        imagePath: dest.image_path ?? undefined,
        isFeatured: dest.is_featured,
        sortOrder: dest.sort_order,
        isActive: !dest.is_active,
      });
      await refreshAll();
      setSuccess(ta('admin.saved'));
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const pagedAirports = filterAndPaginate(airports, {
    query,
    statusFilter,
    page,
    pageSize: 8,
    getSearchText: (item) => `${item.iata_code} ${item.name} ${item.city} ${item.country_code} ${item.timezone}`,
    getIsActive: (item) => item.is_active,
  });

  const pagedAirlines = filterAndPaginate(airlines, {
    query,
    statusFilter,
    page,
    pageSize: 8,
    getSearchText: (item) => `${item.iata_code} ${item.name}`,
    getIsActive: (item) => item.is_active,
  });

  const pagedDestinations = filterAndPaginate(destinations, {
    query,
    statusFilter,
    page,
    pageSize: 8,
    getSearchText: (item) => {
      const ap = airportById.get(item.airport_id);
      return `${item.slug} ${item.title} ${item.description ?? ''} ${ap?.iata_code ?? ''} ${ap?.city ?? ''}`;
    },
    getIsActive: (item) => item.is_active,
  });

  return (
    <AdminShell
      activeSection="catalogues"
      title={bi('Danh mục Sân bay, Hãng bay & Điểm đến', 'Airports, Airlines & Destinations')}
      subtitle={bi(
        'Ngừng hoạt động thay vì xóa cứng để bảo toàn lịch sử đơn đặt vé.',
        'Deactivate instead of hard-deleting to preserve historical booking references.',
      )}
      onQuickSearch={(txt) => {
        setQuery(txt);
        setPage(1);
      }}
    >
      <View style={adminStyles.chipRow}>
        {(
          [
            { key: 'airports', label: bi(`Sân bay (${airports.length})`, `Airports (${airports.length})`) },
            { key: 'airlines', label: bi(`Hãng bay (${airlines.length})`, `Airlines (${airlines.length})`) },
            {
              key: 'destinations',
              label: bi(`Điểm đến (${destinations.length})`, `Destinations (${destinations.length})`),
            },
          ] as const
        ).map((item) => {
          const selected = tab === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setTab(item.key);
                setPage(1);
                setError('');
                setSuccess('');
              }}
              style={[adminStyles.chip, selected && adminStyles.chipSelected]}
            >
              <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <AdminSearchFilterBar
        query={query}
        onQueryChange={(val) => {
          setQuery(val);
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(val) => {
          setStatusFilter(val);
          setPage(1);
        }}
        onRefresh={() => void dataQuery.refetch()}
        onCreate={() => {
          if (tab === 'airports') openAirportEditor();
          else if (tab === 'airlines') openAirlineEditor();
          else openDestEditor();
        }}
      />

      <Notice text={success} success />
      <Notice text={error} />

      {dataQuery.isPending && <AdminLoadingState />}
      {dataQuery.isError && (
        <View style={adminStyles.card}>
          <Notice text={formatAdminError(dataQuery.error, language)} />
          <ActionButton
            title={ta('admin.action.retry')}
            secondary
            onPress={() => void dataQuery.refetch()}
          />
        </View>
      )}

      {/* AIRPORT FORM */}
      {tab === 'airports' && showAirportForm && (
        <View style={adminStyles.card}>
          <Text style={adminStyles.sectionTitle}>
            {editingAirport
              ? bi(`Sửa sân bay ${editingAirport.iata_code}`, `Edit airport ${editingAirport.iata_code}`)
              : bi('Thêm sân bay mới', 'Create new airport')}
          </Text>
          <AdminTextField
            label={bi('Mã IATA (3 chữ cái in hoa)', 'IATA Code (3 uppercase letters)')}
            value={apIata}
            onChangeText={setApIata}
            placeholder="SGN"
            autoCapitalize="characters"
          />
          <AdminTextField
            label={bi('Tên sân bay', 'Airport name')}
            value={apName}
            onChangeText={setApName}
            placeholder="Sân bay Quốc tế Tân Sơn Nhất"
            autoCapitalize="words"
          />
          <AdminTextField
            label={bi('Thành phố', 'City')}
            value={apCity}
            onChangeText={setApCity}
            placeholder="TP. Hồ Chí Minh"
            autoCapitalize="words"
          />
          <AdminTextField
            label={bi('Mã quốc gia ISO-2', 'ISO-2 Country Code')}
            value={apCountry}
            onChangeText={setApCountry}
            placeholder="VN"
            autoCapitalize="characters"
          />
          <AdminTextField
            label={bi('Múi giờ IANA', 'IANA Timezone')}
            value={apTimezone}
            onChangeText={setApTimezone}
            placeholder="Asia/Ho_Chi_Minh"
            helperText={bi(
              'Ví dụ: Asia/Ho_Chi_Minh, Asia/Singapore, Asia/Bangkok, Asia/Tokyo',
              'Examples: Asia/Ho_Chi_Minh, Asia/Singapore, Asia/Bangkok, Asia/Tokyo',
            )}
          />
          <View style={adminStyles.rowGap}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setApActive((v) => !v)}
              style={[adminStyles.chip, apActive && adminStyles.chipSelected]}
            >
              <Text style={adminStyles.chipText}>
                {apActive ? ta('admin.status.active') : ta('admin.status.inactive')}
              </Text>
            </Pressable>
          </View>
          <View style={adminStyles.rowGap}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void submitAirport()}
              style={adminStyles.primaryBtnSmall}
            >
              <Text style={adminStyles.primaryBtnText}>{ta('admin.action.save')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setShowAirportForm(false)}
              style={adminStyles.secondaryBtnSmall}
            >
              <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* AIRLINE FORM */}
      {tab === 'airlines' && showAirlineForm && (
        <View style={adminStyles.card}>
          <Text style={adminStyles.sectionTitle}>
            {editingAirline
              ? bi(`Sửa hãng bay ${editingAirline.iata_code}`, `Edit airline ${editingAirline.iata_code}`)
              : bi('Thêm hãng hàng không mới', 'Create new airline')}
          </Text>
          <AdminTextField
            label={bi('Mã IATA (2 ký tự)', 'IATA Code (2 chars)')}
            value={alIata}
            onChangeText={setAlIata}
            placeholder="VN"
            autoCapitalize="characters"
          />
          <AdminTextField
            label={bi('Tên hãng hàng không', 'Airline name')}
            value={alName}
            onChangeText={setAlName}
            placeholder="Vietnam Airlines"
            autoCapitalize="words"
          />
          <AdminTextField
            label={bi('URL logo HTTPS (tùy chọn)', 'HTTPS logo URL (optional)')}
            helperText={bi('Để trống dùng chữ cái đầu. Đường dẫn hãng cũ chỉ dùng chữ cái đầu.', 'Leave empty for an initial. Legacy airline paths display the initial only.')}
            value={alLogo}
            onChangeText={setAlLogo}
            placeholder="airlines/vn.png"
          />
          <View style={adminStyles.rowGap}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAlActive((v) => !v)}
              style={[adminStyles.chip, alActive && adminStyles.chipSelected]}
            >
              <Text style={adminStyles.chipText}>
                {alActive ? ta('admin.status.active') : ta('admin.status.inactive')}
              </Text>
            </Pressable>
          </View>
          <View style={adminStyles.rowGap}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void submitAirline()}
              style={adminStyles.primaryBtnSmall}
            >
              <Text style={adminStyles.primaryBtnText}>{ta('admin.action.save')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setShowAirlineForm(false)}
              style={adminStyles.secondaryBtnSmall}
            >
              <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* DESTINATION FORM */}
      {tab === 'destinations' && showDestForm && (
        <View style={adminStyles.card}>
          <Text style={adminStyles.sectionTitle}>
            {editingDest
              ? bi(`Sửa điểm đến ${editingDest.slug}`, `Edit destination ${editingDest.slug}`)
              : bi('Thêm điểm đến gợi ý mới', 'Create new destination')}
          </Text>
          <CataloguePicker items={airports} value={destAirportId} label={bi('Sân bay điểm đến', 'Destination Airport')}
            getLabel={ap => `${ap.iata_code} · ${ap.city} · ${ap.name}`} onSelect={ap => setDestAirportId(ap.id)} />

          <AdminTextField
            label="Slug"
            value={destSlug}
            onChangeText={setDestSlug}
            placeholder="da-nang"
          />
          <AdminTextField
            label={bi('Tiêu đề hiển thị', 'Display title')}
            value={destTitle}
            onChangeText={setDestTitle}
            placeholder="Đà Nẵng — Thành phố đáng sống"
            autoCapitalize="sentences"
          />
          <AdminTextField
            label={bi('Mô tả ngắn', 'Short description')}
            value={destDesc}
            onChangeText={setDestDesc}
            placeholder="Biển Mỹ Khê, Cầu Rồng..."
            autoCapitalize="sentences"
          />
          <AdminTextField
            label={bi('Đường dẫn ảnh (image_path)', 'Image path (image_path)')}
            helperText={bi('HTTPS hoặc destinations/ha-noi.jpg, da-nang.jpg, phu-quoc.jpg, nha-trang.jpg, da-lat.jpg, hue.jpg, singapore.jpg, bangkok.jpg. Để trống dùng ảnh sân bay.', 'HTTPS or destinations/ha-noi.jpg, da-nang.jpg, phu-quoc.jpg, nha-trang.jpg, da-lat.jpg, hue.jpg, singapore.jpg, bangkok.jpg. Leave empty for the airport image.')}
            value={destImage}
            onChangeText={setDestImage}
            placeholder="destinations/da-nang.jpg"
          />
          <AdminTextField
            label={bi('Thứ tự hiển thị (sort_order)', 'Sort order')}
            value={destSort}
            onChangeText={setDestSort}
            keyboardType="numeric"
            placeholder="1"
          />
          <View style={adminStyles.rowGap}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDestFeatured((v) => !v)}
              style={[adminStyles.chip, destFeatured && adminStyles.chipSelected]}
            >
              <Text style={adminStyles.chipText}>
                {destFeatured
                  ? bi('★ Nổi bật trên Trang chủ', '★ Featured on Home')
                  : bi('Không nổi bật', 'Not featured')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDestActive((v) => !v)}
              style={[adminStyles.chip, destActive && adminStyles.chipSelected]}
            >
              <Text style={adminStyles.chipText}>
                {destActive ? ta('admin.status.active') : ta('admin.status.inactive')}
              </Text>
            </Pressable>
          </View>
          <View style={adminStyles.rowGap}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void submitDest()}
              style={adminStyles.primaryBtnSmall}
            >
              <Text style={adminStyles.primaryBtnText}>{ta('admin.action.save')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setShowDestForm(false)}
              style={adminStyles.secondaryBtnSmall}
            >
              <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* LIST: AIRPORTS */}
      {!dataQuery.isPending && tab === 'airports' && (
        <>
          {pagedAirports.items.length === 0 && (
            <View style={adminStyles.card}>
              <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
            </View>
          )}
          {pagedAirports.items.map((ap) => (
            <View key={ap.id} style={adminStyles.itemCard}>
              <View style={adminStyles.rowBetween}>
                <Text style={adminStyles.bold}>
                  {ap.iata_code} · {ap.city} ({ap.country_code})
                </Text>
                <AdminStatusBadge active={ap.is_active} />
              </View>
              <Text style={adminStyles.muted}>
                {ap.name} · {bi('Múi giờ', 'Timezone')}: {ap.timezone}
              </Text>
              <View style={adminStyles.rowGap}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openAirportEditor(ap)}
                  style={adminStyles.secondaryBtnSmall}
                >
                  <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.edit')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void toggleAirportActive(ap)}
                  style={ap.is_active ? adminStyles.dangerBtnSmall : adminStyles.primaryBtnSmall}
                >
                  <Text style={ap.is_active ? adminStyles.dangerBtnText : adminStyles.primaryBtnText}>
                    {ap.is_active ? ta('admin.action.deactivate') : ta('admin.action.activate')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
          <AdminPaginationBar
            page={pagedAirports.page}
            totalPages={pagedAirports.totalPages}
            total={pagedAirports.total}
            onPageChange={setPage}
          />
        </>
      )}

      {/* LIST: AIRLINES */}
      {!dataQuery.isPending && tab === 'airlines' && (
        <>
          {pagedAirlines.items.length === 0 && (
            <View style={adminStyles.card}>
              <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
            </View>
          )}
          {pagedAirlines.items.map((al) => (
            <View key={al.id} style={adminStyles.itemCard}>
              <View style={adminStyles.rowBetween}>
                <Text style={adminStyles.bold}>
                  {al.iata_code} · {al.name}
                </Text>
                <AdminStatusBadge active={al.is_active} />
              </View>
              {!!al.logo_path && <Text style={adminStyles.muted}>Logo: {al.logo_path}{!isHttpsMediaPath(al.logo_path) ? bi(' · Đường dẫn cũ: hiển thị chữ cái đầu', ' · Legacy path: initial fallback') : ''}</Text>}
              <View style={adminStyles.rowGap}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openAirlineEditor(al)}
                  style={adminStyles.secondaryBtnSmall}
                >
                  <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.edit')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void toggleAirlineActive(al)}
                  style={al.is_active ? adminStyles.dangerBtnSmall : adminStyles.primaryBtnSmall}
                >
                  <Text style={al.is_active ? adminStyles.dangerBtnText : adminStyles.primaryBtnText}>
                    {al.is_active ? ta('admin.action.deactivate') : ta('admin.action.activate')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
          <AdminPaginationBar
            page={pagedAirlines.page}
            totalPages={pagedAirlines.totalPages}
            total={pagedAirlines.total}
            onPageChange={setPage}
          />
        </>
      )}

      {/* LIST: DESTINATIONS */}
      {!dataQuery.isPending && tab === 'destinations' && (
        <>
          {pagedDestinations.items.length === 0 && (
            <View style={adminStyles.card}>
              <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
            </View>
          )}
          {pagedDestinations.items.map((dest) => {
            const ap = airportById.get(dest.airport_id);
            return (
              <View key={dest.id} style={adminStyles.itemCard}>
                <View style={adminStyles.rowBetween}>
                  <Text style={adminStyles.bold}>
                    {dest.title} ({ap?.iata_code ?? '?'}) {dest.is_featured ? '★' : ''}
                  </Text>
                  <AdminStatusBadge active={dest.is_active} />
                </View>
                <Text style={adminStyles.muted}>
                  Slug: {dest.slug} · {bi('Thứ tự', 'Order')}: {dest.sort_order}
                  {dest.image_path ? ` · Ảnh: ${dest.image_path}` : ''}
                </Text>
                {!!dest.description && <Text style={adminStyles.muted}>{dest.description}</Text>}
                <View style={adminStyles.rowGap}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openDestEditor(dest)}
                    style={adminStyles.secondaryBtnSmall}
                  >
                    <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.edit')}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void toggleDestActive(dest)}
                    style={dest.is_active ? adminStyles.dangerBtnSmall : adminStyles.primaryBtnSmall}
                  >
                    <Text style={dest.is_active ? adminStyles.dangerBtnText : adminStyles.primaryBtnText}>
                      {dest.is_active ? ta('admin.action.deactivate') : ta('admin.action.activate')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          <AdminPaginationBar
            page={pagedDestinations.page}
            totalPages={pagedDestinations.totalPages}
            total={pagedDestinations.total}
            onPageChange={setPage}
          />
        </>
      )}
    </AdminShell>
  );
}

