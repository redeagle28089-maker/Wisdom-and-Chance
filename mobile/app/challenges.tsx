import React from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { api, DailyChallenge, PlayerChallenge } from '@/lib/api';

function getChallengeIcon(type: string): string {
  const map: Record<string, string> = {
    games_played: 'game-controller',
    wins: 'trophy',
    cards_deployed: 'layers',
    damage_dealt: 'flame',
    abilities_used: 'flash',
  };
  return map[type] || 'flash';
}

function ChallengeItem({ challenge, playerChallenge }: {
  challenge: DailyChallenge;
  playerChallenge?: PlayerChallenge;
}) {
  const queryClient = useQueryClient();
  const progress = playerChallenge?.progress ?? 0;
  const target = challenge.requirement;
  const pct = Math.min((progress / target) * 100, 100);
  const isComplete = playerChallenge?.completed ?? false;
  const isClaimed = playerChallenge?.claimed ?? false;

  const claimMutation = useMutation({
    mutationFn: () => api.claimChallenge(playerChallenge!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-challenges'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Reward claimed!', `You earned ${challenge.xpReward} XP!`);
    },
    onError: (err: Error) => Alert.alert('Failed to claim reward', err.message),
  });

  const timeLeft = challenge.expiresAt ? getTimeLeft(challenge.expiresAt) : '';

  return (
    <View style={[styles.challengeCard, isComplete && !isClaimed && styles.challengeCardReady, isClaimed && styles.challengeCardClaimed]}>
      <View style={[styles.challengeIconWrap, {
        backgroundColor: isClaimed ? Colors.success + '15' : isComplete ? '#F59E0B15' : Colors.primary + '15',
      }]}>
        <Ionicons
          name={isClaimed ? 'checkmark-circle' : isComplete ? 'gift' : getChallengeIcon(challenge.type) as any}
          size={24}
          color={isClaimed ? Colors.success : isComplete ? '#F59E0B' : Colors.primary}
        />
      </View>

      <View style={styles.challengeContent}>
        <View style={styles.challengeHeader}>
          <Text style={styles.challengeName} numberOfLines={1}>{challenge.name}</Text>
          <View style={styles.xpBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={styles.xpText}>{challenge.xpReward} XP</Text>
          </View>
        </View>
        <Text style={styles.challengeDesc} numberOfLines={2}>{challenge.description}</Text>

        <View style={styles.progressRow}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, {
              width: `${pct}%`,
              backgroundColor: isClaimed ? Colors.success : isComplete ? '#F59E0B' : Colors.primary,
            }]} />
          </View>
          <Text style={styles.progressText}>{progress}/{target}</Text>
        </View>

        {timeLeft ? (
          <View style={styles.timerRow}>
            <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.timerText}>{timeLeft}</Text>
          </View>
        ) : null}
      </View>

      {isComplete && !isClaimed && playerChallenge && (
        <Pressable
          style={({ pressed }) => [styles.claimBtn, pressed && { opacity: 0.85 }]}
          onPress={() => claimMutation.mutate()}
          disabled={claimMutation.isPending}
        >
          {claimMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.claimBtnText}>Claim</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

function getTimeLeft(expiresAt: string): string {
  const now = new Date();
  const exp = new Date(expiresAt);
  const diff = exp.getTime() - now.getTime();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const challengesQuery = useQuery({
    queryKey: ['daily-challenges'],
    queryFn: () => api.getDailyChallenges(),
  });

  const playerChallengesQuery = useQuery({
    queryKey: ['player-challenges'],
    queryFn: () => api.getPlayerChallenges(),
    retry: false,
  });

  const challenges = challengesQuery.data ?? [];
  const playerChallenges = playerChallengesQuery.data ?? [];
  const completedCount = playerChallenges.filter(pc => pc.completed).length;
  const claimedCount = playerChallenges.filter(pc => pc.claimed).length;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Daily Challenges</Text>
        <View style={{ width: 24 }} />
      </View>

      <LinearGradient
        colors={['#F59E0B20', '#F59E0B08', 'transparent']}
        style={styles.summaryCard}
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Ionicons name="flash" size={20} color="#F59E0B" />
            <Text style={styles.summaryValue}>{challenges.length}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.summaryValue}>{completedCount}</Text>
            <Text style={styles.summaryLabel}>Complete</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="gift" size={20} color={Colors.primary} />
            <Text style={styles.summaryValue}>{claimedCount}</Text>
            <Text style={styles.summaryLabel}>Claimed</Text>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={challenges}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChallengeItem
            challenge={item}
            playerChallenge={playerChallenges.find(pc => pc.challengeId === item.id)}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!challenges.length}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => { challengesQuery.refetch(); playerChallengesQuery.refetch(); }}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          challengesQuery.isLoading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="flash-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Challenges Available</Text>
              <Text style={styles.emptyText}>Check back later for new daily challenges</Text>
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
  topBarTitle: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.text, textAlign: 'center' },
  summaryCard: {
    marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#F59E0B20',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  summaryDivider: { width: 1, height: 36, backgroundColor: Colors.surfaceBorder },
  challengeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 10, gap: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  challengeCardReady: { borderColor: '#F59E0B40' },
  challengeCardClaimed: { borderColor: Colors.success + '30', opacity: 0.75 },
  challengeIconWrap: {
    width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  challengeContent: { flex: 1, gap: 4 },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  challengeName: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  xpBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F59E0B15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  xpText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#F59E0B' },
  challengeDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  progressBarBg: { flex: 1, height: 6, backgroundColor: Colors.surfaceLight, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.textSecondary, minWidth: 36, textAlign: 'right' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  timerText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted },
  claimBtn: {
    backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
  },
  claimBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
});
