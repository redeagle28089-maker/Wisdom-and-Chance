import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Colors, { getElementColor, getElementBg } from '@/constants/colors';
import { api } from '@/lib/api';
import CardFrame from '@/components/CardFrame';

const BUFF_COLOR_MAP: Record<string, string> = {
  Red: '#ef4444',
  Blue: '#3b82f6',
  Amber: '#f59e0b',
  Green: '#22c55e',
  Black: '#475569',
};

function getElementIcon(element: string): string {
  switch (element.toLowerCase()) {
    case 'fire': return 'flame';
    case 'water': return 'water';
    case 'earth': return 'earth';
    case 'air': return 'cloud';
    case 'nature': return 'leaf';
    default: return 'star';
  }
}

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const cardQuery = useQuery({
    queryKey: ['card', id],
    queryFn: () => api.getCard(id!),
    enabled: !!id,
  });

  const card = cardQuery.data;
  const elColor = card ? getElementColor(card.element) : Colors.primary;
  const elBg = card ? getElementBg(card.element) : 'transparent';

  if (cardQuery.isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!card) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors.background }]}>
        <Ionicons name="alert-circle" size={40} color={Colors.error} />
        <Text style={styles.errorText}>Card not found</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Card Details</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.cardFrameContainer}>
          <CardFrame card={card} size="xl" />
        </View>

        <View style={styles.body}>
          <Text style={styles.cardName}>{card.name}</Text>

          <View style={[styles.elementBadge, { backgroundColor: elBg }]}>
            <Ionicons name={getElementIcon(card.element) as any} size={16} color={elColor} />
            <Text style={[styles.elementBadgeText, { color: elColor }]}>{card.element}</Text>
          </View>

          <Text style={styles.description}>{card.description}</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Element</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.dotSmall, { backgroundColor: elColor }]} />
                <Text style={styles.statValue}>{card.element}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Power Rank</Text>
              <Text style={styles.statValue}>{card.power}</Text>
            </View>
            {card.trait && (
              <>
                <View style={styles.divider} />
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Trait</Text>
                  <Text style={styles.statValue}>{card.trait}{card.traitValue ? ` (${card.traitValue})` : ''}</Text>
                </View>
              </>
            )}
            <View style={styles.divider} />
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Buff</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {card.buffModifier > 0 ? (
                  <>
                    <View style={[styles.colorDot, { backgroundColor: BUFF_COLOR_MAP[card.buffColor ?? ''] ?? '#475569' }]} />
                    <Ionicons name="arrow-up" size={14} color={Colors.success} />
                    <Text style={[styles.statValue, { color: Colors.success }]}>+{card.buffModifier}</Text>
                    {card.buffColor && <Text style={styles.statMeta}>({card.buffColor})</Text>}
                  </>
                ) : (
                  <Text style={styles.statValueMuted}>None</Text>
                )}
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Debuff</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {card.debuffModifier > 0 ? (
                  <>
                    <View style={[styles.colorDot, { backgroundColor: BUFF_COLOR_MAP[card.debuffColor ?? ''] ?? '#475569' }]} />
                    <Ionicons name="arrow-down" size={14} color={Colors.error} />
                    <Text style={[styles.statValue, { color: Colors.error }]}>-{card.debuffModifier}</Text>
                    {card.debuffColor && <Text style={styles.statMeta}>({card.debuffColor})</Text>}
                  </>
                ) : (
                  <Text style={styles.statValueMuted}>None</Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.error },
  backBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  backBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  topBarTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.text },
  cardFrameContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  body: { paddingHorizontal: 20, paddingTop: 4 },
  cardName: {
    fontFamily: 'Inter_700Bold', fontSize: 26, color: Colors.text,
    textAlign: 'center', marginBottom: 10,
  },
  elementBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
    alignSelf: 'center', marginBottom: 16,
  },
  elementBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 16, color: Colors.textSecondary, lineHeight: 24, marginBottom: 24 },
  statsGrid: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.textSecondary },
  statValue: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  statValueMuted: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.textMuted },
  statMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textMuted },
  dotSmall: { width: 8, height: 8, borderRadius: 4 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: 1, backgroundColor: Colors.surfaceBorder },
});
