import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, colors } from '@/features/auth/ui';
import { useLanguage } from '@/features/i18n/provider';
import type { FlightTimingInfo } from './presentation';

export const ticketStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 24, gap: 16 },
  back: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, padding: 18, gap: 12 },
  cardTitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  body: { color: colors.text, fontSize: 16, lineHeight: 24 },
  strong: { color: colors.text, fontSize: 17, fontWeight: '700' },
  status: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E4F8FB',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  column: { flex: 1, gap: 4 },
  divider: { height: 1, backgroundColor: colors.border },
  state: { flex: 1, justifyContent: 'center' },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#E6EFF2',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#536570',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: '#D1E0E5',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#41525C',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },

  // Flight Route header on cards
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  routeText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  flightSub: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },

  // Timing Badge
  timingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  timingBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Timeline Progress Bar
  timelineCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  stepContainer: {
    alignItems: 'center',
    zIndex: 2,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepCircleActive: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.primary,
    borderWidth: 3,
  },
  stepCircleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepCircleInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  stepConnector: {
    flex: 1,
    height: 3,
    backgroundColor: '#E2E8F0',
    marginBottom: 20,
    marginHorizontal: -4,
    zIndex: 1,
  },
  stepConnectorActive: {
    backgroundColor: colors.primary,
  },

  // Notice Alert Banner
  alertBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  alertMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
});

export function TicketBack({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={ticketStyles.back}>
      <Text style={ticketStyles.backText}>‹ {label}</Text>
    </Pressable>
  );
}

export function TicketState({
  title,
  description,
  loading = false,
  action,
  onAction,
  children,
}: PropsWithChildren<{
  title: string;
  description: string;
  loading?: boolean;
  action?: string;
  onAction?: () => void;
}>) {
  const { t } = useLanguage();
  return (
    <SafeAreaView style={ticketStyles.safe}>
      <View style={[ticketStyles.content, ticketStyles.state]}>
        <Text accessibilityRole="header" style={ticketStyles.title}>
          {title}
        </Text>
        <Text style={ticketStyles.subtitle}>{description}</Text>
        {loading && <ActivityIndicator color={colors.primary} accessibilityLabel={t('Đang tải')} />}
        {children}
        {action && onAction && <ActionButton title={action} onPress={onAction} />}
      </View>
    </SafeAreaView>
  );
}

export function FlightTimingBadge({ timing }: { timing: FlightTimingInfo }) {
  const { t } = useLanguage();
  return (
    <View
      style={[
        ticketStyles.timingBadge,
        {
          backgroundColor: timing.badgeBg,
          borderColor: timing.badgeBorder,
        },
      ]}
    >
      <Text style={[ticketStyles.timingBadgeText, { color: timing.badgeColor }]}>
        {t(timing.labelKey, timing.labelParams)}
      </Text>
    </View>
  );
}

export function FlightTimelineBar({ timing }: { timing: FlightTimingInfo }) {
  const { t } = useLanguage();
  const steps = [
    { label: t('Đặt vé') },
    { label: t('Chuẩn bị bay') },
    { label: t('Đang bay') },
    { label: t('Đã hạ cánh') },
  ];

  const currentStep = timing.stepIndex;

  return (
    <View style={ticketStyles.timelineCard}>
      <View style={ticketStyles.timelineHeader}>
        <Text style={ticketStyles.timelineTitle}>{t('Trạng thái chuyến bay')}</Text>
        <FlightTimingBadge timing={timing} />
      </View>

      <View style={ticketStyles.stepperRow}>
        {steps.map((step, idx) => {
          const isCompleted = currentStep > idx;
          const isActive = currentStep === idx;
          const isLast = idx === steps.length - 1;

          return (
            <View key={step.label} style={{ flex: isLast ? undefined : 1, flexDirection: 'row', alignItems: 'center' }}>
              <View style={ticketStyles.stepContainer}>
                <View
                  style={[
                    ticketStyles.stepCircle,
                    isCompleted && ticketStyles.stepCircleCompleted,
                    isActive && ticketStyles.stepCircleActive,
                  ]}
                >
                  {isCompleted ? (
                    <Text style={ticketStyles.stepCircleText}>✓</Text>
                  ) : isActive ? (
                    <View style={ticketStyles.stepCircleInnerDot} />
                  ) : (
                    <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700' }}>{idx + 1}</Text>
                  )}
                </View>
                <Text style={[ticketStyles.stepLabel, (isActive || isCompleted) && ticketStyles.stepLabelActive]}>
                  {step.label}
                </Text>
              </View>

              {!isLast && (
                <View
                  style={[
                    ticketStyles.stepConnector,
                    (isCompleted || (isActive && currentStep > 0)) && ticketStyles.stepConnectorActive,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Contextual Guidance / Reminder */}
      {timing.stage === 'boarding' && (
        <View
          style={[
            ticketStyles.alertBanner,
            { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' },
          ]}
        >
          <Text style={[ticketStyles.alertTitle, { color: '#C2410C' }]}>
            ⚠️ {t('Nhắc nhở khởi hành')}
          </Text>
          <Text style={[ticketStyles.alertMessage, { color: '#9A3412' }]}>
            {t(
              'Chuyến bay sắp khởi hành sau {time}. Quý khách vui lòng có mặt tại sân bay trước ít nhất 2 tiếng để làm thủ tục.',
              timing.labelParams,
            )}
          </Text>
        </View>
      )}

      {timing.stage === 'upcoming_soon' && (
        <View
          style={[
            ticketStyles.alertBanner,
            { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
          ]}
        >
          <Text style={[ticketStyles.alertTitle, { color: '#B45309' }]}>
            🔔 {t('Nhắc nhở khởi hành')}
          </Text>
          <Text style={[ticketStyles.alertMessage, { color: '#92400E' }]}>
            {t(
              'Chuyến bay sắp khởi hành sau {time}. Quý khách vui lòng có mặt tại sân bay trước ít nhất 2 tiếng để làm thủ tục.',
              timing.labelParams,
            )}
          </Text>
        </View>
      )}

      {timing.stage === 'in_flight' && (
        <View
          style={[
            ticketStyles.alertBanner,
            { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
          ]}
        >
          <Text style={[ticketStyles.alertTitle, { color: '#047857' }]}>
            ✈️ {t('Đang bay')}
          </Text>
          <Text style={[ticketStyles.alertMessage, { color: '#065F46' }]}>
            {t('Chuyến bay đang trong hành trình. Chúc quý khách một chuyến bay an toàn và thuận lợi!')}
          </Text>
        </View>
      )}

      {timing.stage === 'completed' && (
        <View
          style={[
            ticketStyles.alertBanner,
            { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
          ]}
        >
          <Text style={[ticketStyles.alertTitle, { color: '#475569' }]}>
            ✅ {t('Đã hạ cánh')}
          </Text>
          <Text style={[ticketStyles.alertMessage, { color: '#334155' }]}>
            {t('Chuyến bay đã hoàn thành. Cảm ơn quý khách đã đồng hành cùng Flyora!')}
          </Text>
        </View>
      )}
    </View>
  );
}
