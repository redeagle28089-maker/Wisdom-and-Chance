import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { api, FriendMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function MessageBubble({ message, isMine }: { message: FriendMessage; isMine: boolean }) {
  const time = new Date(message.createdAt);
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

  return (
    <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{message.content}</Text>
        <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>{timeStr}</Text>
      </View>
    </View>
  );
}

export default function MessagesScreen() {
  const { friendId, name } = useLocalSearchParams<{ friendId: string; name: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [text, setText] = useState('');

  const messagesQuery = useQuery({
    queryKey: ['messages', friendId],
    queryFn: () => api.getFriendMessages(friendId!),
    enabled: !!friendId,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => api.sendFriendMessage(friendId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', friendId] });
      setText('');
    },
  });

  const messages = messagesQuery.data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>{name || 'Messages'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {messagesQuery.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={[...messages].reverse()}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} isMine={item.senderId === user?.id} />
            )}
            inverted
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!!messages.length}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No messages yet</Text>
              </View>
            }
          />
        )}

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 8 }]}>
          <TextInput
            style={styles.messageInput}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]}
            onPress={() => {
              if (text.trim()) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                sendMutation.mutate(text.trim());
              }
            }}
            disabled={!text.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  backBtn: { marginRight: 12 },
  topBarTitle: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.text },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 8, transform: [{ scaleY: -1 }] },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textMuted },
  bubbleRow: { flexDirection: 'row', marginBottom: 6 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.surfaceBorder },
  bubbleText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.6)' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8, gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder, backgroundColor: Colors.background,
  },
  messageInput: {
    flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text,
    backgroundColor: Colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    maxHeight: 100, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});
