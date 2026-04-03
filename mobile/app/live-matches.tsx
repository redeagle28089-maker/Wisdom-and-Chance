import React from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { api, GameRoom } from '@/lib/api';

function LiveMatchCard({ room }: { room: GameRoom }) {
  const p1 = room.players[0];
  const p2 = room.players[1];
  const getDisplayName = (p: typeof p1) =>
    p?.firstName ? `${p.firstName}${p.lastName ? ' ' + p.lastName[0] + '.' : ''}` : p?.email?.split('@')[0] ?? '???';

  return (
    <Pressable
      style={({ pressed }) => [styles.matchCard, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/room/[id]', params: { id: room.id } });
      }}
    >
      <View style={styles.matchHeader}>
        <View style={styles.statusDot} />
        <Text style={styles.matchStatus}>
          {room.status === 'playing' ? 'In Progress' : room.status === 'waiting' ? 'Waiting' : room.status}
        </Text>
        <Text style={styles.matchTime}>{new Date(room.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>

      <View style={styles.matchPlayers}>
        <View style={styles.playerSide}>
          <View style={styles.playerAvatar}>
            <Text style={styles.playerAvatarText}>{(p1?.firstName?.[0] || p1?.email?.[0] || '?').toUpperCase()}</Text>
          </View>
          <Text style={styles.playerName} numberOfLines={1}>{getDisplayName(p1)}</Text>
        </View>

        <View style={styles.vsContainer}>
          <MaterialCommunityIcons name="sword-cross" size={20} color={Colors.fire} />
          <Text style={styles.vsText}>VS</Text>
        </View>

        <View style={styles.playerSide}>
          <View style={[styles.playerAvatar, { backgroundColor: Colors.error + '30' }]}>
            <Text style={[styles.playerAvatarText, { color: Colors.error }]}>{(p2?.firstName?.[0] || p2?.email?.[0] || '?').toUpperCase()}</Text>
          </View>
          <Text style={styles.playerName} numberOfLines={1}>{p2 ? getDisplayName(p2) : 'Waiting...'}</Text>
        </View>
      </View>

      <View style={styles.matchFooter}>
        <Ionicons name="eye-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.matchFooterText}>Tap to spectate</Text>
      </View>
    </Pressable>
  );
}

export default function LiveMatchesScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.getRooms(),
    refetchInterval: 10000,
    retry: false,
  });

  const rooms = roomsQuery.data ?? [];
  const activeRooms = rooms.filter(r => r.status === 'playing' || r.status === 'waiting');

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Live Matches</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.liveIndicator}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>{activeRooms.length} active {activeRooms.length === 1 ? 'match' : 'matches'}</Text>
      </View>

      <FlatList
        data={activeRooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LiveMatchCard room={item} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!activeRooms.length}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => roomsQuery.refetch()} tintColor={Colors.primary} />}
        ListEmptyComponent={
          roomsQuery.isLoading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="sword-cross" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Active Matches</Text>
              <Text style={styles.emptyDesc}>No games are being played right now. Check back later or start your own!</Text>
              <Pressable style={styles.actionBtn} onPress={() => router.push('/room/create')}>
                <Text style={styles.actionBtnText}>Create a Room</Text>
              </Pressable>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  backBtn: { padding: 6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text },
  liveIndicator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  liveText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary },
  matchCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  matchStatus: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.success, flex: 1 },
  matchTime: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted },
  matchPlayers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerSide: { flex: 1, alignItems: 'center', gap: 6 },
  playerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '30', alignItems: 'center', justifyContent: 'center' },
  playerAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 18, color: Colors.primaryLight },
  playerName: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.text, textAlign: 'center' },
  vsContainer: { alignItems: 'center', gap: 2, paddingHorizontal: 12 },
  vsText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: Colors.textMuted },
  matchFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder },
  matchFooterText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text },
  emptyDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  actionBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  actionBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
});
