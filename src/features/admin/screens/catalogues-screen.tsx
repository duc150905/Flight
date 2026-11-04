import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import {
  CountryOption,
  POPULAR_COUNTRIES,
  POPULAR_TIMEZONES,
  TimezoneOption,
  findCountry,
  findTimezone,
  getRecommendedTimezonesForCountry,
  searchCountries,
  searchTimezones,
} from '../geo-data';
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
  AdminToast,
  adminStyles,
} from '../ui';

type CatalogueTab = 'airports' | 'airlines' | 'destinations';

async function loadCatalogues() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const [airports, airlines, destinations] = await Promise.all([
    supabase.from('airports').select('*').order('city').order('iata_code'),
    supabase.from('airlines').select('*').order('iata_code'),
    supabase.from('destinations').select('*').order('sort_order').order('slug'),
  ]);
  if (airports.error) throw airports.error;
  if (airlines.error) throw airlines.error;
  if (destinations.error) throw destinations.error;
  return {
    airports: airports.data ?? [],
    airlines: airlines.data ?? [],
    destinations: destinations.data ?? [],
  };
}

export function AdminCataloguesScreen() {
  const { ta, bi, language } = useAdminI18n();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<CatalogueTab>('airports');
  const [query, setQuery] = useState('');
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
  const [countrySearch, setCountrySearch] = useState('');
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [showAllTimezones, setShowAllTimezones] = useState(false);

  const selectedCountry = useMemo(() => findCountry(apCountry), [apCountry]);
  const selectedTimezone = useMemo(() => findTimezone(apTimezone), [apTimezone]);
  const recommendedTimezones = useMemo(
    () => getRecommendedTimezonesForCountry(apCountry),
    [apCountry],
  );
  const filteredCountries = useMemo(() => searchCountries(countrySearch), [countrySearch]);
  const filteredTimezones = useMemo(() => searchTimezones(timezoneSearch), [timezoneSearch]);

  const handleSelectCountry = (c: CountryOption) => {
    setApCountry(c.code);
    if (
      !apTimezone ||
      apTimezone === 'Asia/Ho_Chi_Minh' ||
      (selectedCountry && apTimezone === selectedCountry.defaultTimezone)
    ) {
      setApTimezone(c.defaultTimezone);
    }
  };

  const handleSelectTimezone = (t: TimezoneOption) => {
    setApTimezone(t.tz);
  };

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
    queryFn: loadCatalogues,
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
    setCountrySearch('');
    setShowAllCountries(false);
    setTimezoneSearch('');
    setShowAllTimezones(false);
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

      <AdminToast text={success} success onClose={() => setSuccess('')} />
      <AdminToast text={error} error onClose={() => setError('')} />

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
          {/* MÃ QUỐC GIA ISO-2 */}
          <View style={adminStyles.fieldGroup}>
            <View style={adminStyles.rowBetween}>
              <Text style={adminStyles.label}>{bi('Mã quốc gia ISO-2', 'ISO-2 Country Code')}</Text>
              {selectedCountry ? (
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F766E' }}>
                  {selectedCountry.flag} {bi(selectedCountry.nameVi, selectedCountry.nameEn)} ({selectedCountry.code})
                </Text>
              ) : apCountry.trim().length === 2 ? (
                <Text style={{ fontSize: 12, color: '#64748B' }}>
                  {bi('Mã:', 'Code:')} {apCountry.toUpperCase()}
                </Text>
              ) : null}
            </View>
            <TextInput
              value={apCountry}
              onChangeText={(val) => setApCountry(val.toUpperCase())}
              placeholder="VN"
              autoCapitalize="characters"
              maxLength={2}
              style={adminStyles.input}
            />
            <View style={{ gap: 6, marginTop: 2 }}>
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>
                💡 {bi('Chọn nhanh quốc gia (Bấm để chọn & gợi ý múi giờ):', 'Quick select country (Tap to apply & suggest timezone):')}
              </Text>
              <View style={adminStyles.chipRow}>
                {POPULAR_COUNTRIES.slice(0, 8).map((c) => {
                  const isSelected = apCountry.toUpperCase() === c.code;
                  return (
                    <Pressable
                      key={c.code}
                      accessibilityRole="button"
                      onPress={() => handleSelectCountry(c)}
                      style={[adminStyles.chip, isSelected && adminStyles.chipSelected]}
                    >
                      <Text style={[adminStyles.chipText, isSelected && adminStyles.chipTextSelected]}>
                        {c.flag} {c.code} · {bi(c.nameVi, c.nameEn)}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllCountries((v) => !v)}
                  style={[adminStyles.chip, showAllCountries && adminStyles.chipSelected]}
                >
                  <Text style={[adminStyles.chipText, showAllCountries && adminStyles.chipTextSelected]}>
                    {showAllCountries
                      ? bi('▲ Thu gọn danh sách', '▲ Collapse list')
                      : bi('🌐 Chọn quốc gia khác...', '🌐 More countries...')}
                  </Text>
                </Pressable>
              </View>

              {showAllCountries && (
                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderColor: '#CBD5E1',
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 10,
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <TextInput
                    value={countrySearch}
                    onChangeText={setCountrySearch}
                    placeholder={bi(
                      '🔍 Tìm theo tên hoặc mã (VD: Nhật Bản, Japan, JP, Mỹ, Pháp, Úc)...',
                      '🔍 Search by name or code (e.g. Japan, JP, US, France)...',
                    )}
                    style={[adminStyles.input, { backgroundColor: '#FFFFFF' }]}
                  />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxHeight: 180 }}>
                    {filteredCountries.map((c) => {
                      const isSelected = apCountry.toUpperCase() === c.code;
                      return (
                        <Pressable
                          key={c.code}
                          accessibilityRole="button"
                          onPress={() => {
                            handleSelectCountry(c);
                            setShowAllCountries(false);
                          }}
                          style={[adminStyles.chip, isSelected && adminStyles.chipSelected]}
                        >
                          <Text style={[adminStyles.chipText, isSelected && adminStyles.chipTextSelected]}>
                            {c.flag} {c.code} · {bi(c.nameVi, c.nameEn)}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {filteredCountries.length === 0 && (
                      <Text style={{ fontSize: 13, color: '#94A3B8', padding: 8 }}>
                        {bi('Không tìm thấy quốc gia phù hợp.', 'No matching country found.')}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* MÚI GIỜ IANA */}
          <View style={adminStyles.fieldGroup}>
            <View style={adminStyles.rowBetween}>
              <Text style={adminStyles.label}>{bi('Múi giờ IANA', 'IANA Timezone')}</Text>
              {selectedTimezone ? (
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F766E' }}>
                  🕒 {selectedTimezone.offset} · {bi(selectedTimezone.labelVi, selectedTimezone.labelEn)}
                </Text>
              ) : null}
            </View>
            <TextInput
              value={apTimezone}
              onChangeText={setApTimezone}
              placeholder="Asia/Ho_Chi_Minh"
              autoCapitalize="none"
              style={adminStyles.input}
            />

            {/* Gợi ý múi giờ theo quốc gia đã chọn */}
            {recommendedTimezones.length > 0 && (
              <View style={{ gap: 4, marginTop: 2 }}>
                <Text style={{ fontSize: 12, color: '#0F766E', fontWeight: '700' }}>
                  ⚡{' '}
                  {bi(
                    `Gợi ý múi giờ cho ${selectedCountry?.flag ?? ''} ${
                      selectedCountry ? bi(selectedCountry.nameVi, selectedCountry.nameEn) : apCountry
                    }:`,
                    `Suggested timezone for ${apCountry}:`,
                  )}
                </Text>
                <View style={adminStyles.chipRow}>
                  {recommendedTimezones.map((tzOpt) => {
                    const isSelected = apTimezone === tzOpt.tz;
                    return (
                      <Pressable
                        key={tzOpt.tz}
                        accessibilityRole="button"
                        onPress={() => handleSelectTimezone(tzOpt)}
                        style={[
                          adminStyles.chip,
                          isSelected && adminStyles.chipSelected,
                          { borderColor: '#0D9488' },
                        ]}
                      >
                        <Text style={[adminStyles.chipText, isSelected && adminStyles.chipTextSelected]}>
                          ⭐ {tzOpt.tz} ({tzOpt.offset} · {bi(tzOpt.labelVi, tzOpt.labelEn)})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Các múi giờ phổ biến khác */}
            <View style={{ gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>
                💡 {bi('Các múi giờ phổ biến khác (Bấm để chọn):', 'Other popular timezones (Tap to apply):')}
              </Text>
              <View style={adminStyles.chipRow}>
                {POPULAR_TIMEZONES.slice(0, 8).map((tzOpt) => {
                  const isSelected = apTimezone === tzOpt.tz;
                  return (
                    <Pressable
                      key={tzOpt.tz}
                      accessibilityRole="button"
                      onPress={() => handleSelectTimezone(tzOpt)}
                      style={[adminStyles.chip, isSelected && adminStyles.chipSelected]}
                    >
                      <Text style={[adminStyles.chipText, isSelected && adminStyles.chipTextSelected]}>
                        {tzOpt.tz} ({tzOpt.offset})
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllTimezones((v) => !v)}
                  style={[adminStyles.chip, showAllTimezones && adminStyles.chipSelected]}
                >
                  <Text style={[adminStyles.chipText, showAllTimezones && adminStyles.chipTextSelected]}>
                    {showAllTimezones
                      ? bi('▲ Thu gọn danh sách', '▲ Collapse list')
                      : bi('🕒 Chọn múi giờ khác...', '🕒 More timezones...')}
                  </Text>
                </Pressable>
              </View>

              {showAllTimezones && (
                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderColor: '#CBD5E1',
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 10,
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <TextInput
                    value={timezoneSearch}
                    onChangeText={setTimezoneSearch}
                    placeholder={bi(
                      '🔍 Tìm múi giờ (VD: Tokyo, Bangkok, Paris, New York, GMT+8)...',
                      '🔍 Search timezone (e.g. Tokyo, Bangkok, Paris, GMT+8)...',
                    )}
                    style={[adminStyles.input, { backgroundColor: '#FFFFFF' }]}
                  />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxHeight: 180 }}>
                    {filteredTimezones.map((tzOpt) => {
                      const isSelected = apTimezone === tzOpt.tz;
                      return (
                        <Pressable
                          key={tzOpt.tz}
                          accessibilityRole="button"
                          onPress={() => {
                            handleSelectTimezone(tzOpt);
                            setShowAllTimezones(false);
                          }}
                          style={[adminStyles.chip, isSelected && adminStyles.chipSelected]}
                        >
                          <Text style={[adminStyles.chipText, isSelected && adminStyles.chipTextSelected]}>
                            {tzOpt.tz} ({tzOpt.offset} · {bi(tzOpt.labelVi, tzOpt.labelEn)})
                          </Text>
                        </Pressable>
                      );
                    })}
                    {filteredTimezones.length === 0 && (
                      <Text style={{ fontSize: 13, color: '#94A3B8', padding: 8 }}>
                        {bi('Không tìm thấy múi giờ phù hợp.', 'No matching timezone found.')}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
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
            label={bi('Đường dẫn logo (tùy chọn)', 'Logo path (optional)')}
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
          <Text style={adminStyles.label}>{bi('Chọn sân bay', 'Select airport')}</Text>
          <View style={adminStyles.chipRow}>
            {airports.map((ap) => {
              const selected = destAirportId === ap.id;
              return (
                <Pressable
                  key={ap.id}
                  accessibilityRole="button"
                  onPress={() => setDestAirportId(ap.id)}
                  style={[adminStyles.chip, selected && adminStyles.chipSelected]}
                >
                  <Text style={[adminStyles.chipText, selected && adminStyles.chipTextSelected]}>
                    {ap.city} ({ap.iata_code})
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
              {!!al.logo_path && <Text style={adminStyles.muted}>Logo: {al.logo_path}</Text>}
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

