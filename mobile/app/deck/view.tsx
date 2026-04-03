import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Colors, { getElementColor } from '@/constants/colors';
import { api, Card, Commander } from '@/lib/api';
import CardFrame from '@/components/CardFrame';
import CommanderFrame from '@/components/CommanderFrame';

export default function DeckViewScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [copied, setCopied] = useState(false);

  const deckQuery = useQuery({
    queryKey: ['deck', deckId],
    queryFn: () => api.getDeck(deckId!),
    enabled: !!deckId,
  });

  const exportMutation = useMutation({
    mutationFn: () => api.exportDeck(deckId!),
    onSuccess: async (data) => {
      try {
        await Clipboard.setStringAsync(data.code);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        Alert.alert('Deck Code', data.code);
      }
    },
    onError: (err: Error) => {
      Alert.alert('Export Failed', err.message);
    },
  });

  const cardsQuery = useQuery({ queryKey: ['cards'], queryFn: () => api.getCards() });
  const commandersQuery = useQuery({ queryKey: ['commanders'], queryFn: () => api.getCommanders() });

  const deck = deckQuery.data;
  const allCards = cardsQuery.data ?? [];
  const commanders = commandersQuery.data ?? [];

  const { deckCards, cardCounts, elementCounts, powerDistribution, commander } = useMemo(() => {
    if (!deck) return { deckCards: [] as Card[], cardCounts: {} as Record<string, number>, elementCounts: {} as Record<string, number>, powerDistribution: {} as Record<number, number>, commander: null as Commander | null };
    const cmd = commanders.find(c => c.id === deck.commanderId);
    const counts: Record<string, number> = {};
    const elCounts: Record<string, number> = {};
    const powDist: Record<number, number> = {};
    deck.cardIds.forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
      const card = allCards.find(c => c.id === id);
      if (card) {
        elCounts[card.element] = (elCounts[card.element] || 0) + 1;
        powDist[card.power] = (powDist[card.power] || 0) + 1;
      }
    });
    const uniqueCards: Card[] = [];
    const seen = new Set<string>();
    deck.cardIds.forEach(id => {
      if (!seen.has(id)) {
        seen.add(id);
        const card = allCards.find(c => c.id === id);
        if (card) uniqueCards.push(card);
      }
    });
    uniqueCards.sort((a, b) => a.power - b.power || a.name.localeCompare(b.name));
    return { deckCards: uniqueCards, cardCounts: counts, elementCounts: elCounts, powerDistribution: powDist, commander: cmd };
  }, [deck, allCards, commanders]);

  const isLoading = deckQuery.isLoading || cardsQuery.isLoading || commandersQuery.isLoading;
  const maxPowerCount = Math.max(...Object.values(powerDistribution), 1);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </View>
    );
  }

  if (!deck) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={40} color={Colors.error} />
          <Text style={styles.errorText}>Deck not found</Text>
        </View>
      </View>
    );
  }

  const elColor = commander ? getElementColor(commander.element) : Colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Deck Details</Text>
        <View style={styles.topBarActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              exportMutation.mutate();
            }}
            disabled={exportMutation.isPending}
            hitSlop={8}
          >
            {exportMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={22} color={copied ? Colors.success : Colors.primary} />
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/deck/[id]', params: { id: deck.id } });
            }}
          >
            <Ionicons name="pencil" size={22} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      {copied && (
        <View style={styles.copiedBanner}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.copiedText}>Deck code copied to clipboard!</Text>
        </View>
      )}

      <FlatList
        data={deckCards}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <Text style={styles.deckTitle}>{deck.name}</Text>

            {commander && (
              <View style={styles.commanderSection}>
                <CommanderFrame
                  commander={commander}
                  size="md"
                  onPress={() => router.push({ pathname: '/commander/[id]', params: { id: commander.id } })}
                />
              </View>
            )}

            <View style={styles.compositionSection}>
              <Text style={styles.sectionLabel}>Element Distribution</Text>
              <View style={styles.elementBars}>
                {Object.entries(elementCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([el, count]) => (
                    <View key={el} style={styles.elementBarRow}>
                      <View style={styles.elementBarLabel}>
                        <View style={[styles.elDot, { backgroundColor: getElementColor(el) }]} />
                        <Text style={styles.elName}>{el}</Text>
                      </View>
                      <View style={styles.barBg}>
                        <View style={[styles.barFill, {
                          width: `${(count / deck.cardIds.length) * 100}%`,
                          backgroundColor: getElementColor(el),
                        }]} />
                      </View>
                      <Text style={styles.barCount}>{count}</Text>
                    </View>
                  ))}
              </View>
            </View>

            <View style={styles.compositionSection}>
              <Text style={styles.sectionLabel}>Power Distribution</Text>
              <View style={styles.powerGrid}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(power => {
                  const count = powerDistribution[power] || 0;
                  const height = count > 0 ? (count / maxPowerCount) * 60 : 4;
                  return (
                    <View key={power} style={styles.powerCol}>
                      <View style={styles.powerBarContainer}>
                        <View style={[styles.powerBar, { height, backgroundColor: count > 0 ? Colors.primary : Colors.surfaceLight }]} />
                      </View>
                      <Text style={styles.powerLabel}>{power}</Text>
                      <Text style={styles.powerCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <Text style={styles.sectionLabel}>{deck.cardIds.length} Cards</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardGridItem}>
            <CardFrame
              card={item}
              size="sm"
              count={cardCounts[item.id]}
              onPress={() => router.push({ pathname: '/card/[id]', params: { id: item.id } })}
            />
          </View>
        )}
        columnWrapperStyle={styles.cardGridRow}
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 40 }}
        showsVerticalScrollIndicator={false}
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
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  copiedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 8, paddingVertical: 8,
    backgroundColor: Colors.success + '18', borderRadius: 10, borderWidth: 1, borderColor: Colors.success + '40',
  },
  copiedText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.success },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.error },
  headerSection: { paddingHorizontal: 16, marginBottom: 8 },
  deckTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colors.text, marginBottom: 14, textAlign: 'center' },
  commanderSection: {
    alignItems: 'center', marginBottom: 20,
  },
  compositionSection: { marginBottom: 20 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text, marginBottom: 12 },
  elementBars: { gap: 8 },
  elementBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  elementBarLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 70 },
  elDot: { width: 8, height: 8, borderRadius: 4 },
  elName: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary, textTransform: 'capitalize' },
  barBg: { flex: 1, height: 8, backgroundColor: Colors.surfaceLight, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.text, width: 24, textAlign: 'right' },
  powerGrid: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  powerCol: { flex: 1, alignItems: 'center', gap: 4 },
  powerBarContainer: { height: 64, justifyContent: 'flex-end' },
  powerBar: { width: 20, borderRadius: 4, minHeight: 4 },
  powerLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.textSecondary },
  powerCount: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: Colors.textMuted },
  cardGridRow: {
    justifyContent: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 10,
  },
  cardGridItem: {
    alignItems: 'center',
  },
});
