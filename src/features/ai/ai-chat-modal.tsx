import { router } from 'expo-router';
import { type ElementRef, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Airport } from '../discovery/model';
import { useLanguage } from '../i18n/provider';
import { getGeminiApiKey, saveCustomGeminiApiKey, sendChatMessageToGemini } from './gemini-service';
import { aiChatStore } from './ai-chat-store';
import type { AiExtractedFlightSearch, ChatMessage } from './types';

const GREETINGS: Record<'vi' | 'en', string> = {
  vi: 'Xin chào! Em là Trợ lý AI của Flyora. ✨\nBạn muốn bay đi đâu, vào thời gian nào và có bao nhiêu người cùng đi? Hãy nói hoặc nhắn cho em biết nhé!',
  en: "Hello! I'm Flyora's AI Assistant. ✨\nWhere would you like to fly, when, and how many passengers? Just tell me and I'll find the best flight options for you!",
};

const SUGGESTIONS: Record<'vi' | 'en', string[]> = {
  vi: [
    'Vé khứ hồi Hà Nội đi Đà Nẵng cuối tuần sau cho 2 người',
    'Tìm chuyến bay một chiều Sài Gòn đi Phú Quốc ngày mai',
    'Vé máy bay rẻ nhất đi Đà Lạt tuần tới',
  ],
  en: [
    'Round trip from Hanoi to Da Nang next weekend for 2 people',
    'One-way flight from Ho Chi Minh to Phu Quoc tomorrow',
    'Cheapest flight to Da Lat next week',
  ],
};

function createMessage(
  role: 'user' | 'assistant' | 'system',
  text: string,
  extra?: { flightSearch?: AiExtractedFlightSearch; error?: boolean }
): ChatMessage {
  const ts = Date.now();
  return {
    id: `${role}_${ts}_${Math.random().toString(36).slice(2, 6)}`,
    role,
    text,
    flightSearch: extra?.flightSearch,
    error: extra?.error,
    timestamp: ts,
  };
}

function FormattedMessageText({
  text,
  role,
  isError,
}: {
  text: string;
  role: string;
  isError?: boolean;
}) {
  const isUser = role === 'user';
  const textStyle = [
    s.bubbleText,
    isError ? s.bubbleTextError : isUser ? s.bubbleTextUser : s.bubbleTextAi,
  ];
  const boldStyle = [
    s.bubbleText,
    isError ? s.bubbleTextError : isUser ? s.bubbleTextUser : s.bubbleTextAi,
    s.boldInline,
  ];

  // Regex matches **bold text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <Text style={textStyle}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <Text key={index} style={boldStyle}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

export function AiChatModal({
  visible,
  onClose,
  airports,
}: {
  visible: boolean;
  onClose: () => void;
  airports: Airport[];
}) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight ?? 24));
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 10);

  const { messages, setMessages, resetChat } = useStore(aiChatStore);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [showKeyEditor, setShowKeyEditor] = useState(false);
  const [keySaveError, setKeySaveError] = useState(false);
  const scrollViewRef = useRef<ElementRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (visible) {
      void getGeminiApiKey().then((k) => {
        setApiKey(k);
        setShowKeyEditor(!k);
      });
    }
  }, [visible]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || loading) return;

    if (!apiKey) {
      setShowKeyEditor(true);
      const errorMessage = createMessage(
        'system',
        isEn
          ? 'Enter a Gemini API key in the AI settings above to use the assistant.'
          : 'Hãy nhập Gemini API key trong phần cài đặt AI ở phía trên để dùng trợ lý.',
        { error: true }
      );
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    const userMessage = createMessage('user', text);

    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInputText('');
    setLoading(true);

    try {
      const historyWithGreeting = nextHistory.map((m) =>
        m.id === 'greeting' ? { ...m, text: GREETINGS[language] || GREETINGS.vi } : m
      );
      const result = await sendChatMessageToGemini(historyWithGreeting, airports, apiKey, language);
      const assistantMessage = createMessage('assistant', result.text, {
        flightSearch: result.flightSearch,
      });
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      let errorText = isEn
        ? 'An error occurred while connecting to AI Assistant. Please try again later!'
        : 'Đã có lỗi xảy ra khi kết nối tới Trợ lý AI. Vui lòng thử lại sau!';

      if (err?.message === 'MISSING_API_KEY' || err?.message === 'INVALID_API_KEY') {
        setShowKeyEditor(true);
        errorText = isEn
          ? 'The Gemini API key is invalid or expired. Update it in AI settings.'
          : 'Gemini API key không hợp lệ hoặc đã hết hạn. Hãy cập nhật trong phần cài đặt AI.';
      } else if (err?.message === 'QUOTA_EXCEEDED') {
        errorText = isEn
          ? 'Gemini API quota exceeded (Rate limit). Please wait 1 minute and try again!'
          : 'Đã vượt quá giới hạn lượt gọi Gemini API (Rate limit). Bạn vui lòng đợi 1 phút rồi thử lại nhé!';
      }

      const errorMessage = createMessage('system', errorText, { error: true });
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFlightSearch = (flightSearch: AiExtractedFlightSearch) => {
    const originAirport = airports.find(
      (a) => a.iata_code.toUpperCase() === flightSearch.originIata.toUpperCase()
    );
    const destAirport = airports.find(
      (a) => a.iata_code.toUpperCase() === flightSearch.destinationIata.toUpperCase()
    );

    if (!originAirport || !destAirport) {
      alert(
        isEn
          ? `Airport data not found: ${flightSearch.originIata} or ${flightSearch.destinationIata}`
          : `Không tìm thấy dữ liệu sân bay: ${flightSearch.originIata} hoặc ${flightSearch.destinationIata}`
      );
      return;
    }

    onClose();

    if (flightSearch.tripType === 'one_way') {
      router.push({
        pathname: '/results',
        params: {
          originId: originAirport.id,
          destinationId: destAirport.id,
          departureDate: flightSearch.departureDate,
          adults: String(flightSearch.adults),
          children: String(flightSearch.children),
          infants: String(flightSearch.infants),
          cabinClass: flightSearch.cabinClass,
        },
      });
    } else {
      const trip = {
        tripType: 'round_trip',
        legs: [
          {
            originId: originAirport.id,
            destinationId: destAirport.id,
            departureDate: flightSearch.departureDate,
          },
          {
            originId: destAirport.id,
            destinationId: originAirport.id,
            departureDate: flightSearch.returnDate || flightSearch.departureDate,
          },
        ],
        adults: flightSearch.adults,
        children: flightSearch.children,
        infants: flightSearch.infants,
        cabinClass: flightSearch.cabinClass,
      };

      router.push({
        pathname: '/itinerary-results',
        params: {
          search: JSON.stringify(trip),
        },
      });
    }
  };

  const handleResetChat = () => {
    resetChat();
  };

  const handleSaveKey = async () => {
    const key = keyDraft.trim();
    if (!key) return;
    setKeySaveError(false);
    try {
      await saveCustomGeminiApiKey(key);
      setApiKey(key);
      setKeyDraft('');
      setShowKeyEditor(false);
    } catch {
      setKeySaveError(true);
    }
  };

  const getCabinName = (cabinClass: string) => {
    if (isEn) {
      switch (cabinClass) {
        case 'business':
          return 'Business';
        case 'premium_economy':
          return 'Premium Economy';
        case 'first':
          return 'First Class';
        default:
          return 'Economy';
      }
    }
    switch (cabinClass) {
      case 'business':
        return 'Thương gia (Business)';
      case 'premium_economy':
        return 'Phổ thông đặc biệt';
      case 'first':
        return 'Hạng nhất (First)';
      default:
        return 'Phổ thông (Economy)';
    }
  };

  const currentSuggestions = SUGGESTIONS[language] || SUGGESTIONS.vi;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <StatusBar barStyle="dark-content" />
      <View style={s.safe}>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header Bar with Safe Top Padding for Notch/Island */}
          <View style={[s.headerContainer, { paddingTop: topInset }]}>
            <View style={s.header}>
              <View style={s.headerTitleGroup}>
                <View style={s.aiAvatar}>
                  <Text style={s.aiAvatarText}>✨</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.headerTitle} numberOfLines={1}>Flyora AI Assistant</Text>
                  <Text style={s.headerSubTitle} numberOfLines={1}>
                    {isEn ? 'Natural language flight search' : 'Tìm kiếm chuyến bay bằng ngôn ngữ tự nhiên'}
                  </Text>
                </View>
              </View>

              <View style={s.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isEn ? 'Configure Gemini API key' : 'Cấu hình Gemini API key'}
                  onPress={() => {
                    setKeySaveError(false);
                    setShowKeyEditor((value) => !value);
                  }}
                  style={s.headerBtn}
                >
                  <Text style={s.headerBtnText}>🔑</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isEn ? 'Reset conversation' : 'Làm mới cuộc trò chuyện'}
                  onPress={handleResetChat}
                  style={s.headerBtn}
                >
                  <Text style={s.headerBtnText}>↺</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isEn ? 'Close chat' : 'Đóng khung chat'}
                  onPress={onClose}
                  style={[s.headerBtn, s.headerBtnClose]}
                >
                  <Text style={s.headerBtnCloseText}>✕</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {showKeyEditor && (
            <View style={s.keyBanner}>
              <Text style={s.keyBannerTitle}>
                {isEn ? 'Gemini API key for this device' : 'Gemini API key cho thiết bị này'}
              </Text>
              <Text style={s.keyBannerDesc}>
                {isEn
                  ? 'Enter your own key to enable AI flight search. It is saved on this device.'
                  : 'Nhập key của bạn để bật tìm chuyến bằng AI. Key được lưu trên thiết bị này.'}
              </Text>
              <View style={s.keyInputRow}>
                <TextInput
                  accessibilityLabel={isEn ? 'Gemini API key' : 'Gemini API key'}
                  value={keyDraft}
                  onChangeText={setKeyDraft}
                  placeholder="Gemini API key"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={s.keyInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isEn ? 'Save Gemini API key' : 'Lưu Gemini API key'}
                  onPress={() => void handleSaveKey()}
                  disabled={!keyDraft.trim()}
                  style={[s.keySaveBtn, !keyDraft.trim() && s.sendBtnDisabled]}
                >
                  <Text style={s.keySaveBtnText}>{isEn ? 'Save' : 'Lưu'}</Text>
                </Pressable>
              </View>
              {keySaveError && (
                <Text style={s.keyBannerDesc}>
                  {isEn ? 'Could not save the key. Please try again.' : 'Không lưu được key. Vui lòng thử lại.'}
                </Text>
              )}
            </View>
          )}

          {/* Messages Scroll Area */}
          <ScrollView
            ref={scrollViewRef}
            style={s.messageList}
            contentContainerStyle={s.messageContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg) => {
              const messageText = msg.id === 'greeting' ? (GREETINGS[language] || GREETINGS.vi) : msg.text;
              return (
              <View
                key={msg.id}
                style={[
                  s.bubbleWrapper,
                  msg.role === 'user' ? s.bubbleWrapperUser : s.bubbleWrapperAi,
                ]}
              >
                {msg.role !== 'user' && (
                  <View style={s.botAvatarMini}>
                    <Text style={{ fontSize: 13 }}>✨</Text>
                  </View>
                )}

                <View
                  style={[
                    s.bubble,
                    msg.role === 'user' ? s.bubbleUser : s.bubbleAi,
                    msg.error && s.bubbleError,
                  ]}
                >
                  <FormattedMessageText
                    text={messageText}
                    role={msg.role}
                    isError={msg.error}
                  />

                  {msg.error && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        const lastUser = [...messages].reverse().find(m => m.role === 'user');
                        if (lastUser) {
                          void handleSend(lastUser.text);
                        }
                      }}
                      style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={s.retryText}>
                        ↻ {isEn ? 'Retry' : 'Thử lại ngay'}
                      </Text>
                    </Pressable>
                  )}

                  {/* Flight Preview Card if AI found a match */}
                  {msg.flightSearch && (
                    <View style={s.flightCard}>
                      <View style={s.flightCardHeader}>
                        <Text style={s.flightCardTag}>
                          {isEn ? '✈ FLIGHT FOUND' : '✈ CHUYẾN BAY TÌM THẤY'}
                        </Text>
                        <Text style={s.flightCardType}>
                          {msg.flightSearch.tripType === 'round_trip'
                            ? isEn ? 'Round-trip' : 'Khứ hồi'
                            : isEn ? 'One-way' : 'Một chiều'}
                        </Text>
                      </View>

                      <View style={s.flightCardRoute}>
                        <Text style={s.flightCardCity}>
                          {msg.flightSearch.originName || msg.flightSearch.originIata}
                        </Text>
                        <Text style={s.flightCardArrow}>➔</Text>
                        <Text style={s.flightCardCity}>
                          {msg.flightSearch.destinationName || msg.flightSearch.destinationIata}
                        </Text>
                      </View>

                      <View style={s.flightCardDetails}>
                        <Text style={s.flightCardDetailText}>
                          📅 {isEn ? 'Departure:' : 'Ngày đi:'}{' '}
                          <Text style={s.bold}>{msg.flightSearch.departureDate}</Text>
                        </Text>
                        {msg.flightSearch.returnDate && (
                          <Text style={s.flightCardDetailText}>
                            📅 {isEn ? 'Return:' : 'Ngày về:'}{' '}
                            <Text style={s.bold}>{msg.flightSearch.returnDate}</Text>
                          </Text>
                        )}
                        <Text style={s.flightCardDetailText}>
                          👥 {isEn ? 'Passengers:' : 'Hành khách:'}{' '}
                          <Text style={s.bold}>
                            {isEn
                              ? `${msg.flightSearch.adults} adult(s)`
                              : `${msg.flightSearch.adults} người lớn`}
                          </Text>
                          {msg.flightSearch.children > 0
                            ? isEn
                              ? `, ${msg.flightSearch.children} child(ren)`
                              : `, ${msg.flightSearch.children} trẻ em`
                            : ''}
                          {msg.flightSearch.infants > 0
                            ? isEn
                              ? `, ${msg.flightSearch.infants} infant(s)`
                              : `, ${msg.flightSearch.infants} em bé`
                            : ''}
                        </Text>
                        <Text style={s.flightCardDetailText}>
                          💺 {isEn ? 'Cabin class:' : 'Hạng ghế:'}{' '}
                          <Text style={s.bold}>{getCabinName(msg.flightSearch.cabinClass)}</Text>
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => msg.flightSearch && handleApplyFlightSearch(msg.flightSearch)}
                        style={({ pressed }) => [s.flightCtaBtn, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={s.flightCtaText}>
                          {isEn ? 'View these flights ➔' : 'Xem các chuyến bay này ➔'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
              );
            })}

            {loading && (
              <View style={[s.bubbleWrapper, s.bubbleWrapperAi]}>
                <View style={s.botAvatarMini}>
                  <Text style={{ fontSize: 13 }}>✨</Text>
                </View>
                <View style={[s.bubble, s.bubbleAi, s.bubbleLoading]}>
                  <ActivityIndicator size="small" color="#007E91" />
                  <Text style={s.loadingText}>
                    {isEn ? 'Flyora AI is searching flights...' : 'Flyora AI đang tìm kiếm chuyến bay...'}
                  </Text>
                </View>
              </View>
            )}

            {/* Quick Suggestions when conversation is fresh */}
            {messages.length === 1 && !loading && (
              <View style={s.suggestionsBox}>
                <Text style={s.suggestionsTitle}>
                  {isEn ? '💡 Quick flight suggestions:' : '💡 Gợi ý câu hỏi nhanh:'}
                </Text>
                {currentSuggestions.map((sug, i) => (
                  <Pressable key={i} onPress={() => handleSend(sug)} style={s.suggestionPill}>
                    <Text style={s.suggestionPillText}>{sug}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Bottom Input Area with Home Indicator padding */}
          <View style={[s.inputBar, { paddingBottom: bottomInset }]}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={
                isEn
                  ? 'Type a message... (e.g. round trip to Da Nang next weekend)'
                  : 'Nhắn gì đó... (ví dụ: khứ hồi đi Đà Nẵng cuối tuần)'
              }
              placeholderTextColor="#94A3B8"
              style={s.textInput}
              multiline
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isEn ? 'Send message' : 'Gửi tin nhắn'}
              onPress={() => handleSend()}
              disabled={!inputText.trim() || loading}
              style={[s.sendBtn, (!inputText.trim() || loading) && s.sendBtnDisabled]}
            >
              <Text style={s.sendBtnIcon}>➤</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  aiAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  aiAvatarText: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  headerSubTitle: { fontSize: 11, color: '#64748B' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: { fontSize: 16 },
  headerBtnClose: { backgroundColor: '#FEE2E2' },
  headerBtnCloseText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },

  keyBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    gap: 6,
  },
  keyBannerTitle: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  keyBannerDesc: { fontSize: 11.5, color: '#78350F', lineHeight: 16 },
  keyBannerLink: { fontWeight: '700', textDecorationLine: 'underline' },
  keyInputRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  keyInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  keySaveBtn: {
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  keySaveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  messageList: { flex: 1 },
  messageContent: { padding: 16, gap: 14 },
  bubbleWrapper: {
    flexDirection: 'row',
    gap: 8,
    width: '88%',
    maxWidth: '88%',
  },
  bubbleWrapperUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  bubbleWrapperAi: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  botAvatarMini: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bubble: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  bubbleUser: {
    backgroundColor: '#007E91',
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bubbleError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  retryBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  bubbleLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: { fontSize: 13, color: '#64748B' },
  bubbleText: { fontSize: 14.5, lineHeight: 21 },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTextAi: { color: '#1E293B' },
  bubbleTextError: { color: '#DC2626' },
  boldInline: { fontWeight: '700' },

  flightCard: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#5EEAD4',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  flightCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flightCardTag: { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  flightCardType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007E91',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flightCardRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  flightCardCity: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  flightCardArrow: { fontSize: 14, color: '#007E91' },
  flightCardDetails: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  flightCardDetailText: { fontSize: 12.5, color: '#334155' },
  bold: { fontWeight: '700', color: '#0F172A' },
  flightCtaBtn: {
    backgroundColor: '#007E91',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  flightCtaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  suggestionsBox: {
    marginTop: 8,
    gap: 8,
    paddingHorizontal: 4,
  },
  suggestionsTitle: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  suggestionPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionPillText: { fontSize: 13, color: '#007E91' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007E91',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  sendBtnIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 2,
  },
});
