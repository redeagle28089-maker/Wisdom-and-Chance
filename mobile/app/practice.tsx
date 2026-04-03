import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors, { getElementColor, getElementBg } from '@/constants/colors';
import { api } from '@/lib/api';
import { AIDifficulty } from '@/lib/ai-player';

const DIFFICULTIES: { id: AIDifficulty; label: string; desc: string; icon: string; color: string }[] = [
  { id: 'easy', label: 'Easy', desc: 'AI plays random cards. Great for learning.', icon: 'happy-outline', color: Colors.success },
  { id: 'medium', label: 'Medium', desc: 'AI plays smarter cards and uses some abilities.', icon: 'fitness-outline', color: Colors.warning },
  { id: 'hard', label: 'Hard', desc: 'AI plays optimally with full ability usage.', icon: 'skull-outline', color: Colors.error },
];

type GameMode = '2' | '3';
const GAME_MODES: { id: GameMode; label: string; desc: string; icon: string; color: string }[] = [
  { id: '2', label: 'Standard (2/2)', desc: 'Draw 2 cards and deploy up to 2 per turn.', icon: 'layers-outline', color: Colors.primary },
  { id: '3', label: 'Extended (3/3)', desc: 'Draw 3 cards and deploy up to 3 per turn.', icon: 'copy-outline', color: Colors.warning },
];

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [gameMode, setGameMode] = useState<GameMode>('2');
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);

  const decksQuery = useQuery({
    queryKey: ['user-decks'],
    queryFn: () => api.getUserDecks(),
    retry: false,
  });

  const commandersQuery = useQuery({
    queryKey: ['commanders'],
    queryFn: () => api.getCommanders(),
  });

  const decks = decksQuery.data ?? [];
  const commanders = commandersQuery.data ?? [];

  const getCommanderName = (cid: string) => commanders.find(c => c.id === cid)?.name ?? 'Unknown';
  const getCommanderElement = (cid: string) => commanders.find(c => c.id === cid)?.element ?? 'fire';

  const canStart = selectedDeck !== null;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Practice Battle</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[Colors.primaryDark + '50', Colors.primary + '20', 'transparent']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <MaterialCommunityIcons name="sword-cross" size={40} color={Colors.primaryLight} />
          <Text style={styles.heroTitle}>Battle an AI Opponent</Text>
          <Text style={styles.heroDesc}>Choose your difficulty and deck, then fight!</Text>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Difficulty</Text>
        <View style={styles.diffGrid}>
          {DIFFICULTIES.map((d) => (
            <Pressable
              key={d.id}
              style={[styles.diffCard, difficulty === d.id && { borderColor: d.color, backgroundColor: d.color + '12' }]}
              onPress={() => { Haptics.selectionAsync(); setDifficulty(d.id); }}
            >
              <Ionicons name={d.icon as any} size={28} color={difficulty === d.id ? d.color : Colors.textMuted} />
              <Text style={[styles.diffLabel, difficulty === d.id && { color: d.color }]}>{d.label}</Text>
              <Text style={styles.diffDesc}>{d.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Game Mode</Text>
        <View style={styles.diffGrid}>
          {GAME_MODES.map((m) => (
            <Pressable
              key={m.id}
              style={[styles.diffCard, gameMode === m.id && { borderColor: m.color, backgroundColor: m.color + '12' }]}
              onPress={() => { Haptics.selectionAsync(); setGameMode(m.id); }}
            >
              <Ionicons name={m.icon as any} size={28} color={gameMode === m.id ? m.color : Colors.textMuted} />
              <Text style={[styles.diffLabel, gameMode === m.id && { color: m.color }]}>{m.label}</Text>
              <Text style={styles.diffDesc}>{m.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Select Your Deck</Text>
        {decksQuery.isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : decks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="albums-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No decks yet</Text>
            <Pressable style={styles.createBtn} onPress={() => router.push('/deck/new')}>
              <Text style={styles.createBtnText}>Build a Deck</Text>
            </Pressable>
          </View>
        ) : (
          decks.map((deck) => {
            const el = getCommanderElement(deck.commanderId);
            const elColor = getElementColor(el);
            const isSelected = selectedDeck === deck.id;
            return (
              <Pressable
                key={deck.id}
                style={[styles.deckItem, isSelected && { borderColor: elColor, backgroundColor: elColor + '10' }]}
                onPress={() => { Haptics.selectionAsync(); setSelectedDeck(deck.id); }}
              >
                <View style={[styles.deckIcon, { backgroundColor: getElementBg(el) }]}>
                  <MaterialCommunityIcons name="cards" size={20} color={elColor} />
                </View>
                <View style={styles.deckInfo}>
                  <Text style={styles.deckName}>{deck.name}</Text>
                  <Text style={styles.deckMeta}>{getCommanderName(deck.commanderId)} · {deck.cardIds.length} cards</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={elColor} />}
              </Pressable>
            );
          })
        )}

        <Pressable
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
          disabled={!canStart}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            router.push({ pathname: '/game/board', params: { deckId: selectedDeck!, difficulty, gameMode } });
          }}
        >
          <MaterialCommunityIcons name="sword-cross" size={22} color="#fff" />
          <Text style={styles.startBtnText}>Start Battle</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  backBtn: { padding: 6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text },
  heroCard: { borderRadius: 18, padding: 28, alignItems: 'center', gap: 10, marginBottom: 24, borderWidth: 1, borderColor: Colors.surfaceBorder },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  heroDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text, marginBottom: 12 },
  diffGrid: { gap: 10, marginBottom: 24 },
  diffCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  diffLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text, width: 70 },
  diffDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, flex: 1 },
  deckItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  deckIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deckInfo: { flex: 1, gap: 2 },
  deckName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  deckMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, marginTop: 24,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.textMuted },
  createBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  createBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
});
