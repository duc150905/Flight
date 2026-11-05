import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { MoneyText } from '../currency/ui';
import { useLanguage } from '../i18n/provider';
import { isBaggageCurrent } from './baggage';
import { useCheckout, useCheckoutStore } from './checkout-provider';
import { loadBaggage } from './extras-data';
import { Option, Tabs } from './options-ui';
import { checkoutReview } from './review';
import { createStepRequestGuard } from './step-request';
import { CheckoutButton, CheckoutCard, CheckoutError, CheckoutShell, CheckoutText, MissingCheckout } from './ui';

export function BaggageScreen() {
  const draft = useCheckout(); const store = useCheckoutStore(); const { t } = useLanguage();
  const [flight, setFlight] = useState(''); const [person, setPerson] = useState(''); const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<'baggage' | 'meals'>('baggage');
  const [guard] = useState(createStepRequestGuard);
  useFocusEffect(useCallback(() => guard.cancel, [guard]));
  const itinerary = draft.itinerary;
  const query = useQuery({ queryKey: ['checkout-baggage', itinerary?.selection], enabled: !!itinerary,
    queryFn: () => { if (!supabase || !itinerary) throw new Error('extras.loadError'); return loadBaggage(supabase, itinerary); }, staleTime: 0 });
  if (!itinerary) return <MissingCheckout />;
  if (!checkoutReview(draft).success) return <CheckoutShell title="Add-on Services" step={2}>
    <CheckoutError message="extras.checkDetails" /><CheckoutButton title="Edit travellers" onPress={() => router.dismissTo('/checkout/passengers')} />
  </CheckoutShell>;
  const leg = itinerary.legs.find(l => l.flightId === flight) ?? itinerary.legs[0];
  const passenger = draft.passengers.find(p => p.id === person) ?? draft.passengers[0];
  const current = draft.baggage.find(b => b.flightId === leg.flightId && b.passengerId === passenger.id);
  const stale = draft.baggage.some(b => !query.data || !isBaggageCurrent(b, query.data.offers));
  const allowance = query.data?.allowances[leg.flightId];
  async function next() {
    setError(''); const revision = store.getState().revision; const token = guard.begin();
    const fresh = await query.refetch();
    if (!guard.isCurrent(token)) return;
    if (fresh.error || !fresh.data) { setError('extras.loadError'); return; }
    if (revision !== store.getState().revision || store.getState().baggage.some(b => !isBaggageCurrent(b, fresh.data.offers))) {
      setError('extras.changed'); return;
    }
    router.push('/checkout/seats');
  }
  return <CheckoutShell title="Add-on Services" step={2} back={() => router.back()}
    footer={{ title: query.isFetching ? 'Loading' : 'Next', disabled: query.isFetching || !query.data || stale, onPress: () => { void next(); } }}>
    <Tabs label="Your flights" selected={leg.flightId} onSelect={setFlight} values={itinerary.legs.map(l => ({ id: l.flightId, text: `${l.origin.iata_code} → ${l.destination.iata_code}` }))} />
    <Tabs label="Travellers" selected={passenger.id} onSelect={setPerson} values={draft.passengers.map((p, i) => ({ id: p.id, text: `${i + 1}. ${p.values.givenNames} ${p.values.familyName}` }))} />

    {/* Traveloka-style Add-on Category Tabs */}
    <View style={screenStyles.categoryTabRow}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: activeCategory === 'baggage' }}
        onPress={() => setActiveCategory('baggage')}
        style={[screenStyles.categoryTab, activeCategory === 'baggage' && screenStyles.categoryTabActive]}
      >
        <Text style={{ fontSize: 16 }}>🧳</Text>
        <Text style={[screenStyles.categoryTabText, activeCategory === 'baggage' && screenStyles.categoryTabTextActive]}>
          {t('Baggage')}
        </Text>
        {Boolean(current) && (
          <View style={screenStyles.categoryBadge}>
            <Text style={screenStyles.categoryBadgeText}>+{current?.weightKg}kg</Text>
          </View>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: activeCategory === 'meals' }}
        onPress={() => setActiveCategory('meals')}
        style={[screenStyles.categoryTab, activeCategory === 'meals' && screenStyles.categoryTabActive]}
      >
        <Text style={{ fontSize: 16 }}>🍱</Text>
        <Text style={[screenStyles.categoryTabText, activeCategory === 'meals' && screenStyles.categoryTabTextActive]}>
          {t('In-flight Meals')}
        </Text>

      </Pressable>
    </View>

    {query.isFetching && <ActivityIndicator accessibilityLabel={t('Loading')} />}
    {Boolean(query.isError || error) && <><CheckoutError message={error || 'extras.loadError'} /><CheckoutButton title="Retry" secondary onPress={() => { void query.refetch(); }} /></>}
    {stale && query.data && <CheckoutError message="extras.changed" />}

    {activeCategory === 'baggage' ? (
      <>
        <CheckoutCard><CheckoutText title message="Cabin bags" />
          <CheckoutText>{allowance ? t('bags.allowance', { pieces: allowance.cabinPieces, kg: allowance.cabinKg }) : t('bags.allowanceUnavailable')}</CheckoutText>
          <CheckoutText muted message="Included in your fare" />
        </CheckoutCard>
        <CheckoutCard><CheckoutText title message="Checked bags" />
          <CheckoutText>{allowance ? t('bags.allowance', { pieces: allowance.checkedPieces, kg: allowance.checkedKg }) : t('bags.allowanceUnavailable')}</CheckoutText>
          <CheckoutText muted message="Included in your fare" />
          <Option title={t('No extra checked bag')} selected={!current} onPress={() => draft.setBaggage(passenger.id, leg.flightId, null)} />
          {query.data?.offers.filter(o => o.flightId === leg.flightId).map(o => <Option key={o.id} title={t('bags.package', { kg: o.weightKg })}
            selected={current?.offerId === o.id && isBaggageCurrent(current, [o])} onPress={() => { setError(''); draft.setBaggage(passenger.id, leg.flightId, o); }}>
            <MoneyText amount={o.amount} /></Option>)}
          {query.data && !query.data.offers.some(o => o.flightId === leg.flightId) && <CheckoutText muted message="No extra baggage available for this flight." />}
        </CheckoutCard>
        <CheckoutText muted message="Baggage is selected separately for each traveller and flight." />
      </>
    ) : (
      <>
        <CheckoutCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 24 }}>🍱</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                {t('Flight catering menu')}
              </Text>
              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                {t('Meal pre-ordering is not available yet.')}
              </Text>
            </View>
          </View>
        </CheckoutCard>

        <CheckoutCard>
          <CheckoutText title message="Menu for reference only" />
          <CheckoutText muted message="Meals cannot be added to your booking yet." />
          {query.data?.meals?.filter(m => m.flightId === leg.flightId).map(m => (
            <View key={m.id} style={screenStyles.mealCard}>
              <Text style={screenStyles.mealTitle}>{t(m.name)}</Text>
              {!!m.description && <Text style={screenStyles.mealDescription}>{m.description}</Text>}
              <CheckoutText muted message="Reference price" />
              <MoneyText amount={m.amount} />
            </View>
          ))}
          {query.data && !query.data.meals?.some(m => m.flightId === leg.flightId) && (
            <CheckoutText muted message="No meal menu is available for this flight." />
          )}
        </CheckoutCard>
      </>
    )}

    {/* Summary chip indicator */}
    <View style={screenStyles.summaryBar}>
      <Text style={screenStyles.summaryTitle}>
        {passenger.values.givenNames ? `${passenger.values.givenNames} (${leg.origin.iata_code} → ${leg.destination.iata_code})` : t('Lựa chọn hiện tại')}
      </Text>
      <View style={screenStyles.summaryChips}>
        <View style={screenStyles.summaryChip}>
          <Text style={screenStyles.summaryChipText}>
            🧳 {current ? `+${current.weightKg}kg` : t('Hành lý tiêu chuẩn')}
          </Text>
        </View>

      </View>
    </View>
  </CheckoutShell>;
}

const screenStyles = StyleSheet.create({
  categoryTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    backgroundColor: '#F1F5F9',
    padding: 4,
    borderRadius: 14,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  categoryTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryTabTextActive: {
    color: '#0F766E',
    fontWeight: '700',
  },
  categoryBadge: {
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  mealCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  mealCardSelected: {
    borderColor: '#0F766E',
    backgroundColor: '#F0FDFA',
  },
  mealTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  mealTitleSelected: {
    color: '#0F766E',
  },
  mealDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#0F766E',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0F766E',
  },
  complimentaryBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  complimentaryBadgeText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '600',
  },
  summaryBar: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  summaryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
});
