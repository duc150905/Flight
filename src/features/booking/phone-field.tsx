import { useMemo, useState } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLanguage } from '../i18n/provider';
import {
  COUNTRY_CALLING_CODES,
  filterCountries,
  findCountryByDialCode,
  type CountryCallingCode,
} from './country-codes';
import { choosePhoneCode, editPhoneNumber, splitPhone } from './phone';
import { CheckoutButton, CheckoutError, checkoutStyles, useCheckoutColors } from './ui';

export function CheckoutPhoneField<T extends FieldValues>({
  control,
  name,
  onRawChange,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  onRawChange(value: string): void;
}) {
  const { t, language } = useLanguage();
  const c = useCheckoutColors();
  const [open, setOpen] = useState(false);
  const [fullNumber, setFullNumber] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCountries = useMemo(() => {
    return filterCountries(searchQuery);
  }, [searchQuery]);

  const popularCountries = useMemo(() => {
    return COUNTRY_CALLING_CODES.filter((item) => item.popular);
  }, []);

  const otherCountries = useMemo(() => {
    return COUNTRY_CALLING_CODES.filter((item) => !item.popular);
  }, []);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const parts = fullNumber
          ? { code: '', number: field.value ?? '' }
          : splitPhone(field.value ?? '');
        const currentCountry = findCountryByDialCode(parts.code);

        const change = (raw: string) => {
          field.onChange(raw);
          onRawChange(raw);
        };

        const handleSelectCountry = (country: CountryCallingCode | null) => {
          if (!country) {
            setFullNumber(true);
            change(choosePhoneCode(field.value ?? '', ''));
          } else {
            setFullNumber(false);
            change(choosePhoneCode(field.value ?? '', country.dialCode));
          }
          field.onBlur();
          setOpen(false);
          setSearchQuery('');
        };

        const renderCountryItem = (item: CountryCallingCode) => {
          const isSelected = !fullNumber && parts.code === item.dialCode;
          const countryName = language === 'vi' ? item.nameVi : item.nameEn;
          return (
            <Pressable
              key={item.iso + item.dialCode}
              accessibilityRole="button"
              accessibilityLabel={`${countryName} ${item.dialCode}`}
              onPress={() => handleSelectCountry(item)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: isSelected ? '#E6F4F6' : pressed ? '#F8FAFC' : 'transparent',
                  borderWidth: isSelected ? 1 : 0,
                  borderColor: '#007E91',
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 22 }}>{item.flag}</Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: isSelected ? '700' : '500',
                    color: isSelected ? '#007E91' : c.text,
                    flexShrink: 1,
                  }}
                >
                  {countryName}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: isSelected ? '#007E91' : '#475569',
                  }}
                >
                  {item.dialCode}
                </Text>
                {isSelected && (
                  <Text style={{ fontSize: 14, color: '#007E91', fontWeight: '800' }}>✓</Text>
                )}
              </View>
            </Pressable>
          );
        };

        return (
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '600', lineHeight: 24 }}>
              {t('Phone number')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Country calling code')}
                accessibilityState={{ expanded: open }}
                onPress={() => {
                  setSearchQuery('');
                  setOpen(true);
                }}
                style={{
                  minWidth: 96,
                  minHeight: 48,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: c.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: c.surface,
                }}
              >
                <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>
                  {fullNumber
                    ? '🌐 + ▾'
                    : currentCountry
                    ? `${currentCountry.flag} ${currentCountry.dialCode} ▾`
                    : parts.code
                    ? `${parts.code} ▾`
                    : '🌐 Mã vùng ▾'}
                </Text>
              </Pressable>
              <TextInput
                ref={field.ref}
                value={parts.number}
                keyboardType="phone-pad"
                autoComplete="tel"
                accessibilityLabel={t('Phone number')}
                accessibilityHint={
                  fieldState.error?.message
                    ? t(fieldState.error.message)
                    : t('Enter the full number or choose a calling code.')
                }
                placeholder={
                  parts.code === '+84'
                    ? '901 234 567'
                    : parts.code
                    ? '123 456 789'
                    : '+84 901 234 567'
                }
                placeholderTextColor={c.muted}
                onBlur={field.onBlur}
                onChangeText={(value) => change(editPhoneNumber(parts.code, value))}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 48,
                  padding: 12,
                  fontSize: 16,
                  color: c.text,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: fieldState.error ? c.error : c.border,
                }}
              />
            </View>
            <CheckoutError message={fieldState.error?.message} />

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
              <View style={checkoutStyles.scrim}>
                <View
                  accessibilityViewIsModal
                  style={[
                    checkoutStyles.dialog,
                    {
                      maxHeight: '85%',
                      padding: 18,
                      gap: 12,
                    },
                  ]}
                >
                  {/* Header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingBottom: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F1F5F9',
                    }}
                  >
                    <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>
                      {language === 'vi' ? 'Chọn quốc gia / Mã vùng' : 'Select Country / Calling Code'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                      onPress={() => setOpen(false)}
                      style={{ padding: 4 }}
                    >
                      <Text style={{ fontSize: 18, fontWeight: '700', color: c.muted }}>✕</Text>
                    </Pressable>
                  </View>

                  {/* Thanh tìm kiếm */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#F1F5F9',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      minHeight: 42,
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 15 }}>🔍</Text>
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder={
                        language === 'vi'
                          ? 'Tìm theo tên nước hoặc mã số (+81, Hàn Quốc...)'
                          : 'Search country name or code (+81, Korea...)'
                      }
                      placeholderTextColor={c.muted}
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: c.text,
                        paddingVertical: 6,
                      }}
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                    {!!searchQuery && (
                      <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                        <Text style={{ fontSize: 14, color: c.muted, fontWeight: '700' }}>✕</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Danh sách quốc gia cuộn */}
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: 360 }}
                    contentContainerStyle={{ gap: 4 }}
                  >
                    {/* Tùy chọn nhập số quốc tế tự do */}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleSelectCountry(null)}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          backgroundColor: fullNumber ? '#E6F4F6' : pressed ? '#F8FAFC' : '#FAFAFA',
                          borderWidth: fullNumber ? 1 : 1,
                          borderColor: fullNumber ? '#007E91' : '#E2E8F0',
                          marginBottom: 4,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <Text style={{ fontSize: 20 }}>🌐</Text>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: fullNumber ? '700' : '600',
                            color: fullNumber ? '#007E91' : c.text,
                          }}
                        >
                          {language === 'vi'
                            ? 'Tự nhập số quốc tế đầy đủ (+...)'
                            : 'Full international number (type any +code)'}
                        </Text>
                      </View>
                      {fullNumber && (
                        <Text style={{ fontSize: 14, color: '#007E91', fontWeight: '800' }}>✓</Text>
                      )}
                    </Pressable>

                    {searchQuery.trim() ? (
                      /* Kết quả tìm kiếm */
                      filteredCountries.length > 0 ? (
                        filteredCountries.map(renderCountryItem)
                      ) : (
                        <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 28 }}>🌍</Text>
                          <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center' }}>
                            {language === 'vi'
                              ? 'Không tìm thấy quốc gia phù hợp.\nBạn có thể chọn "Tự nhập số quốc tế" ở trên.'
                              : 'No matching country found.\nYou can select "Full international number" above.'}
                          </Text>
                        </View>
                      )
                    ) : (
                      /* Danh sách mặc định: Phổ biến + Tất cả */
                      <>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: '#007E91',
                            textTransform: 'uppercase',
                            marginTop: 6,
                            marginBottom: 2,
                            paddingHorizontal: 4,
                          }}
                        >
                          ⭐ {language === 'vi' ? 'Quốc gia phổ biến' : 'Popular Countries'}
                        </Text>
                        {popularCountries.map(renderCountryItem)}

                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: '#64748B',
                            textTransform: 'uppercase',
                            marginTop: 12,
                            marginBottom: 2,
                            paddingHorizontal: 4,
                          }}
                        >
                          {language === 'vi' ? 'Tất cả quốc gia (A-Z)' : 'All Countries (A-Z)'}
                        </Text>
                        {otherCountries.map(renderCountryItem)}
                      </>
                    )}
                  </ScrollView>

                  {/* Nút đóng */}
                  <CheckoutButton
                    title="Close"
                    secondary
                    onPress={() => {
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  />
                </View>
              </View>
            </Modal>
          </View>
        );
      }}
    />
  );
}
