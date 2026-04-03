import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, RefreshControl, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { ELEMENT_CARD_ART } from '@/constants/card-art';
import { useAuth } from '@/lib/auth-context';
import { api, Commander } from '@/lib/api';
import CardFrame from '@/components/CardFrame';
import CommanderFrame from '@/components/CommanderFrame';

function ChallengeCard({ challenge }: { challenge: any }) {
  const progress = challenge.progress ?? 0;
  const target = challenge.requirement ?? challenge.target ?? 1;
  const pct = Math.min((progress / target) * 100, 100);
  const isComplete = challenge.completed || progress >= target;

  return (
    <View style={styles.challengeCard}>
      <View style={[styles.challengeIcon, isComplete && { backgroundColor: Colors.success + '20' }]}>
        <Ionicons
          name={isComplete ? 'checkmark-circle' : 'flash' as any}
          size={20}
          color={isComplete ? Colors.success : Colors.warning}
        />
      </View>
      <View style={styles.challengeInfo}>
        <Text style={styles.challengeName} numberOfLines={1}>{challenge.name || challenge.description}</Text>
        <View style={styles.challengeBarBg}>
          <View style={[styles.challengeBarFill, { width: `${pct}%`, backgroundColor: isComplete ? Colors.success : Colors.primary }]} />
        </View>
      </View>
      <Text style={styles.challengeProgress}>{progress}/{target}</Text>
    </View>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBg, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color: string }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

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

  const decksQuery = useQuery({
    queryKey: ['user-decks'],
    queryFn: () => api.getUserDecks(),
    retry: false,
  });

  const commandersQuery = useQuery({
    queryKey: ['commanders'],
    queryFn: () => api.getCommanders(),
    retry: false,
  });

  const cardsQuery = useQuery({
    queryKey: ['cards'],
    queryFn: () => api.getCards(),
    retry: false,
  });

  const challengesQuery = useQuery({
    queryKey: ['daily-challenges'],
    queryFn: () => api.getDailyChallenges(),
    retry: false,
  });

  const playerChallengesQuery = useQuery({
    queryKey: ['player-challenges'],
    queryFn: () => api.getPlayerChallenges(),
    retry: false,
  });

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

  const rating = (ratingQuery.data as any)?.rating ?? 1000;
  const stats = statsQuery.data;
  const totalGames = (stats as any)?.totalGames ?? 0;
  const wins = (stats as any)?.wins ?? 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const deckCount = decksQuery.data?.length ?? 0;
  const commanders: Commander[] = commandersQuery.data ?? [];
  const allCards = cardsQuery.data ?? [];
  const featuredCards = allCards.slice(0, 6);
  const userDecks = decksQuery.data ?? [];

  const challenges = challengesQuery.data ?? [];
  const playerChallenges = playerChallengesQuery.data ?? [];
  const dailyChallenges = challenges.map((c: any) => {
    const pc = playerChallenges.find((p: any) => p.challengeId === c.id);
    return { ...c, progress: pc?.progress ?? 0, completed: pc?.completed ?? false };
  });

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user?.email?.split('@')[0] ?? 'Player';

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + webTopInset + 16, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              statsQuery.refetch();
              ratingQuery.refetch();
              decksQuery.refetch();
              commandersQuery.refetch();
              cardsQuery.refetch();
              challengesQuery.refetch();
              playerChallengesQuery.refetch();
            }}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.playerName}>{displayName}</Text>
          </View>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); logout(); router.replace('/'); }}
            style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <LinearGradient
          colors={[Colors.primaryDark + '60', Colors.primary + '30', 'transparent']}
          style={styles.ratingCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.ratingContent}>
            <View>
              <Text style={styles.ratingLabel}>ELO Rating</Text>
              <Text style={[styles.ratingValue, { color: getTierColor(rating) }]}>{rating}</Text>
            </View>
            <View style={styles.tierBadge}>
              <MaterialCommunityIcons name="shield-crown" size={28} color={getTierColor(rating)} />
              <Text style={[styles.tierName, { color: getTierColor(rating) }]}>{getTierName(rating)}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <StatCard label="Games" value={String(totalGames)} icon="game-controller" color={Colors.primary} />
          <StatCard label="Wins" value={String(wins)} icon="trophy" color={Colors.success} />
          <StatCard label="Win Rate" value={`${winRate}%`} icon="trending-up" color={Colors.water} />
          <StatCard label="Decks" value={String(deckCount)} icon="albums" color={Colors.nature} />
        </View>

        {userDecks.length > 0 && commanders.length > 0 && (
          <View style={styles.section}>
            <Pressable style={styles.sectionTitleRow} onPress={() => router.push('/(tabs)/decks')}>
              <Text style={styles.sectionTitle}>My Decks</Text>
              <View style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>See All</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
              </View>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckPreviewRow}>
              {userDecks.slice(0, 5).map((deck) => {
                const cmdr = commanders.find(c => c.id === deck.commanderId);
                if (!cmdr) return null;
                return (
                  <Pressable
                    key={deck.id}
                    style={({ pressed }) => [styles.deckPreviewItem, pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({ pathname: '/deck/view', params: { deckId: deck.id } });
                    }}
                  >
                    <CommanderFrame commander={cmdr} size="sm" />
                    <Text style={styles.deckPreviewName} numberOfLines={1}>{deck.name}</Text>
                    <Text style={styles.deckPreviewCount}>{deck.cardIds.length}/40</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {featuredCards.length > 0 && (
          <View style={styles.section}>
            <Pressable style={styles.sectionTitleRow} onPress={() => router.push('/(tabs)/cards')}>
              <Text style={styles.sectionTitle}>Featured Cards</Text>
              <View style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>Browse All</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
              </View>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredCardsRow}>
              {featuredCards.map((card) => (
                <Pressable
                  key={card.id}
                  style={({ pressed }) => [pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/card/[id]', params: { id: card.id } });
                  }}
                >
                  <CardFrame card={card} size="sm" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {dailyChallenges.length > 0 && (
          <View style={styles.section}>
            <Pressable
              style={styles.sectionTitleRow}
              onPress={() => router.push('/challenges')}
            >
              <Text style={styles.sectionTitle}>Daily Challenges</Text>
              <View style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>See All</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
              </View>
            </Pressable>
            {dailyChallenges.slice(0, 3).map((c: any, i: number) => (
              <ChallengeCard key={c.id || i} challenge={c} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsContainer}>
            <QuickAction icon="game-controller" label="Practice Battle" onPress={() => router.push('/practice')} color={Colors.fire} />
            <QuickAction icon="flash" label="Daily Challenges" onPress={() => router.push('/challenges')} color={Colors.warning} />
            <QuickAction icon="book-outline" label="Game Rules" onPress={() => router.push('/rules')} color={Colors.primary} />
            <QuickAction icon="school-outline" label="How to Play" onPress={() => router.push('/tutorial')} color={Colors.water} />
            <QuickAction icon="layers" label="Browse Cards" onPress={() => router.push('/(tabs)/cards')} color={Colors.water} />
            <QuickAction icon="add-circle" label="Build a Deck" onPress={() => router.push('/deck/new')} color={Colors.nature} />
            <QuickAction icon="sparkles" label="AI Deck Suggestion" onPress={() => router.push('/suggest')} color={Colors.warning} />
            <QuickAction icon="people" label="Game Rooms" onPress={() => router.push('/(tabs)/social')} color={Colors.fire} />
            <QuickAction icon="eye-outline" label="Live Matches" onPress={() => router.push('/live-matches')} color={Colors.success} />
            <QuickAction icon="time-outline" label="Game History" onPress={() => router.push('/history')} color={Colors.earth} />
            <QuickAction icon="bar-chart" label="Analytics" onPress={() => router.push('/analytics')} color={Colors.primary} />
            <QuickAction icon="library-outline" label="Lore Archives" onPress={() => router.push('/lore')} color={Colors.primaryLight} />
            <QuickAction icon="person-circle" label="Profile" onPress={() => router.push('/profile')} color={Colors.air} />
            <QuickAction icon="information-circle-outline" label="About" onPress={() => router.push('/about')} color={Colors.textSecondary} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Elements</Text>
          <View style={styles.elementsGrid}>
            {[
              { name: 'Fire', icon: 'flame', color: Colors.fire },
              { name: 'Water', icon: 'water', color: Colors.water },
              { name: 'Earth', icon: 'earth', color: Colors.earth },
              { name: 'Air', icon: 'cloud', color: Colors.air },
              { name: 'Nature', icon: 'leaf', color: Colors.nature },
            ].map((el) => (
              <Pressable
                key={el.name}
                style={({ pressed }) => [styles.elementCard, pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/(tabs)/cards', params: { element: el.name.toLowerCase() } }); }}
              >
                <View style={[styles.elementCardIcon, { backgroundColor: el.color + '20', overflow: 'hidden' }]}>
                  <Image
                    source={{ uri: ELEMENT_CARD_ART[el.name.toLowerCase()] }}
                    style={styles.elementArtImage}
                    resizeMode="cover"
                  />
                  <View style={[styles.elementArtOverlay, { backgroundColor: el.color + '40' }]}>
                    <Ionicons name={el.icon as any} size={20} color="#fff" />
                  </View>
                </View>
                <Text style={styles.elementCardName}>{el.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 20 },
  headerLeft: {},
  greeting: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.textSecondary },
  playerName: { fontFamily: 'Inter_700Bold', fontSize: 26, color: Colors.text, marginTop: 2 },
  logoutButton: { padding: 8, marginTop: 4 },
  ratingCard: { marginHorizontal: 20, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: Colors.surfaceBorder, marginBottom: 20 },
  ratingContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },
  ratingValue: { fontFamily: 'Inter_700Bold', fontSize: 36 },
  tierBadge: { alignItems: 'center', gap: 4 },
  tierName: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 28 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.surfaceBorder },
  statIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 18, color: Colors.text, marginBottom: 2 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textSecondary },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.primary },
  actionsContainer: { gap: 8 },
  quickAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.surfaceBorder },
  quickActionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  quickActionLabel: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.text },
  elementsGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  elementCard: { width: '18%', minWidth: 60, alignItems: 'center', gap: 6 },
  elementCardIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  elementArtImage: { position: 'absolute', width: '100%', height: '100%', resizeMode: 'cover' } as any,
  elementArtOverlay: { position: 'absolute', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' } as any,
  elementCardName: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.textSecondary },
  deckPreviewRow: { gap: 12, paddingRight: 20 },
  deckPreviewItem: { alignItems: 'center', gap: 6, width: 96 },
  deckPreviewName: { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.text, textAlign: 'center' },
  deckPreviewCount: { fontFamily: 'Inter_400Regular', fontSize: 10, color: Colors.textSecondary },
  featuredCardsRow: { gap: 10, paddingRight: 20 },
  challengeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  challengeIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.warning + '18', alignItems: 'center', justifyContent: 'center' },
  challengeInfo: { flex: 1, gap: 6 },
  challengeName: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text },
  challengeBarBg: { height: 4, backgroundColor: Colors.surfaceLight, borderRadius: 2, overflow: 'hidden' },
  challengeBarFill: { height: '100%', borderRadius: 2 },
  challengeProgress: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.textSecondary },
});
