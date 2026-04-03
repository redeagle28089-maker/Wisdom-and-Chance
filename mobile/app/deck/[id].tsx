import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator,
  Platform, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors, { getElementColor, getElementBg } from '@/constants/colors';
import { api, Card, Commander } from '@/lib/api';
import CardFrame from '@/components/CardFrame';
import CommanderFrame from '@/components/CommanderFrame';

const ELEMENTS = ['all', 'fire', 'water', 'earth', 'air', 'nature'];

export default function EditDeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const [deckName, setDeckName] = useState('');
  const [selectedCommander, setSelectedCommander] = useState('');
  const [selectedCards, setSelectedCards] = useState<Record<string, number>>({});
  const [filterElement, setFilterElement] = useState('all');
  const [cardSearch, setCardSearch] = useState('');
  const [initialized, setInitialized] = useState(false);

  const deckQuery = useQuery({
    queryKey: ['deck', id],
    queryFn: () => api.getDeck(id!),
    enabled: !!id,
  });

  const cardsQuery = useQuery({ queryKey: ['cards'], queryFn: () => api.getCards() });
  const commandersQuery = useQuery({ queryKey: ['commanders'], queryFn: () => api.getCommanders() });

  useEffect(() => {
    if (deckQuery.data && !initialized) {
      setDeckName(deckQuery.data.name);
      setSelectedCommander(deckQuery.data.commanderId);
      const counts: Record<string, number> = {};
      deckQuery.data.cardIds.forEach(cid => {
        counts[cid] = (counts[cid] || 0) + 1;
      });
      setSelectedCards(counts);
      setInitialized(true);
    }
  }, [deckQuery.data, initialized]);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; commanderId?: string; cardIds?: string[] }) =>
      api.updateDeck(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-decks'] });
      queryClient.invalidateQueries({ queryKey: ['deck', id] });
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
    if (currentCount > 0) {
      setSelectedCards(prev => {
        const newCount = prev[card.id] - 1;
        if (newCount <= 0) {
          const { [card.id]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [card.id]: newCount };
      });
    } else if (canAddCard(card)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedCards(prev => ({ ...prev, [card.id]: 1 }));
    }
  }

  function addCard(card: Card) {
    if (canAddCard(card)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedCards(prev => ({ ...prev, [card.id]: (prev[card.id] || 0) + 1 }));
    }
  }

  function handleSave() {
    if (!deckName.trim()) {
      Alert.alert('Error', 'Please enter a deck name');
      return;
    }
    if (totalCards !== 40) {
      Alert.alert('Error', `Deck must have exactly 40 cards (currently ${totalCards})`);
      return;
    }

    const cardIds: string[] = [];
    Object.entries(selectedCards).forEach(([cardId, count]) => {
      for (let i = 0; i < count; i++) cardIds.push(cardId);
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateMutation.mutate({ name: deckName.trim(), commanderId: selectedCommander, cardIds });
  }

  const isLoading = deckQuery.isLoading || cardsQuery.isLoading || commandersQuery.isLoading;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color={Colors.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>Edit Deck</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  const commander = (commandersQuery.data ?? []).find(c => c.id === selectedCommander);

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Edit Deck</Text>
        <Pressable
          onPress={handleSave}
          disabled={updateMutation.isPending}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="checkmark-circle" size={28} color={totalCards === 40 ? Colors.success : Colors.textMuted} />
          )}
        </Pressable>
      </View>

      <View style={styles.nameRow}>
        <TextInput
          style={styles.deckNameInput}
          value={deckName}
          onChangeText={setDeckName}
          placeholder="Deck name..."
          placeholderTextColor={Colors.textMuted}
        />
        {commander && (
          <View style={styles.cmdrBadgeWrap}>
            <CommanderFrame commander={commander} size="sm" />
          </View>
        )}
      </View>

      <View style={styles.cardCounter}>
        <Text style={styles.counterText}>
          <Text style={[styles.counterNum, totalCards === 40 && { color: Colors.success }]}>{totalCards}</Text>/40 cards
        </Text>
        {totalCards === 40 && <Ionicons name="checkmark-circle" size={18} color={Colors.success} />}
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
        renderItem={({ item }) => {
          const count = selectedCards[item.id] || 0;
          return (
            <View style={styles.cardGridItem}>
              <CardFrame
                card={item}
                size="sm"
                count={count > 0 ? count : undefined}
                selected={count > 0}
                disabled={count === 0 && !canAddCard(item)}
                onPress={() => addCard(item)}
              />
              {count > 0 && (
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleCard(item);
                  }}
                >
                  <Ionicons name="remove-circle" size={18} color={Colors.error} />
                </Pressable>
              )}
            </View>
          );
        }}
        columnWrapperStyle={styles.cardGridRow}
        contentContainerStyle={{ paddingBottom: 120 + (Platform.OS === 'web' ? 34 : 0) }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!filteredCards.length}
      />

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 12 }]}>
        <Pressable
          style={({ pressed }) => [styles.saveButton, totalCards !== 40 && styles.saveButtonDisabled, pressed && { opacity: 0.85 }]}
          onPress={handleSave}
          disabled={totalCards !== 40 || updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </Pressable>
      </View>
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
  nameRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, marginBottom: 10,
  },
  deckNameInput: {
    flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text,
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  cmdrBadgeWrap: {
    borderRadius: 8, overflow: 'hidden',
  },
  cardCounter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 8, marginHorizontal: 16, backgroundColor: Colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.surfaceBorder, marginBottom: 8,
  },
  counterText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.textSecondary },
  counterNum: { fontFamily: 'Inter_700Bold', color: Colors.primary },
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
    justifyContent: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 10,
  },
  cardGridItem: {
    alignItems: 'center', position: 'relative' as const,
  },
  removeBtn: {
    position: 'absolute' as const,
    top: -4,
    left: -4,
    zIndex: 10,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.success, borderRadius: 12, paddingVertical: 14,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
});
