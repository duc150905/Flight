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
  saveAdminAddonProduct,
  saveAdminFlightAddonOffer,
  type AddonProductRow,
  type FlightAddonOfferRow,
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

import { CataloguePicker } from '../catalogue-picker';
import { loadAddonsBundle } from '../catalogue-data';

type AddonTab = 'products' | 'offers';
type AddonCategory = 'baggage' | 'meal' | 'insurance_demo';


export function AdminAddonsScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  return <AdminAddonsContent key={initialQuery} initialQuery={initialQuery} />;
}

function AdminAddonsContent({ initialQuery }: { initialQuery: string }) {
  const { language, ta, bi, money } = useAdminI18n();
  const queryClient = useQueryClient();

  const addonsQuery = useQuery({
    queryKey: ['admin-addons-bundle'],
    queryFn: () => {
      if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
      return loadAddonsBundle(supabase);
    },
  });

  const products = addonsQuery.data?.products ?? [];
  const offers = addonsQuery.data?.offers ?? [];
  const flights = addonsQuery.data?.flights ?? [];

  const [tab, setTab] = useState<AddonTab>('products');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState({
    id: null as string | null,
    code: '',
    name: '',
    category: 'baggage' as AddonCategory,
    description: '',
    weightKg: '20',
    isActive: true,
  });

  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerForm, setOfferForm] = useState({
    id: null as string | null,
    flightId: '',
    productId: '',
    unitAmount: '280000',
    maxQuantityPerPassenger: '1',
    isActive: true,
  });

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-addons-bundle'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-f09-summary'] });
    await queryClient.invalidateQueries({ queryKey: ['checkout-baggage'] });
  };

  const switchTab = (next: AddonTab) => {
    setTab(next);
    setQuery('');
    setStatusFilter('all');
    setPage(1);
    setShowProductForm(false);
    setShowOfferForm(false);
    setError(null);
    setInfo(null);
  };

  const openCreateProduct = () => {
    setProductForm({
      id: null,
      code: '',
      name: '',
      category: 'baggage',
      description: '',
      weightKg: '20',
      isActive: true,
    });
    setShowProductForm(true);
    setError(null);
    setInfo(null);
  };

  const openEditProduct = (item: AddonProductRow) => {
    setProductForm({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      description: item.description ?? '',
      weightKg: item.weight_kg != null ? String(item.weight_kg) : '',
      isActive: item.is_active,
    });
    setShowProductForm(true);
    setError(null);
    setInfo(null);
  };

  const handleSaveProduct = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await saveAdminAddonProduct(supabase, {
        id: productForm.id,
        code: productForm.code,
        name: productForm.name,
        category: productForm.category,
        description: productForm.description,
        weightKg:
          productForm.category === 'baggage' && productForm.weightKg.trim()
            ? Number(productForm.weightKg)
            : null,
        isActive: productForm.isActive,
      });
      setShowProductForm(false);
      setInfo(ta('admin.saved'));
      await refreshAll();
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleProductActive = async (item: AddonProductRow) => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await saveAdminAddonProduct(supabase, {
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        description: item.description ?? '',
        weightKg: item.weight_kg,
        isActive: !item.is_active,
      });
      setInfo(ta('admin.saved'));
      await refreshAll();
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const openCreateOffer = () => {
    setOfferForm({
      id: null,
      flightId: flights[0]?.id ?? '',
      productId: products.find(p => p.category === 'baggage')?.id ?? '',
      unitAmount: '280000',
      maxQuantityPerPassenger: '1',
      isActive: true,
    });
    setShowOfferForm(true);
    setError(null);
    setInfo(null);
  };

  const openEditOffer = (item: FlightAddonOfferRow) => {
    setOfferForm({
      id: item.id,
      flightId: item.flight_id,
      productId: item.product_id,
      unitAmount: String(item.unit_amount),
      maxQuantityPerPassenger: '1',
      isActive: item.is_active,
    });
    setShowOfferForm(true);
    setError(null);
    setInfo(null);
  };

  const handleSaveOffer = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await saveAdminFlightAddonOffer(supabase, {
        id: offerForm.id,
        flightId: offerForm.flightId,
        productId: offerForm.productId,
        unitAmount: Number(offerForm.unitAmount || 0),
        maxQuantityPerPassenger: 1,
        isActive: offerForm.isActive,
      });
      setShowOfferForm(false);
      setInfo(ta('admin.saved'));
      await refreshAll();
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleOfferActive = async (item: FlightAddonOfferRow) => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await saveAdminFlightAddonOffer(supabase, {
        id: item.id,
        flightId: item.flight_id,
        productId: item.product_id,
        unitAmount: item.unit_amount,
        maxQuantityPerPassenger: 1,
        isActive: !item.is_active,
      });
      setInfo(ta('admin.saved'));
      await refreshAll();
    } catch (err) {
      setError(formatAdminError(err, language));
    } finally {
      setBusy(false);
    }
  };

  const pagedProducts = filterAndPaginate(products, {
    query,
    statusFilter,
    page,
    pageSize: 8,
    getSearchText: (item) =>
      `${item.code} ${item.name} ${item.category} ${item.description ?? ''}`,
    getIsActive: (item) => item.is_active,
  });

  const pagedOffers = filterAndPaginate(offers, {
    query,
    statusFilter,
    page,
    pageSize: 8,
    getSearchText: (item) => {
      const fl = flights.find((f) => f.id === item.flight_id);
      const pr = products.find((p) => p.id === item.product_id);
      return `${fl?.flight_number ?? ''} ${pr?.code ?? ''} ${pr?.name ?? ''} ${pr?.category ?? ''}`;
    },
    getIsActive: (item) => item.is_active,
  });


  return (
    <AdminShell
      activeSection="addons"
      title={bi('Quản lý Hành lý, Suất ăn & Dịch vụ bổ sung', 'Baggage, Meals & Add-on Services')}
      subtitle={bi(
        'Khách hàng chỉ mua được một gói hành lý / hành khách / chặng. Suất ăn và bảo hiểm chỉ đọc, chưa được bán.',
        'Checkout supports one baggage choice per traveller per leg. Meals and insurance are read-only and unavailable for sale.',
      )}
      onQuickSearch={(txt) => {
        setQuery(txt);
        setPage(1);
      }}
    >
      <View style={adminStyles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'products' }}
          onPress={() => switchTab('products')}
          style={[adminStyles.chip, tab === 'products' && adminStyles.chipSelected]}
        >
          <Text style={[adminStyles.chipText, tab === 'products' && adminStyles.chipTextSelected]}>
            {bi(`Sản phẩm dịch vụ (${products.length})`, `Add-on Products (${products.length})`)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'offers' }}
          onPress={() => switchTab('offers')}
          style={[adminStyles.chip, tab === 'offers' && adminStyles.chipSelected]}
        >
          <Text style={[adminStyles.chipText, tab === 'offers' && adminStyles.chipTextSelected]}>
            {bi(`Gói bán theo chuyến (${offers.length})`, `Flight Add-on Offers (${offers.length})`)}
          </Text>
        </Pressable>
      </View>

      <AdminToast text={info} success onClose={() => setInfo(null)} />
      <AdminToast text={error} error onClose={() => setError(null)} />

      {addonsQuery.isError && !error && (
        <View style={adminStyles.card}>
          <Notice text={formatAdminError(addonsQuery.error, language)} />
          <Pressable
            accessibilityRole="button"
            onPress={() => void addonsQuery.refetch()}
            style={adminStyles.secondaryBtnSmall}
          >
            <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.retry')}</Text>
          </Pressable>
        </View>
      )}

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
        onRefresh={() => void addonsQuery.refetch()}
        onCreate={tab === 'products' ? openCreateProduct : openCreateOffer}
      />

      {tab === 'products' && showProductForm && (
        <View style={adminStyles.card}>
          <Text style={adminStyles.sectionTitle}>
            {productForm.id
              ? bi('Chỉnh sửa sản phẩm dịch vụ', 'Edit Add-on Product')
              : bi('Thêm sản phẩm dịch vụ mới', 'Create Add-on Product')}
          </Text>

          <AdminTextField
            label={bi('Mã dịch vụ (ví dụ: BAG_20KG, MEAL_HOT)', 'Product Code (e.g., BAG_20KG)')}
            value={productForm.code}
            onChangeText={(text) => setProductForm((s) => ({ ...s, code: text }))}
            placeholder="BAG_20KG"
            autoCapitalize="characters"
          />

          <AdminTextField
            label={bi('Tên hiển thị', 'Display Name')}
            value={productForm.name}
            onChangeText={(text) => setProductForm((s) => ({ ...s, name: text }))}
            placeholder="Hành lý ký gửi 20kg"
            autoCapitalize="sentences"
          />

          <Text style={adminStyles.muted}>{bi('Nhóm dịch vụ: Hành lý', 'Service category: Baggage')}</Text>

          {productForm.category === 'baggage' && (
            <AdminTextField
              label={bi('Khối lượng hành lý (kg > 0)', 'Baggage Weight (kg > 0)')}
              value={productForm.weightKg}
              onChangeText={(text) => setProductForm((s) => ({ ...s, weightKg: text }))}
              keyboardType="numeric"
              placeholder="20"
            />
          )}

          <AdminTextField
            label={bi('Mô tả chi tiết', 'Description')}
            value={productForm.description}
            onChangeText={(text) => setProductForm((s) => ({ ...s, description: text }))}
            placeholder="Thêm 1 kiện hành lý ký gửi tiêu chuẩn."
            autoCapitalize="sentences"
          />

          <View style={adminStyles.chipRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setProductForm((s) => ({ ...s, isActive: !s.isActive }))}
              style={[adminStyles.chip, productForm.isActive && adminStyles.chipSelected]}
            >
              <Text
                style={[
                  adminStyles.chipText,
                  productForm.isActive && adminStyles.chipTextSelected,
                ]}
              >
                {productForm.isActive ? ta('admin.status.active') : ta('admin.status.inactive')}
              </Text>
            </Pressable>
          </View>

          <View style={adminStyles.rowGap}>
            <ActionButton
              title={ta('admin.action.save')}
              disabled={busy}
              onPress={() => void handleSaveProduct()}
            />
            <ActionButton
              title={ta('admin.action.cancel')}
              secondary
              disabled={busy}
              onPress={() => setShowProductForm(false)}
            />
          </View>
        </View>
      )}

      {tab === 'offers' && showOfferForm && (
        <View style={adminStyles.card}>
          <Text style={adminStyles.sectionTitle}>
            {offerForm.id
              ? bi('Cập nhật gói dịch vụ trên chuyến bay', 'Edit Flight Add-on Offer')
              : bi('Gán gói dịch vụ vào chuyến bay', 'Create Flight Add-on Offer')}
          </Text>

          <CataloguePicker items={flights} value={offerForm.flightId} label={bi('Chọn chuyến bay', 'Select Flight')}
            getLabel={fl => `${fl.flight_number} · ${fl.departure_at}`} onSelect={fl => setOfferForm(s => ({ ...s, flightId: fl.id }))} />
          <CataloguePicker items={products.filter(p => p.category === 'baggage')} value={offerForm.productId} label={bi('Chọn gói hành lý', 'Select Baggage Product')}
            getLabel={pr => `${pr.code} · ${pr.name}`} onSelect={pr => setOfferForm(s => ({ ...s, productId: pr.id }))} />

          <View style={adminStyles.rowGap}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <AdminTextField
                label={bi('Đơn giá trên chuyến (VND)', 'Unit Price on Flight (VND)')}
                value={offerForm.unitAmount}
                onChangeText={(text) => setOfferForm((s) => ({ ...s, unitAmount: text }))}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, minWidth: 160 }}>
              <AdminTextField
                label={bi('Một gói / hành khách / chặng', 'One choice / traveller / leg')}
                editable={false}
                value={offerForm.maxQuantityPerPassenger}
                onChangeText={(text) =>
                  setOfferForm((s) => ({ ...s, maxQuantityPerPassenger: text }))
                }
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={adminStyles.chipRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOfferForm((s) => ({ ...s, isActive: !s.isActive }))}
              style={[adminStyles.chip, offerForm.isActive && adminStyles.chipSelected]}
            >
              <Text
                style={[adminStyles.chipText, offerForm.isActive && adminStyles.chipTextSelected]}
              >
                {offerForm.isActive ? ta('admin.status.active') : ta('admin.status.inactive')}
              </Text>
            </Pressable>
          </View>

          <View style={adminStyles.rowGap}>
            <ActionButton
              title={ta('admin.action.save')}
              disabled={busy}
              onPress={() => void handleSaveOffer()}
            />
            <ActionButton
              title={ta('admin.action.cancel')}
              secondary
              disabled={busy}
              onPress={() => setShowOfferForm(false)}
            />
          </View>
        </View>
      )}

      {addonsQuery.isPending ? (
        <AdminLoadingState />
      ) : tab === 'products' ? (
        pagedProducts.items.length === 0 ? (
          <View style={adminStyles.card}>
            <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
          </View>
        ) : (
          <>
            {pagedProducts.items.map((item) => (
              <View key={item.id} style={adminStyles.itemCard}>
                <View style={adminStyles.rowBetween}>
                  <Text style={adminStyles.bold}>
                    {item.code} · {item.name}
                  </Text>
                  <AdminStatusBadge active={item.is_active} />
                </View>
                <Text style={adminStyles.muted}>
                  {bi('Phân loại:', 'Category:')} {item.category}
                  {item.weight_kg != null ? ` · ${item.weight_kg} kg` : ''}
                </Text>
                {item.category !== 'baggage' && <Notice text={bi('Chỉ đọc · Chưa hỗ trợ bán trong checkout.', 'Read-only · Unavailable in checkout.')} />}
                {!!item.description && <Text style={adminStyles.muted}>{item.description}</Text>}
                <View style={adminStyles.rowGap}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={item.category !== 'baggage'}
                    onPress={() => openEditProduct(item)}
                    style={adminStyles.secondaryBtnSmall}
                  >
                    <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.edit')}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || item.category !== 'baggage'}
                    onPress={() => void handleToggleProductActive(item)}
                    style={
                      item.is_active ? adminStyles.dangerBtnSmall : adminStyles.primaryBtnSmall
                    }
                  >
                    <Text
                      style={
                        item.is_active ? adminStyles.dangerBtnText : adminStyles.primaryBtnText
                      }
                    >
                      {item.is_active ? ta('admin.action.deactivate') : ta('admin.action.activate')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <AdminPaginationBar
              page={pagedProducts.page}
              totalPages={pagedProducts.totalPages}
              total={pagedProducts.total}
              onPageChange={setPage}
            />
          </>
        )
      ) : pagedOffers.items.length === 0 ? (
        <View style={adminStyles.card}>
          <Text style={adminStyles.muted}>{ta('admin.empty')}</Text>
        </View>
      ) : (
        <>
          {pagedOffers.items.map((offer) => {
            const fl = flights.find((f) => f.id === offer.flight_id);
            const pr = products.find((p) => p.id === offer.product_id);
            return (
              <View key={offer.id} style={adminStyles.itemCard}>
                <View style={adminStyles.rowBetween}>
                  <Text style={adminStyles.bold}>
                    {fl?.flight_number ?? offer.flight_id.slice(0, 8)} ·{' '}
                    {pr ? `${pr.code} (${pr.name})` : offer.product_id.slice(0, 8)}
                  </Text>
                  <AdminStatusBadge active={offer.is_active} />
                </View>
                <Text style={adminStyles.muted}>
                  {bi('Đơn giá:', 'Price:')} {money(offer.unit_amount, offer.currency)} ·{' '}
                  {bi('Tối đa / khách:', 'Max / passenger:')} {offer.max_quantity_per_passenger}
                </Text>
                {pr?.category !== 'baggage' && <Notice text={bi('Chỉ đọc · Chưa hỗ trợ bán trong checkout.', 'Read-only · Unavailable in checkout.')} />}
                {pr?.category === 'baggage' && offer.max_quantity_per_passenger !== 1 && <Text style={adminStyles.muted}>{bi('Checkout chỉ cho chọn một gói. Lưu thay đổi sẽ đặt giới hạn về 1.', 'Checkout allows one choice. Saving changes sets this limit to 1.')}</Text>}
                <View style={adminStyles.rowGap}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={pr?.category !== 'baggage'}
                    onPress={() => openEditOffer(offer)}
                    style={adminStyles.secondaryBtnSmall}
                  >
                    <Text style={adminStyles.secondaryBtnText}>{ta('admin.action.edit')}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || pr?.category !== 'baggage'}
                    onPress={() => void handleToggleOfferActive(offer)}
                    style={
                      offer.is_active ? adminStyles.dangerBtnSmall : adminStyles.primaryBtnSmall
                    }
                  >
                    <Text
                      style={
                        offer.is_active ? adminStyles.dangerBtnText : adminStyles.primaryBtnText
                      }
                    >
                      {offer.is_active ? ta('admin.action.deactivate') : ta('admin.action.activate')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          <AdminPaginationBar
            page={pagedOffers.page}
            totalPages={pagedOffers.totalPages}
            total={pagedOffers.total}
            onPageChange={setPage}
          />
        </>
      )}
    </AdminShell>
  );
}
