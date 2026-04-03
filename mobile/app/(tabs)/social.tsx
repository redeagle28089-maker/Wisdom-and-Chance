import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator,
  Platform, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { api, Friend, FriendRequest } from '@/lib/api';

function FriendItem({ friend }: { friend: Friend }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.friendItem, pressed && { opacity: 0.85 }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/messages/[friendId]', params: { friendId: friend.friendId, name: friend.firstName || friend.email } });
      }}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(friend.firstName?.[0] || friend.email[0]).toUpperCase()}
          </Text>
        </View>
        <View style={[styles.onlineDot, { backgroundColor: friend.isOnline ? Colors.success : Colors.textMuted }]} />
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>
          {friend.firstName ? `${friend.firstName}${friend.lastName ? ' ' + friend.lastName : ''}` : friend.email}
        </Text>
        <Text style={styles.friendStatus}>{friend.isOnline ? 'Online' : 'Offline'}</Text>
      </View>
      <Ionicons name="chatbubble-outline" size={20} color={Colors.textMuted} />
    </Pressable>
  );
}

function RequestItem({ request, onAccept, onDecline }: {
  request: FriendRequest; onAccept: () => void; onDecline: () => void;
}) {
  return (
    <View style={styles.requestItem}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(request.fromFirstName?.[0] || request.fromEmail[0]).toUpperCase()}
        </Text>
      </View>
      <View style={styles.requestInfo}>
        <Text style={styles.friendName}>
          {request.fromFirstName ? `${request.fromFirstName} ${request.fromLastName || ''}` : request.fromEmail}
        </Text>
        <Text style={styles.friendStatus}>Wants to be your friend</Text>
      </View>
      <Pressable onPress={onAccept} style={[styles.actionBtn, { backgroundColor: Colors.success + '20' }]}>
        <Ionicons name="checkmark" size={18} color={Colors.success} />
      </Pressable>
      <Pressable onPress={onDecline} style={[styles.actionBtn, { backgroundColor: Colors.error + '20' }]}>
        <Ionicons name="close" size={18} color={Colors.error} />
      </Pressable>
    </View>
  );
}

export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [tab, setTab] = useState<'friends' | 'requests' | 'rooms'>('friends');
  const [addEmail, setAddEmail] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const friendsQuery = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.getFriends(),
    retry: false,
  });

  const requestsQuery = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => api.getFriendRequests(),
    retry: false,
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.getRooms(),
    retry: false,
  });

  const sendRequestMutation = useMutation({
    mutationFn: (email: string) => api.sendFriendRequest(email),
    onSuccess: () => {
      setAddEmail('');
      setShowAdd(false);
      Alert.alert('Sent', 'Friend request sent!');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.acceptFriendRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => api.declineFriendRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });

  const friends = friendsQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Text style={styles.title}>Social</Text>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          onPress={() => setShowAdd(!showAdd)}
        >
          <Ionicons name={showAdd ? "close" : "person-add"} size={22} color={Colors.primary} />
        </Pressable>
      </View>

      {showAdd && (
        <View style={styles.addSection}>
          <TextInput
            style={styles.addInput}
            placeholder="Enter email to add friend..."
            placeholderTextColor={Colors.textMuted}
            value={addEmail}
            onChangeText={setAddEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Pressable
            style={[styles.sendBtn, !addEmail.trim() && { opacity: 0.4 }]}
            onPress={() => { if (addEmail.trim()) sendRequestMutation.mutate(addEmail.trim()); }}
            disabled={!addEmail.trim() || sendRequestMutation.isPending}
          >
            {sendRequestMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      )}

      <View style={styles.tabRow}>
        {(['friends', 'requests', 'rooms'] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => { Haptics.selectionAsync(); setTab(t); }}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === 'friends' ? `Friends${friends.length > 0 ? ` (${friends.length})` : ''}` :
               t === 'requests' ? `Requests${requests.length > 0 ? ` (${requests.length})` : ''}` :
               `Rooms${rooms.length > 0 ? ` (${rooms.length})` : ''}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'friends' && (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FriendItem friend={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!friends.length}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => friendsQuery.refetch()} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            friendsQuery.isLoading ? (
              <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Friends Yet</Text>
                <Text style={styles.emptyText}>Add friends by their email address</Text>
              </View>
            )
          }
        />
      )}

      {tab === 'requests' && (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestItem
              request={item}
              onAccept={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); acceptMutation.mutate(item.id); }}
              onDecline={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); declineMutation.mutate(item.id); }}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!requests.length}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => requestsQuery.refetch()} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            requestsQuery.isLoading ? (
              <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Pending Requests</Text>
                <Text style={styles.emptyText}>Friend requests will appear here</Text>
              </View>
            )
          }
        />
      )}

      {tab === 'rooms' && (
        <View style={{ flex: 1 }}>
          <Pressable
            style={({ pressed }) => [styles.createRoomBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/room/create');
            }}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.createRoomText}>Create Room</Text>
          </Pressable>
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.roomItem, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/room/[id]', params: { id: item.id } });
                }}
              >
                <View style={styles.roomIcon}>
                  <Ionicons name="game-controller" size={22} color={Colors.primary} />
                </View>
                <View style={styles.roomInfo}>
                  <Text style={styles.roomName}>{item.name}</Text>
                  <Text style={styles.roomMeta}>
                    {item.players?.length || 0} player{(item.players?.length || 0) !== 1 ? 's' : ''} · {item.status}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </Pressable>
            )}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!!rooms.length}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={() => roomsQuery.refetch()} tintColor={Colors.primary} />
            }
            ListEmptyComponent={
              roomsQuery.isLoading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="game-controller-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No Rooms</Text>
                  <Text style={styles.emptyText}>Create a room to start playing</Text>
                </View>
              )
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.text },
  addBtn: { padding: 8 },
  addSection: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12,
  },
  addInput: {
    flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text,
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.surfaceBorder },
  tabBtnActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  tabBtnText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.primary },
  friendItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryDark + '40', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.primaryLight },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.surface },
  friendInfo: { flex: 1 },
  friendName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  friendStatus: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary },
  requestItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 10,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  requestInfo: { flex: 1 },
  actionBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  createRoomBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, marginHorizontal: 16, marginBottom: 12,
  },
  createRoomText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
  roomItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  roomIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  roomInfo: { flex: 1 },
  roomName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  roomMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
});
