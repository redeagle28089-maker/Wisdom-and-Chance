import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors, { getElementColor } from '@/constants/colors';
import { api } from '@/lib/api';

function StatRow({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <View style={styles.statRow}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function BarChart({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const statsQuery = useQuery({ queryKey: ['player-stats'], queryFn: () => api.getPlayerStats(), retry: false });
  const ratingQuery = useQuery({ queryKey: ['player-rating'], queryFn: () => api.getPlayerRating(), retry: false });
  const gamesQuery = useQuery({ queryKey: ['games'], queryFn: () => api.getGames(), retry: false });
  const achievementsQuery = useQuery({ queryKey: ['achievements'], queryFn: () => api.getAchievements() });
  const playerAchQuery = useQuery({ queryKey: ['player-achievements'], queryFn: () => api.getPlayerAchievements(), retry: false });

  const stats = statsQuery.data as any;
  const rating = (ratingQuery.data as any)?.rating ?? 1000;
  const games = gamesQuery.data ?? [];
  const achievements = achievementsQuery.data ?? [];
  const playerAch = playerAchQuery.data ?? [];
  const completedAch = playerAch.filter((a: any) => a.completed).length;

  const totalGames = stats?.totalGames ?? 0;
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const favElement = stats?.favoriteElement ?? 'none';

  const recentGames = games.slice(0, 10);
  const recentWins = recentGames.filter((g: any) => g.result === 'win' || g.winner === 'player').length;
  const recentStreak = (() => {
    let streak = 0;
    for (const g of recentGames) {
      if (g.result === 'win' || g.winner === 'player') streak++;
      else break;
    }
    return streak;
  })();

  const isLoading = statsQuery.isLoading || ratingQuery.isLoading;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Analytics</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => { statsQuery.refetch(); ratingQuery.refetch(); gamesQuery.refetch(); }} tintColor={Colors.primary} />}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Performance Overview</Text>
            <StatRow label="ELO Rating" value={String(rating)} icon="diamond" color={Colors.primary} />
            <StatRow label="Total Games" value={String(totalGames)} icon="game-controller" color={Colors.water} />
            <StatRow label="Win Rate" value={`${winRate}%`} icon="trending-up" color={Colors.success} />
            <StatRow label="Current Streak" value={String(recentStreak)} icon="flame" color={Colors.fire} />
            <StatRow label="Achievements" value={`${completedAch}/${achievements.length}`} icon="trophy" color={Colors.warning} />
            {favElement !== 'none' && (
              <StatRow label="Favorite Element" value={favElement} icon="heart" color={getElementColor(favElement)} />
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Win/Loss Distribution</Text>
            <BarChart label="Wins" value={wins} max={totalGames || 1} color={Colors.success} />
            <BarChart label="Losses" value={losses} max={totalGames || 1} color={Colors.error} />
            <BarChart label="Draws" value={Math.max(0, totalGames - wins - losses)} max={totalGames || 1} color={Colors.textMuted} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Form (Last 10)</Text>
            <View style={styles.formRow}>
              {recentGames.length > 0 ? recentGames.map((g: any, i: number) => {
                const isWin = g.result === 'win' || g.winner === 'player';
                return (
                  <View key={i} style={[styles.formDot, { backgroundColor: isWin ? Colors.success : Colors.error }]}>
                    <Text style={styles.formDotText}>{isWin ? 'W' : 'L'}</Text>
                  </View>
                );
              }) : (
                <Text style={styles.noData}>No games played yet</Text>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rating Tier Progress</Text>
            {[
              { name: 'Bronze', min: 0, max: 800 },
              { name: 'Silver', min: 800, max: 1000 },
              { name: 'Gold', min: 1000, max: 1200 },
              { name: 'Platinum', min: 1200, max: 1400 },
              { name: 'Diamond', min: 1400, max: 1600 },
              { name: 'Master', min: 1600, max: 2000 },
            ].map((tier) => {
              const inTier = rating >= tier.min && rating < tier.max;
              const pct = inTier ? ((rating - tier.min) / (tier.max - tier.min)) * 100 : rating >= tier.max ? 100 : 0;
              return (
                <View key={tier.name} style={[styles.tierRow, inTier && { backgroundColor: Colors.primary + '10' }]}>
                  <Text style={[styles.tierName, inTier && { color: Colors.primary }]}>{tier.name}</Text>
                  <View style={styles.tierBar}>
                    <View style={[styles.tierFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.tierRange}>{tier.min}-{tier.max}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  backBtn: { padding: 6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: Colors.surfaceBorder, gap: 12 },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text, marginBottom: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, flex: 1 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary, width: 50 },
  barBg: { flex: 1, height: 8, backgroundColor: Colors.surfaceLight, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, width: 30, textAlign: 'right' },
  formRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  formDot: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  formDotText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#fff' },
  noData: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textMuted },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 },
  tierName: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary, width: 65 },
  tierBar: { flex: 1, height: 6, backgroundColor: Colors.surfaceLight, borderRadius: 3, overflow: 'hidden' },
  tierFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  tierRange: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted, width: 60, textAlign: 'right' },
});
