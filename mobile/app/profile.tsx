import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors, { getElementColor } from '@/constants/colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function getTierColor(rating: number) {
  if (rating >= 1600) return '#FFD700';
  if (rating >= 1400) return '#E5E4E2';
  if (rating >= 1200) return '#B8860B';
  if (rating >= 1000) return '#C0C0C0';
  if (rating >= 800) return '#CD7F32';
  return '#A0522D';
}

function getTierName(rating: number) {
  if (rating >= 1600) return 'Master';
  if (rating >= 1400) return 'Diamond';
  if (rating >= 1200) return 'Platinum';
  if (rating >= 1000) return 'Gold';
  if (rating >= 800) return 'Silver';
  return 'Bronze';
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const { user, logout } = useAuth();

  const statsQuery = useQuery({ queryKey: ['player-stats'], queryFn: () => api.getPlayerStats(), retry: false });
  const ratingQuery = useQuery({ queryKey: ['player-rating'], queryFn: () => api.getPlayerRating(), retry: false });
  const decksQuery = useQuery({ queryKey: ['user-decks'], queryFn: () => api.getUserDecks(), retry: false });
  const achievementsQuery = useQuery({ queryKey: ['achievements'], queryFn: () => api.getAchievements() });
  const playerAchQuery = useQuery({ queryKey: ['player-achievements'], queryFn: () => api.getPlayerAchievements(), retry: false });
  const gamesQuery = useQuery({ queryKey: ['games'], queryFn: () => api.getGames(), retry: false });

  const stats = statsQuery.data as any;
  const rating = (ratingQuery.data as any)?.rating ?? 1000;
  const decks = decksQuery.data ?? [];
  const achievements = achievementsQuery.data ?? [];
  const playerAch = playerAchQuery.data ?? [];
  const games = gamesQuery.data ?? [];
  const completedAch = playerAch.filter((a: any) => a.completed).length;
  const totalXP = playerAch.filter((a: any) => a.completed).reduce((sum: number, pa: any) => {
    const ach = achievements.find((a: any) => a.id === pa.achievementId);
    return sum + (ach?.xpReward ?? 0);
  }, 0);
  const level = Math.max(1, Math.floor(totalXP / 100) + 1);

  const totalGames = stats?.totalGames ?? 0;
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const favElement = stats?.favoriteElement;

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user?.email?.split('@')[0] ?? 'Player';

  const streak = (() => {
    let s = 0;
    for (const g of games.slice(0, 20)) {
      if ((g as any).result === 'win' || (g as any).winner === 'player') s++;
      else break;
    }
    return s;
  })();

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); logout(); router.replace('/'); }}>
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { statsQuery.refetch(); ratingQuery.refetch(); gamesQuery.refetch(); }} tintColor={Colors.primary} />}
      >
        <LinearGradient
          colors={[Colors.primaryDark + '50', Colors.primary + '25', 'transparent']}
          style={styles.profileCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName[0].toUpperCase()}</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Lv.{level}</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.tierRow}>
            <MaterialCommunityIcons name="shield-crown" size={20} color={getTierColor(rating)} />
            <Text style={[styles.tierText, { color: getTierColor(rating) }]}>
              {getTierName(rating)} · {rating} ELO
            </Text>
          </View>
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${(totalXP % 100)}%` }]} />
          </View>
          <Text style={styles.xpLabel}>{totalXP} XP · Level {level}</Text>
        </LinearGradient>

        <View style={styles.statsGrid}>
          {[
            { label: 'Games', value: totalGames, icon: 'game-controller', color: Colors.primary },
            { label: 'Wins', value: wins, icon: 'trophy', color: Colors.success },
            { label: 'Losses', value: losses, icon: 'close-circle', color: Colors.error },
            { label: 'Win Rate', value: `${winRate}%`, icon: 'trending-up', color: Colors.water },
            { label: 'Decks', value: decks.length, icon: 'albums', color: Colors.nature },
            { label: 'Streak', value: streak, icon: 'flame', color: Colors.fire },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Ionicons name={s.icon as any} size={20} color={s.color} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Achievements</Text>
          <View style={styles.achRow}>
            <Ionicons name="trophy" size={18} color={Colors.warning} />
            <Text style={styles.achText}>{completedAch} / {achievements.length} completed</Text>
          </View>
          <View style={styles.achBar}>
            <View style={[styles.achFill, { width: `${achievements.length > 0 ? (completedAch / achievements.length) * 100 : 0}%` }]} />
          </View>
        </View>

        {favElement && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Favorite Element</Text>
            <View style={styles.favRow}>
              <Ionicons
                name={favElement === 'fire' ? 'flame' : favElement === 'water' ? 'water' : favElement === 'earth' ? 'earth' : favElement === 'air' ? 'cloud' : 'leaf'}
                size={24}
                color={getElementColor(favElement)}
              />
              <Text style={[styles.favText, { color: getElementColor(favElement) }]}>
                {favElement.charAt(0).toUpperCase() + favElement.slice(1)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/analytics')}>
            <Ionicons name="bar-chart" size={18} color={Colors.primary} />
            <Text style={styles.actionBtnText}>Analytics</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/history')}>
            <Ionicons name="time" size={18} color={Colors.earth} />
            <Text style={styles.actionBtnText}>History</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text },
  profileCard: {
    borderRadius: 18, padding: 28, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.surfaceBorder, marginBottom: 16,
  },
  avatarContainer: { position: 'relative', marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary + '35', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 32, color: Colors.primaryLight },
  levelBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  levelText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#fff' },
  profileName: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colors.text },
  profileEmail: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  tierText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  xpBar: { width: '80%', height: 6, backgroundColor: Colors.surfaceLight, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  xpFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  xpLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '31%', backgroundColor: Colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textSecondary },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: Colors.surfaceBorder, gap: 10 },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text },
  achRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  achText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary },
  achBar: { height: 6, backgroundColor: Colors.surfaceLight, borderRadius: 3, overflow: 'hidden' },
  achFill: { height: '100%', backgroundColor: Colors.warning, borderRadius: 3 },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  favText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  actionBtnText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text },
});
