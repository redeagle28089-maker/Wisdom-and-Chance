import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator,
  Platform, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors, { getElementColor } from '@/constants/colors';
import { api, Card, Commander } from '@/lib/api';
import CardFrame from '@/components/CardFrame';
import CommanderFrame from '@/components/CommanderFrame';

const ELEMENTS = ['all', 'fire', 'water', 'earth', 'air', 'nature'];

export default function NewDeckScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const [step, setStep] = useState<'info' | 'commander' | 'cards'>('info');
  const [deckName, setDeckName] = useState('');
  const [selectedCommander, setSelectedCommander] = useState<string>('');
  const [selectedCards, setSelectedCards] = useState<Record<string, number>>({});
  const [filterElement, setFilterElement] = useState('all');
  const [cardSearch, setCardSearch] = useState('');

  const cardsQuery = useQuery({ queryKey: ['cards'], queryFn: () => api.getCards() });
  const commandersQuery = useQuery({ queryKey: ['commanders'], queryFn: () => api.getCommanders() });

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; commanderId: string; cardIds: string[] }) => api.createDeck(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-decks'] });
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const allCards = useMemo(() => {
    if (!cardsQuery.data) return [];
    return cardsQuery.data.filter(c => !c.isCommander);
  }, [cardsQuery.data]);

  const filteredCards = useMemo(() => {
    let cards = allCards;
    if (filterElement !== 'all') {
      cards = cards.filter(c => c.element.toLowerCase() === filterElement);
    }
    if (cardSearch.trim()) {
      const q = cardSearch.toLowerCase();
      cards = cards.filter(c => c.name.toLowerCase().includes(q));
    }
    cards.sort((a, b) => a.power - b.power || a.name.localeCompare(b.name));
    return cards;
  }, [allCards, filterElement, cardSearch]);

  const totalCards = Object.values(selectedCards).reduce((sum, n) => sum + n, 0);

  const powerRankCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    Object.entries(selectedCards).forEach(([cardId, count]) => {
      const card = allCards.find(c => c.id === cardId);
      if (card) {
        counts[card.power] = (counts[card.power] || 0) + count;
      }
    });
    return counts;
  }, [selectedCards, allCards]);

  function canAddCard(card: Card): boolean {
    const currentCount = selectedCards[card.id] || 0;
    if (currentCount >= 3) return false;
    if (totalCards >= 40) return false;
    const rankCount = powerRankCounts[card.power] || 0;
    if (rankCount >= 4) return false;
    return true;
  }

  function toggleCard(card: Card) {
    const currentCount = selectedCards[card.id] || 0;
    if (currentCount > 0 && !canAddCard(card)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedCards(prev => {
        const { [card.id]: _, ...rest } = prev;
        return rest;
      });
    } else if (canAddCard(card)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedCards(prev => ({ ...prev, [card.id]: (prev[card.id] || 0) + 1 }));
    }
  }

  function handleSave() {
    if (!deckName.trim()) {
      Alert.alert('Error', 'Please enter a deck name');
      return;
    }
    if (!selectedCommander) {
      Alert.alert('Error', 'Please select a commander');
      return;
    }
    if (totalCards !== 40) {
      const missing: string[] = [];
      for (let r = 1; r <= 10; r++) {
        const count = powerRankCounts[r] || 0;
        if (count < 4) missing.push(`Power ${r}: ${count}/4`);
      }
      Alert.alert('Incomplete Deck', `Need exactly 40 cards (4 per power rank 1-10).\nCurrently: ${totalCards}/40\n\n${missing.length > 0 ? 'Missing:\n' + missing.join('\n') : ''}`);
      return;
    }

    const cardIds: string[] = [];
    Object.entries(selectedCards).forEach(([cardId, count]) => {
      for (let i = 0; i < count; i++) {
        cardIds.push(cardId);
      }
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveMutation.mutate({ name: deckName.trim(), commanderId: selectedCommander, cardIds });
  }

  const isLoading = cardsQuery.isLoading || commandersQuery.isLoading;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>
          {step === 'info' ? 'New Deck' : step === 'commander' ? 'Choose Commander' : 'Select Cards'}
        </Text>
        {step === 'cards' ? (
          <Pressable
            onPress={handleSave}
            disabled={saveMutation.isPending}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="checkmark-circle" size={28} color={totalCards === 40 ? Colors.success : Colors.textMuted} />
            )}
          </Pressable>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : step === 'info' ? (
        <View style={styles.stepContent}>
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Deck Name</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Enter deck name..."
              placeholderTextColor={Colors.textMuted}
              value={deckName}
              onChangeText={setDeckName}
              autoFocus
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.nextButton, !deckName.trim() && styles.nextButtonDisabled, pressed && { opacity: 0.85 }]}
            onPress={() => { if (deckName.trim()) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep('commander'); } }}
            disabled={!deckName.trim()}
          >
            <Text style={styles.nextButtonText}>Choose Commander</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        </View>
      ) : step === 'commander' ? (
        <View style={styles.stepContent}>
          <Text style={styles.stepDescription}>Your commander leads your deck and provides unique abilities</Text>
          <FlatList
            data={commandersQuery.data ?? []}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.commanderRow}
            contentContainerStyle={styles.commanderGrid}
            renderItem={({ item }) => (
              <View style={styles.commanderCell}>
                <CommanderFrame
                  commander={item}
                  size="sm"
                  selected={selectedCommander === item.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSelectedCommander(item.id);
                  }}
                />
              </View>
            )}
          />
          <View style={styles.bottomActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => setStep('info')}>
              <Ionicons name="arrow-back" size={18} color={Colors.text} />
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.nextButton, styles.nextButtonSmall, !selectedCommander && styles.nextButtonDisabled, pressed && { opacity: 0.85 }]}
              onPress={() => { if (selectedCommander) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep('cards'); } }}
              disabled={!selectedCommander}
            >
              <Text style={styles.nextButtonText}>Select Cards</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.cardCounter}>
            <Text style={styles.counterText}>
              <Text style={[styles.counterNum, totalCards === 40 && { color: Colors.success }]}>{totalCards}</Text>/40 cards
            </Text>
            {totalCards === 40 && <Ionicons name="checkmark-circle" size={18} color={Colors.success} />}
          </View>

          <View style={styles.rankBar}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(rank => {
              const count = powerRankCounts[rank] || 0;
              const full = count >= 4;
              return (
                <View key={rank} style={styles.rankItem}>
                  <View style={[styles.rankDot, full ? { backgroundColor: Colors.success } : count > 0 ? { backgroundColor: Colors.primary } : {}]}>
                    <Text style={[styles.rankDotText, (full || count > 0) && { color: '#fff' }]}>{rank}</Text>
                  </View>
                  <Text style={[styles.rankCount, full && { color: Colors.success }]}>{count}/4</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
              {ELEMENTS.map((el) => {
                const isActive = filterElement === el;
                const elColor = el === 'all' ? Colors.primary : getElementColor(el);
                return (
                  <Pressable
                    key={el}
                    style={[styles.filterChip, isActive && { backgroundColor: elColor + '25', borderColor: elColor }]}
                    onPress={() => { Haptics.selectionAsync(); setFilterElement(el); }}
                  >
                    <Text style={[styles.filterChipText, isActive && { color: elColor }]}>
                      {el.charAt(0).toUpperCase() + el.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor={Colors.textMuted}
                value={cardSearch}
                onChangeText={setCardSearch}
              />
            </View>
          </View>

          <FlatList
            data={filteredCards}
            keyExtractor={(item) => item.id}
            numColumns={3}
            columnWrapperStyle={styles.cardGridRow}
            contentContainerStyle={styles.cardGridContent}
            renderItem={({ item }) => {
              const count = selectedCards[item.id] || 0;
              return (
                <View style={styles.cardGridCell}>
                  <CardFrame
                    card={item}
                    size="sm"
                    count={count}
                    selected={count > 0}
                    disabled={count === 0 && !canAddCard(item)}
                    onPress={() => toggleCard(item)}
                  />
                </View>
              );
            }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!!filteredCards.length}
          />

          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 12 }]}>
            <Pressable style={styles.secondaryBtn} onPress={() => setStep('commander')}>
              <Ionicons name="arrow-back" size={18} color={Colors.text} />
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.saveButton, totalCards !== 40 && styles.saveButtonDisabled, pressed && { opacity: 0.85 }]}
              onPress={handleSave}
              disabled={totalCards !== 40 || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Deck</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stepContent: { flex: 1, paddingHorizontal: 20 },
  stepDescription: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.textSecondary, marginBottom: 16 },
  inputSection: { marginBottom: 28, marginTop: 20 },
  inputLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text, marginBottom: 8 },
  nameInput: {
    fontFamily: 'Inter_400Regular', fontSize: 18, color: Colors.text,
    backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  nextButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
  },
  nextButtonSmall: { flex: 1 },
  nextButtonDisabled: { opacity: 0.4 },
  nextButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#fff' },
  commanderRow: {
    justifyContent: 'center',
    gap: 16,
  },
  commanderGrid: {
    alignItems: 'center',
    paddingBottom: 100,
    paddingTop: 8,
    gap: 16,
  },
  commanderCell: {
    alignItems: 'center',
  },
  bottomActions: { flexDirection: 'row', gap: 12, paddingVertical: 16 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  secondaryBtnText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text },
  cardCounter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, marginHorizontal: 16, backgroundColor: Colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.surfaceBorder, marginBottom: 8,
  },
  counterText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.textSecondary },
  counterNum: { fontFamily: 'Inter_700Bold', color: Colors.primary },
  rankBar: {
    flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8, paddingVertical: 6,
    backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  rankItem: { alignItems: 'center', gap: 2 },
  rankDot: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
  },
  rankDotText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: Colors.textMuted },
  rankCount: { fontFamily: 'Inter_400Regular', fontSize: 9, color: Colors.textMuted },
  filterRow: { marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  filterChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  searchRow: { paddingHorizontal: 16, marginBottom: 8 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 10, paddingHorizontal: 12, height: 38, gap: 6,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.text },
  cardGridRow: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  cardGridContent: {
    paddingHorizontal: 16,
    paddingBottom: 140 + (Platform.OS === 'web' ? 34 : 0),
    gap: 8,
  },
  cardGridCell: {
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  saveButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.success, borderRadius: 12, paddingVertical: 14,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
});
