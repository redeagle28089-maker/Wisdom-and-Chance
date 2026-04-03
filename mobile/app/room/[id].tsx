import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, FlatList, Alert,
  TextInput, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { api, GameRoom, SavedDeck } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useWebSocket } from '@/lib/websocket';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const ws = useWebSocket(isAuthenticated);

  useEffect(() => {
    if (ws.isConnected && id) {
      ws.joinRoom(id);
    }
    return () => {
      if (ws.isConnected && id) {
        ws.leaveRoom(id);
      }
    };
  }, [ws.isConnected, id]);

  useEffect(() => {
    const unsubs = [
      ws.subscribe('room_update', (data) => {
        if (data.roomId === id) {
          queryClient.invalidateQueries({ queryKey: ['room', id] });
        }
      }),
      ws.subscribe('player_joined', (data) => {
        if (data.roomId === id) {
          queryClient.invalidateQueries({ queryKey: ['room', id] });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }),
      ws.subscribe('player_left', (data) => {
        if (data.roomId === id) {
          queryClient.invalidateQueries({ queryKey: ['room', id] });
        }
      }),
      ws.subscribe('player_ready_update', (data) => {
        if (data.roomId === id) {
          queryClient.invalidateQueries({ queryKey: ['room', id] });
        }
      }),
      ws.subscribe('game_start', (data) => {
        if (data.roomId === id) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries({ queryKey: ['room', id] });
          router.push({ pathname: '/game/pvp-board', params: { roomId: id, gameId: data.gameId } });
        }
      }),
      ws.subscribe('chat_message', (data) => {
        if (data.roomId === id) {
          setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            userId: data.senderId || data.userId,
            userName: data.displayName || data.userName || 'Player',
            message: data.message,
            timestamp: data.createdAt || new Date().toISOString(),
          }]);
        }
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [id, ws]);

  const roomQuery = useQuery({
    queryKey: ['room', id],
    queryFn: () => api.getRoom(id!),
    enabled: !!id,
    refetchInterval: ws.isConnected ? false : 3000,
  });

  const decksQuery = useQuery({
    queryKey: ['user-decks'],
    queryFn: () => api.getUserDecks(),
  });

  const joinMutation = useMutation({
    mutationFn: () => api.joinRoom(id!),
    onSuccess: () => roomQuery.refetch(),
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.leaveRoom(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      router.back();
    },
  });

  const readyMutation = useMutation({
    mutationFn: (deckId: string) => api.setReady(id!, deckId),
    onSuccess: () => roomQuery.refetch(),
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const startMutation = useMutation({
    mutationFn: () => api.startGame(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room', id] });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const room = roomQuery.data;
  const myDecks = decksQuery.data ?? [];
  const isInRoom = room?.players?.some(p => p.userId === user?.id);
  const isHost = room?.hostId === user?.id;
  const myPlayer = room?.players?.find(p => p.userId === user?.id);
  const allReady = room?.players?.every(p => p.isReady) && (room?.players?.length || 0) >= 2;

  const handleSendChat = () => {
    if (!chatInput.trim() || !id) return;
    ws.sendRoomMessage(id, chatInput.trim());
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      userId: user?.id || '',
      userName: user?.firstName || 'You',
      message: chatInput.trim(),
      timestamp: new Date().toISOString(),
    }]);
    setChatInput('');
  };

  if (roomQuery.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>Room</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>Room</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={40} color={Colors.error} />
          <Text style={styles.errorText}>Room not found</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>{room.name}</Text>
        <Pressable onPress={() => setShowChat(!showChat)} hitSlop={8}>
          <Ionicons name={showChat ? 'chatbubble' : 'chatbubble-outline'} size={22} color={showChat ? Colors.primary : Colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.connectionBadge}>
        <View style={[styles.connDot, { backgroundColor: ws.isConnected ? Colors.success : Colors.warning }]} />
        <Text style={styles.connText}>{ws.isConnected ? 'Live' : 'Polling'}</Text>
      </View>

      <View style={styles.roomHeader}>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: room.status === 'waiting' ? Colors.warning : Colors.success }]} />
          <Text style={styles.statusText}>{room.status}</Text>
        </View>
        <Text style={styles.playerCount}>{room.players?.length || 0} / 2 players</Text>
      </View>

      {!showChat ? (
        <>
          <Text style={styles.sectionLabel}>Players</Text>
          <View style={styles.playersList}>
            {room.players?.map((player) => (
              <View key={player.userId} style={styles.playerItem}>
                <View style={styles.playerAvatar}>
                  <Text style={styles.playerAvatarText}>
                    {(player.firstName?.[0] || player.email[0]).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>
                    {player.firstName || player.email.split('@')[0]}
                    {player.userId === room.hostId ? ' (Host)' : ''}
                  </Text>
                  <Text style={[styles.playerReady, { color: player.isReady ? Colors.success : Colors.textMuted }]}>
                    {player.isReady ? 'Ready' : 'Not ready'}
                  </Text>
                </View>
                {player.isReady && <Ionicons name="checkmark-circle" size={22} color={Colors.success} />}
              </View>
            ))}
          </View>

          {isInRoom && !myPlayer?.isReady && myDecks.length > 0 && (
            <View style={styles.deckSection}>
              <Text style={styles.sectionLabel}>Select Deck</Text>
              <FlatList
                data={myDecks}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.deckChip, pressed && { opacity: 0.85 }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      readyMutation.mutate(item.id);
                    }}
                  >
                    <MaterialCommunityIcons name="cards-playing-outline" size={16} color={Colors.primary} />
                    <Text style={styles.deckChipText}>{item.name}</Text>
                  </Pressable>
                )}
              />
            </View>
          )}
        </>
      ) : (
        <View style={styles.chatContainer}>
          <FlatList
            data={chatMessages}
            keyExtractor={(item) => item.id}
            inverted={false}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => (
              <View style={[styles.chatBubble, item.userId === user?.id && styles.chatBubbleMine]}>
                {item.userId !== user?.id && (
                  <Text style={styles.chatSender}>{item.userName}</Text>
                )}
                <Text style={styles.chatText}>{item.message}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.chatEmpty}>
                <Ionicons name="chatbubbles-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.chatEmptyText}>No messages yet</Text>
              </View>
            }
          />
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInputField}
              placeholder="Type a message..."
              placeholderTextColor={Colors.textMuted}
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={handleSendChat}
              returnKeyType="send"
            />
            <Pressable
              style={[styles.chatSendBtn, !chatInput.trim() && { opacity: 0.4 }]}
              onPress={handleSendChat}
              disabled={!chatInput.trim()}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 16 }]}>
        {!isInRoom ? (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              joinMutation.mutate();
            }}
            disabled={joinMutation.isPending}
          >
            {joinMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="enter" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Join Room</Text>
              </>
            )}
          </Pressable>
        ) : (
          <>
            {isHost && allReady && (
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, { backgroundColor: Colors.success }, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  startMutation.mutate();
                }}
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="play" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Start Game</Text>
                  </>
                )}
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                leaveMutation.mutate();
              }}
            >
              <Ionicons name="exit" size={18} color={Colors.error} />
              <Text style={[styles.secondaryBtnText, { color: Colors.error }]}>Leave Room</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  topBarTitle: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.text, textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.error },
  connectionBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 4, marginBottom: 8,
  },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  connText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.textMuted },
  roomHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, marginHorizontal: 16,
    backgroundColor: Colors.surface, borderRadius: 14, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text, textTransform: 'capitalize' },
  playerCount: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text, paddingHorizontal: 20, marginBottom: 10 },
  playersList: { paddingHorizontal: 16, gap: 8, marginBottom: 24 },
  playerItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  playerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + '30', alignItems: 'center', justifyContent: 'center' },
  playerAvatarText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.primaryLight },
  playerInfo: { flex: 1 },
  playerName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  playerReady: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  deckSection: { marginBottom: 20 },
  deckChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  deckChipText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text },
  chatContainer: { flex: 1 },
  chatBubble: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 12, maxWidth: '80%',
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  chatBubbleMine: {
    backgroundColor: Colors.primary + '20', borderColor: Colors.primary + '30', alignSelf: 'flex-end',
  },
  chatSender: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.primary, marginBottom: 2 },
  chatText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.text },
  chatEmpty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  chatEmptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textMuted },
  chatInputRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  chatInputField: {
    flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text,
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  chatSendBtn: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  bottomActions: { paddingHorizontal: 16, gap: 10, marginTop: 'auto' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
  },
  primaryBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#fff' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: Colors.error + '40',
  },
  secondaryBtnText: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  pvpNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginBottom: 16, padding: 12,
    backgroundColor: Colors.warning + '10', borderRadius: 12,
    borderWidth: 1, borderColor: Colors.warning + '30',
  },
  pvpNoticeText: {
    flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13,
    color: Colors.textSecondary, lineHeight: 18,
  },
});
