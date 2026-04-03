import React from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Game {
  id: string;
  player1Id: string;
  player2Id: string;
  player1Name?: string;
  player2Name?: string;
  winnerId?: string;
  status: string;
  createdAt: string;
  player1Hp?: number;
  player2Hp?: number;
  rounds?: number;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const gamesQuery = useQuery({
    queryKey: ['games'],
    queryFn: () => api.getGames(),
    retry: false,
  });

  const games = (gamesQuery.data ?? []) as Game[];

  function getGameResult(game: Game) {
    if (!game.winnerId) return { text: 'In Progress', color: Colors.warning };
    if (game.winnerId === user?.id) return { text: 'Victory', color: Colors.success };
    return { text: 'Defeat', color: Colors.error };
  }

  function getOpponentName(game: Game) {
    if (game.player1Id === user?.id) return game.player2Name || 'Opponent';
    return game.player1Name || 'Opponent';
  }

  function formatDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Game History</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={games}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const result = getGameResult(item);
          return (
            <View style={styles.gameItem}>
              <View style={[styles.resultBar, { backgroundColor: result.color }]} />
              <View style={styles.gameContent}>
                <View style={styles.gameTop}>
                  <Text style={[styles.resultText, { color: result.color }]}>{result.text}</Text>
                  <Text style={styles.gameDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <View style={styles.gameBottom}>
                  <View style={styles.opponentRow}>
                    <MaterialCommunityIcons name="sword-cross" size={16} color={Colors.textMuted} />
                    <Text style={styles.opponentText}>vs {getOpponentName(item)}</Text>
                  </View>
                  {item.rounds && (
                    <Text style={styles.roundsText}>{item.rounds} rounds</Text>
                  )}
                </View>
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 40 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!games.length}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => gamesQuery.refetch()} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          gamesQuery.isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="sword-cross" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Games Yet</Text>
              <Text style={styles.emptyText}>Your battle history will appear here</Text>
              <Pressable
                style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85 }]}
                onPress={() => { router.back(); router.push('/(tabs)/social'); }}
              >
                <Ionicons name="game-controller" size={18} color="#fff" />
                <Text style={styles.playBtnText}>Find a Game</Text>
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
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  topBarTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.text },
  gameItem: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 14,
    marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  resultBar: { width: 4 },
  gameContent: { flex: 1, padding: 14, gap: 6 },
  gameTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  gameDate: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted },
  gameBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  opponentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  opponentText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary },
  roundsText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: Colors.text },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.textSecondary },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8,
  },
  playBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
});
