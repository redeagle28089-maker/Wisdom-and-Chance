import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors, { getElementColor, getElementBg } from '@/constants/colors';
import { api, CommanderAbility } from '@/lib/api';
import CommanderFrame from '@/components/CommanderFrame';

function AbilityCard({ ability, elColor }: { ability: CommanderAbility; elColor: string }) {
  return (
    <View style={styles.abilityCard}>
      <View style={styles.abilityHeader}>
        <Text style={styles.abilityName}>{ability.name}</Text>
        <View style={[styles.phaseBadge, { backgroundColor: elColor + '20' }]}>
          <Text style={[styles.phaseText, { color: elColor }]}>{ability.phase}</Text>
        </View>
      </View>
      <Text style={styles.abilityDesc}>{ability.description}</Text>
      <View style={styles.costRow}>
        {ability.victoryCost > 0 && (
          <View style={styles.costItem}>
            <Ionicons name="arrow-up-circle" size={14} color={Colors.success} />
            <Text style={styles.costText}>{ability.victoryCost} Advance</Text>
          </View>
        )}
        {ability.withdrawalCost > 0 && (
          <View style={styles.costItem}>
            <Ionicons name="arrow-down-circle" size={14} color={Colors.error} />
            <Text style={styles.costText}>{ability.withdrawalCost} Defeat</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function CommanderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const commanderQuery = useQuery({
    queryKey: ['commander', id],
    queryFn: () => api.getCommander(id!),
    enabled: !!id,
  });

  const commander = commanderQuery.data;
  const elColor = commander ? getElementColor(commander.element) : Colors.primary;
  const elBg = commander ? getElementBg(commander.element) : 'transparent';

  if (commanderQuery.isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!commander) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors.background }]}>
        <Ionicons name="alert-circle" size={40} color={Colors.error} />
        <Text style={styles.errorText}>Commander not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Commander</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[elColor + '30', 'transparent']}
          style={styles.hero}
        >
          <CommanderFrame commander={commander} size="lg" />

          <Text style={styles.commanderName}>{commander.name}</Text>
          <Text style={styles.commanderTitle}>{commander.title}</Text>
          <View style={[styles.elementTag, { backgroundColor: elBg }]}>
            <Ionicons name={getElementIcon(commander.element) as any} size={16} color={elColor} />
            <Text style={[styles.elementTagText, { color: elColor }]}>{commander.element}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <Text style={styles.description}>{commander.description}</Text>

          <Text style={styles.sectionTitle}>Abilities ({commander.abilities.length})</Text>
          {commander.abilities.map((ability) => (
            <AbilityCard key={ability.id} ability={ability} elColor={elColor} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.error },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  topBarTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.text },
  hero: { alignItems: 'center', paddingVertical: 28, gap: 12 },
  commanderName: { fontFamily: 'Inter_700Bold', fontSize: 26, color: Colors.text, textAlign: 'center', marginTop: 4 },
  commanderTitle: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.textSecondary },
  elementTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
  },
  elementTagText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  body: { paddingHorizontal: 20 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 24 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text, marginBottom: 14 },
  abilityCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.surfaceBorder, gap: 8,
  },
  abilityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  abilityName: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text, flex: 1 },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  phaseText: { fontFamily: 'Inter_500Medium', fontSize: 12, textTransform: 'capitalize' },
  abilityDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  costRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  costItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  costText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.textMuted },
});
