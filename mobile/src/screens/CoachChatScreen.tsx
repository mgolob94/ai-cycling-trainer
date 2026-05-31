import { useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { api, apiOrigin, type ApiResponse } from '../services/api';
import { Text } from '../components/ui';
import { palette, spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { AppStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
interface Msg {
  role: 'user' | 'assistant';
  content: string;
}
interface CoachReply {
  message: string;
  intent: string;
  suggested_action: { label: string; screen: string } | null;
  remaining: number | null;
}

const QUICK_REPLIES = ['How is my form?', "What's tomorrow's workout?", "I'm tired", 'New goal'];

export default function CoachChatScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: "Hi! I'm your coach. Ask me anything about your training, form, or how you feel." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [suggested, setSuggested] = useState<CoachReply['suggested_action']>(null);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const history = messages.slice(-10);
    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setInput('');
    setSuggested(null);
    setSending(true);
    try {
      const { data } = await api.post<ApiResponse<CoachReply>>(`${apiOrigin}/coach/message`, {
        message: trimmed,
        conversationHistory: history,
      });
      const reply = data.data;
      if (reply) {
        setMessages((m) => [...m, { role: 'assistant', content: reply.message }]);
        setRemaining(reply.remaining);
        setSuggested(reply.suggested_action);
      }
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: status === 429 ? "You've reached your monthly message limit. Upgrade for more." : 'Sorry, I had trouble responding. Try again.' },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubbleRow, m.role === 'user' ? styles.rightRow : styles.leftRow]}>
              {m.role === 'assistant' ? (
                <View style={styles.avatar}>
                  <Text variant="label" color="#FFFFFF" style={styles.avatarText}>
                    C
                  </Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.bubble,
                  m.role === 'user'
                    ? { backgroundColor: palette.slate900 }
                    : { backgroundColor: colors.surfaceRaised },
                ]}
              >
                <Text variant="body" color={m.role === 'user' ? '#FFFFFF' : colors.textPrimary}>
                  {m.content}
                </Text>
              </View>
            </View>
          ))}
          {sending ? (
            <View style={[styles.bubbleRow, styles.leftRow]}>
              <View style={styles.avatar}>
                <Text variant="label" color="#FFFFFF" style={styles.avatarText}>
                  C
                </Text>
              </View>
              <View style={[styles.bubble, { backgroundColor: colors.surfaceRaised }]}>
                <ActivityIndicator color={palette.slate400} />
              </View>
            </View>
          ) : null}
          {suggested ? (
            <Pressable style={styles.suggested} onPress={() => navigation.navigate(suggested.screen as never)}>
              <Text variant="caption" color={palette.indigo600} style={styles.bold}>
                {suggested.label} →
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {/* Quick replies */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {QUICK_REPLIES.map((q) => (
            <Pressable key={q} style={[styles.quickChip, { borderColor: colors.border }]} onPress={() => send(q)}>
              <Text variant="caption" color={colors.textSecondary}>
                {q}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {remaining != null && remaining < 5 ? (
          <Text variant="caption" color={palette.amber600} style={styles.remaining}>
            {remaining} messages left this month
          </Text>
        ) : null}

        <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceRaised }]}
            placeholder="Ask your coach…"
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <Pressable style={[styles.sendBtn, { backgroundColor: palette.slate900 }]} onPress={() => send(input)} disabled={sending}>
            <Feather name="arrow-up" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  messages: { padding: spacing[4], gap: spacing[3] },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], maxWidth: '88%' },
  leftRow: { alignSelf: 'flex-start' },
  rightRow: { alignSelf: 'flex-end' },
  avatar: { width: 28, height: 28, borderRadius: radius.full, backgroundColor: palette.slate800, alignItems: 'center', justifyContent: 'center' },
  avatarText: { letterSpacing: 0 },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], flexShrink: 1 },
  suggested: { alignSelf: 'flex-start', marginLeft: 36, marginTop: -spacing[1] },
  bold: { fontWeight: '700' },
  quickRow: { gap: spacing[2], paddingHorizontal: spacing[4], paddingBottom: spacing[2] },
  quickChip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },
  remaining: { textAlign: 'center', paddingBottom: spacing[1] },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[3], borderTopWidth: 1 },
  input: { flex: 1, borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
