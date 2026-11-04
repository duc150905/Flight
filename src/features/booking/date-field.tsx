import { useState } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/provider';
import { monthGrid } from '../discovery/search-calendar';
import { CheckoutButton, CheckoutError, useCheckoutColors } from './ui';

export function CheckoutDateField<T extends FieldValues>({
  control,
  name,
  label,
  passengerType,
  onRawChange,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  passengerType?: string;
  onRawChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { t, language } = useLanguage();
  const c = useCheckoutColors();

  const today = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getUTCFullYear();

  const getDefaultYear = () => {
    if (passengerType === 'child') return currentYear - 6;
    if (passengerType === 'infant') return currentYear - 1;
    return currentYear - 25;
  };

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const val = typeof field.value === 'string' ? field.value.trim() : '';

        return (
          <View style={styles.field}>
            <Text style={[styles.label, { color: c.text }]}>{t(label)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t(label)}: ${val || t('Chọn ngày sinh')}`}
              onPress={() => setOpen(true)}
              style={[
                styles.inputButton,
                {
                  borderColor: fieldState.error ? c.error : c.border,
                  backgroundColor: c.surface,
                },
              ]}
            >
              <Text style={{ fontSize: 16, color: val ? c.text : c.muted }}>
                {val || t('Chọn ngày sinh (YYYY-MM-DD)')}
              </Text>
              <Text style={styles.calendarIcon}>📅</Text>
            </Pressable>

            <CheckoutError message={fieldState.error?.message} />

            {open && (
              <DatePickerModal
                value={val}
                defaultYear={getDefaultYear()}
                today={today}
                language={language}
                onSelect={(date) => {
                  field.onChange(date);
                  onRawChange(date);
                  field.onBlur();
                  setOpen(false);
                }}
                onClose={() => {
                  field.onBlur();
                  setOpen(false);
                }}
              />
            )}
          </View>
        );
      }}
    />
  );
}

function DatePickerModal({
  value,
  defaultYear,
  today,
  language,
  onSelect,
  onClose,
}: {
  value: string;
  defaultYear: number;
  today: string;
  language: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  const initialYear = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Number(value.slice(0, 4))
    : defaultYear;
  const initialMonth = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Number(value.slice(5, 7)) - 1
    : 5;

  const [cursor, setCursor] = useState({ year: initialYear, month: initialMonth });
  const [showYearPicker, setShowYearPicker] = useState(false);

  const prevMonth = () => {
    setCursor((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setCursor((prev) => {
      const isNextFuture =
        prev.year > Number(today.slice(0, 4)) ||
        (prev.year === Number(today.slice(0, 4)) && prev.month >= Number(today.slice(5, 7)) - 1);
      if (isNextFuture) return prev;
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const prevYear = () => {
    setCursor((prev) => ({ year: Math.max(1920, prev.year - 1), month: prev.month }));
  };

  const nextYear = () => {
    const maxYear = Number(today.slice(0, 4));
    setCursor((prev) => ({ year: Math.min(maxYear, prev.year + 1), month: prev.month }));
  };

  const currentYearNum = Number(today.slice(0, 4));
  const yearList = Array.from({ length: currentYearNum - 1920 + 1 }, (_, i) => currentYearNum - i);

  const monthName = new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(cursor.year, cursor.month, 1)));

  const weekdays = language === 'en'
    ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
    : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  const days = monthGrid(cursor.year, cursor.month);

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('Chọn ngày sinh')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Đóng')}
            onPress={onClose}
            style={styles.closeBtn}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* Month & Year Navigation */}
        <View style={styles.navRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Năm trước')} onPress={prevYear} style={styles.arrowBtn}>
            <Text style={styles.arrowText}>«</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Tháng trước')} onPress={prevMonth} style={styles.arrowBtn}>
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Chọn năm')}
            onPress={() => setShowYearPicker((v) => !v)}
            style={styles.monthTitleBtn}
          >
            <Text style={styles.monthTitleText}>{monthName}</Text>
            <Text style={styles.yearToggleHint}>{showYearPicker ? '▲' : '▼'}</Text>
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel={t('Tháng sau')} onPress={nextMonth} style={styles.arrowBtn}>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Năm sau')} onPress={nextYear} style={styles.arrowBtn}>
            <Text style={styles.arrowText}>»</Text>
          </Pressable>
        </View>

        {showYearPicker ? (
          <ScrollView contentContainerStyle={styles.yearGrid} showsVerticalScrollIndicator={false}>
            {yearList.map((y) => {
              const isSelected = y === cursor.year;
              return (
                <Pressable
                  key={y}
                  accessibilityRole="button"
                  onPress={() => {
                    setCursor((prev) => ({ ...prev, year: y }));
                    setShowYearPicker(false);
                  }}
                  style={[styles.yearChip, isSelected && styles.yearChipSelected]}
                >
                  <Text style={[styles.yearChipText, isSelected && styles.yearChipTextSelected]}>
                    {y}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.calendarScroll}>
            {/* Weekday Row */}
            <View style={styles.weekdayRow}>
              {weekdays.map((d) => (
                <Text key={d} style={styles.weekdayText}>{d}</Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {days.map((date, idx) => {
                if (!date) {
                  return <View key={`blank-${idx}`} style={styles.daySlot} />;
                }
                const isSelected = date === value;
                const isFuture = date > today;
                return (
                  <View key={date} style={styles.daySlot}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isFuture}
                      onPress={() => onSelect(date)}
                      style={[
                        styles.dayBtn,
                        isSelected && styles.dayBtnSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayBtnText,
                          isFuture && styles.dayBtnTextDisabled,
                          isSelected && styles.dayBtnTextSelected,
                        ]}
                      >
                        {Number(date.slice(-2))}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Footer */}
        <View style={styles.modalFooter}>
          <CheckoutButton title="Xong" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  inputButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarIcon: { fontSize: 18 },
  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  closeBtnText: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 18, fontWeight: '700', color: '#334155' },
  monthTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  monthTitleText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  yearToggleHint: { fontSize: 10, color: '#64748B' },
  calendarScroll: { paddingHorizontal: 16, paddingVertical: 16 },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  daySlot: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 3,
  },
  dayBtn: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  dayBtnSelected: {
    backgroundColor: '#00B8D0',
  },
  dayBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  dayBtnTextDisabled: {
    color: '#CBD5E1',
  },
  dayBtnTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
  },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  yearChipSelected: {
    backgroundColor: '#00B8D0',
    borderColor: '#00B8D0',
  },
  yearChipText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  yearChipTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  modalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
});
