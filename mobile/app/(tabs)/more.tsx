import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, Pressable, ActivityIndicator,
  Platform, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { api, Achievement, PlayerAchievement, LeaderboardEntry } from '@/lib/api';
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

const MCI_ICONS: Record<string, string> = {
  sword: 'sword-cross',
  crown: 'crown',
  swords: 'sword-cross',
  target: 'crosshairs',
};

const IONICON_MAP: Record<string, string> = {
  layers: 'layers-outline',
  trophy: 'trophy-outline',
  flame: 'flame-outline',
  star: 'star-outline',
  shield: 'shield-outline',
  zap: 'flash-outline',
  medal: 'medal-outline',
};

function isMciIcon(icon: string): boolean {
  return !!MCI_ICONS[icon];
}

function getIconName(icon: string): string {
  return IONICON_MAP[icon] || 'ribbon-outline';
}

function getMciIconName(icon: string): string {
  return MCI_ICONS[icon] || 'star-outline';
}

function AchievementItem({ achievement, playerAchievement }: {
  achievement: Achievement; playerAchievement?: PlayerAchievement;
}) {
  const isCompleted = playerAchievement?.completed ?? false;
  const progress = playerAchievement?.progress ?? 0;
  const progressPct = Math.min((progress / achievement.requirement) * 100, 100);

  return (
    <View style={[styles.achievementItem, isCompleted && styles.achievementCompleted]}>
      <View style={[styles.achieveIcon, isCompleted && { backgroundColor: Colors.success + '25' }]}>
        {isCompleted ? (
          <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
        ) : isMciIcon(achievement.icon) ? (
          <MaterialCommunityIcons name={getMciIconName(achievement.icon) as any} size={22} color={Colors.textMuted} />
        ) : (
          <Ionicons name={getIconName(achievement.icon) as any} size={22} color={Colors.textMuted} />
        )}
      </View>
      <View style={styles.achieveInfo}>
        <Text style={styles.achieveName}>{achievement.name}</Text>
        <Text style={styles.achieveDesc} numberOfLines={2}>{achievement.description}</Text>
        {!isCompleted && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        )}
      </View>
      <View style={styles.achieveReward}>
        <Text style={[styles.xpText, isCompleted && { color: Colors.success }]}>
          {achievement.xpReward} XP
        </Text>
      </View>
    </View>
  );
}

function LeaderboardItem({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const tierColor = getTierColor(entry.rating);
  const displayName = entry.firstName
    ? `${entry.firstName}${entry.lastName ? ' ' + entry.lastName[0] + '.' : ''}`
    : entry.email.split('@')[0];

  return (
    <View style={styles.leaderItem}>
      <View style={[styles.rankBadge, index < 3 && { backgroundColor: tierColor + '25' }]}>
        <Text style={[styles.rankText, index < 3 && { color: tierColor }]}>#{index + 1}</Text>
      </View>
      <View style={styles.leaderAvatar}>
        <Text style={styles.leaderAvatarText}>{(entry.firstName?.[0] || entry.email[0]).toUpperCase()}</Text>
      </View>
      <View style={styles.leaderInfo}>
        <Text style={styles.leaderName}>{displayName}</Text>
        <Text style={styles.leaderMeta}>{entry.wins}W {entry.losses}L</Text>
      </View>
      <View style={styles.leaderRating}>
        <Text style={[styles.ratingNum, { color: tierColor }]}>{entry.rating}</Text>
        <Text style={[styles.tierLabel, { color: tierColor }]}>{getTierName(entry.rating)}</Text>
      </View>
    </View>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [tab, setTab] = useState<'achievements' | 'leaderboard' | 'profile'>('achievements');

  const achievementsQuery = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.getAchievements(),
  });

  const playerAchievementsQuery = useQuery({
    queryKey: ['player-achievements'],
    queryFn: () => api.getPlayerAchievements(),
    retry: false,
  });

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.getLeaderboard(),
  });

  const statsQuery = useQuery({
    queryKey: ['player-stats'],
    queryFn: () => api.getPlayerStats(),
    retry: false,
  });

  const ratingQuery = useQuery({
    queryKey: ['player-rating'],
    queryFn: () => api.getPlayerRating(),
    retry: false,
  });

  const achievements = achievementsQuery.data ?? [];
  const playerAchievements = playerAchievementsQuery.data ?? [];
  const leaderboard = leaderboardQuery.data ?? [];
  const completedCount = playerAchievements.filter(pa => pa.completed).length;
  const stats = statsQuery.data;
  const rating = (ratingQuery.data as any)?.rating ?? 1000;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Text style={styles.headerTitle}>More</Text>
      </View>

      <View style={styles.tabRow}>
        {(['achievements', 'leaderboard', 'profile'] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => { Haptics.selectionAsync(); setTab(t); }}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === 'achievements' ? 'Achievements' : t === 'leaderboard' ? 'Leaderboard' : 'Profile'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'achievements' && (
        <View style={{ flex: 1 }}>
          <View style={styles.achieveSummary}>
            <Ionicons name="trophy" size={18} color={Colors.warning} />
            <Text style={styles.achieveSummaryText}>
              {completedCount}/{achievements.length} completed
            </Text>
          </View>
          <FlatList
            data={achievements}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AchievementItem
                achievement={item}
                playerAchievement={playerAchievements.find(pa => pa.achievementId === item.id)}
              />
            )}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!!achievements.length}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={() => { achievementsQuery.refetch(); playerAchievementsQuery.refetch(); }} tintColor={Colors.primary} />
            }
            ListEmptyComponent={
              achievementsQuery.isLoading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
              ) : null
            }
          />
        </View>
      )}

      {tab === 'leaderboard' && (
        <FlatList
          data={leaderboard}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={({ item, index }) => <LeaderboardItem entry={item} index={index} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!leaderboard.length}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => leaderboardQuery.refetch()} tintColor={Colors.primary} />
          }
          ListHeaderComponent={
            <View style={styles.tierLegend}>
              {[
                { name: 'Bronze', min: 0 },
                { name: 'Silver', min: 800 },
                { name: 'Gold', min: 1000 },
                { name: 'Platinum', min: 1200 },
                { name: 'Diamond', min: 1400 },
                { name: 'Master', min: 1600 },
              ].map((t) => (
                <View key={t.name} style={styles.tierItem}>
                  <View style={[styles.tierDot, { backgroundColor: getTierColor(t.min) }]} />
                  <Text style={[styles.tierText, { color: getTierColor(t.min) }]}>{t.name}</Text>
                </View>
              ))}
            </View>
          }
          ListEmptyComponent={
            leaderboardQuery.isLoading ? (
              <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="podium-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Rankings Yet</Text>
              </View>
            )
          }
        />
      )}

      {tab === 'profile' && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {(user?.firstName?.[0] || user?.email?.[0] || 'P').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.profileName}>
              {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.email || 'Player'}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={[styles.profileTier, { backgroundColor: getTierColor(rating) + '20' }]}>
              <MaterialCommunityIcons name="shield-crown" size={18} color={getTierColor(rating)} />
              <Text style={[styles.profileTierText, { color: getTierColor(rating) }]}>
                {getTierName(rating)} · {rating} ELO
              </Text>
            </View>
          </View>

          <View style={styles.profileStats}>
            <View style={styles.profileStatItem}>
              <Text style={styles.profileStatValue}>{(stats as any)?.totalGames ?? 0}</Text>
              <Text style={styles.profileStatLabel}>Games</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStatItem}>
              <Text style={styles.profileStatValue}>{(stats as any)?.wins ?? 0}</Text>
              <Text style={styles.profileStatLabel}>Wins</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStatItem}>
              <Text style={styles.profileStatValue}>{(stats as any)?.losses ?? 0}</Text>
              <Text style={styles.profileStatLabel}>Losses</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStatItem}>
              <Text style={styles.profileStatValue}>{completedCount}</Text>
              <Text style={styles.profileStatLabel}>Achievements</Text>
            </View>
          </View>

          <View style={styles.quickLinks}>
            {[
              { icon: 'game-controller', label: 'Practice Battle', route: '/practice', color: Colors.fire },
              { icon: 'school-outline', label: 'How to Play', route: '/tutorial', color: Colors.water },
              { icon: 'library-outline', label: 'Lore Archives', route: '/lore', color: Colors.primaryLight },
              { icon: 'bar-chart', label: 'Analytics', route: '/analytics', color: Colors.primary },
              { icon: 'eye-outline', label: 'Live Matches', route: '/live-matches', color: Colors.success },
              { icon: 'person-circle', label: 'Full Profile', route: '/profile', color: Colors.air },
              { icon: 'information-circle-outline', label: 'About', route: '/about', color: Colors.textSecondary },
            ].map((item) => (
              <Pressable
                key={item.route}
                style={({ pressed }) => [styles.quickLink, pressed && { opacity: 0.8 }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(item.route as any); }}
              >
                <Ionicons name={item.icon as any} size={20} color={item.color} />
                <Text style={styles.quickLinkText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              logout();
              router.replace('/');
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.text },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.surfaceBorder },
  tabBtnActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  tabBtnText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.primary },
  achieveSummary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  achieveSummaryText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary },
  achievementItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  achievementCompleted: { borderColor: Colors.success + '40' },
  achieveIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  achieveInfo: { flex: 1, gap: 4 },
  achieveName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  achieveDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  progressBar: { height: 4, backgroundColor: Colors.surfaceLight, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  achieveReward: { alignItems: 'center' },
  xpText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.warning },
  tierLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16, justifyContent: 'center' },
  tierItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  leaderItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 12, marginBottom: 6, gap: 10,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  rankBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.textSecondary },
  leaderAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryDark + '40', alignItems: 'center', justifyContent: 'center' },
  leaderAvatarText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.primaryLight },
  leaderInfo: { flex: 1 },
  leaderName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.text },
  leaderMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  leaderRating: { alignItems: 'flex-end' },
  ratingNum: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  tierLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  profileCard: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 18, padding: 28, marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: Colors.surfaceBorder },
  profileAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary + '30', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  profileAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.primaryLight },
  profileName: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text, marginBottom: 4 },
  profileEmail: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  profileTier: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  profileTierText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  profileStats: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder, marginBottom: 16,
  },
  profileStatItem: { flex: 1, alignItems: 'center' },
  profileStatValue: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text, marginBottom: 2 },
  profileStatLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  profileStatDivider: { width: 1, backgroundColor: Colors.surfaceBorder },
  quickLinks: { gap: 4, marginBottom: 16 },
  quickLink: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  quickLinkText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: Colors.error + '30',
  },
  logoutText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.error },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text },
});
