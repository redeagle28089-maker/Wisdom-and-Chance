import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors, { getElementColor } from '@/constants/colors';
import { api, Card, Commander } from '@/lib/api';
import CardFrame from '@/components/CardFrame';
import CommanderFrame from '@/components/CommanderFrame';

const ELEMENTS = ['all', 'fire', 'water', 'earth', 'air', 'nature'];
const POWERS = ['all', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const CARD_COLUMNS = 3;
const COMMANDER_COLUMNS = 2;

const screenWidth = Dimensions.get('window').width;
const cardGridPadding = 16;
const cardGap = 8;
const cardItemWidth = (screenWidth - cardGridPadding * 2 - cardGap * (CARD_COLUMNS - 1)) / CARD_COLUMNS;
const commanderItemWidth = (screenWidth - cardGridPadding * 2 - cardGap * (COMMANDER_COLUMNS - 1)) / COMMANDER_COLUMNS;

function CardGridItem({ card }: { card: Card }) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/card/[id]', params: { id: card.id } });
  }, [card.id]);

  return (
    <View style={[gridStyles.cardCell, { width: cardItemWidth }]}>
      <CardFrame
        card={card}
        size="md"
        onPress={handlePress}
      />
    </View>
  );
}

function CommanderGridItem({ commander }: { commander: Commander }) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/commander/[id]', params: { id: commander.id } });
  }, [commander.id]);

  return (
    <View style={[gridStyles.commanderCell, { width: commanderItemWidth }]}>
      <CommanderFrame
        commander={commander}
        size="md"
        onPress={handlePress}
      />
    </View>
  );
}

export default function CardsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ element?: string }>();
  const [selectedElement, setSelectedElement] = useState(params.element || 'all');
  const [selectedPower, setSelectedPower] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'commanders'>('cards');
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const cardsQuery = useQuery({
    queryKey: ['cards'],
    queryFn: () => api.getCards(),
  });

  const commandersQuery = useQuery({
    queryKey: ['commanders'],
    queryFn: () => api.getCommanders(),
  });

  const filteredCards = useMemo(() => {
    if (!cardsQuery.data) return [];
    let cards = cardsQuery.data.filter(c => !c.isCommander);
    if (selectedElement !== 'all') {
      cards = cards.filter(c => c.element.toLowerCase() === selectedElement);
    }
    if (selectedPower !== 'all') {
      cards = cards.filter(c => c.power === parseInt(selectedPower));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      cards = cards.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.trait && c.trait.toLowerCase().includes(q)) ||
        c.description.toLowerCase().includes(q)
      );
    }
    cards.sort((a, b) => a.power - b.power || a.name.localeCompare(b.name));
    return cards;
  }, [cardsQuery.data, selectedElement, selectedPower, search]);

  const filteredCommanders = useMemo(() => {
    if (!commandersQuery.data) return [];
    let commanders = [...commandersQuery.data];
    if (selectedElement !== 'all') {
      commanders = commanders.filter(c => c.element.toLowerCase() === selectedElement);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      commanders = commanders.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    }
    return commanders;
  }, [commandersQuery.data, selectedElement, search]);

  const renderCardItem = useCallback(({ item }: { item: Card }) => (
    <CardGridItem card={item} />
  ), []);

  const renderCommanderItem = useCallback(({ item }: { item: Commander }) => (
    <CommanderGridItem commander={item} />
  ), []);

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Text style={styles.title}>{viewMode === 'cards' ? 'Card Database' : 'Commanders'}</Text>
        <Text style={styles.count}>
          {viewMode === 'cards' ? `${filteredCards.length} cards` : `${filteredCommanders.length} commanders`}
        </Text>
      </View>

      <View style={styles.viewToggle}>
        {(['cards', 'commanders'] as const).map((v) => (
          <Pressable
            key={v}
            style={[styles.viewToggleBtn, viewMode === v && styles.viewToggleBtnActive]}
            onPress={() => { Haptics.selectionAsync(); setViewMode(v); }}
          >
            <Text style={[styles.viewToggleText, viewMode === v && styles.viewToggleTextActive]}>
              {v === 'cards' ? 'Cards (200)' : 'Commanders (5)'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search cards..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.filterRow}>
        <FlatList
          data={ELEMENTS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const isActive = selectedElement === item;
            const elColor = item === 'all' ? Colors.primary : getElementColor(item);
            return (
              <Pressable
                style={[styles.filterChip, isActive && { backgroundColor: elColor + '25', borderColor: elColor }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedElement(item);
                }}
              >
                <Text style={[styles.filterChipText, isActive && { color: elColor }]}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {viewMode === 'cards' && (
        <View style={styles.filterRow}>
          <FlatList
            data={POWERS}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
            keyExtractor={(item) => 'p' + item}
            renderItem={({ item }) => {
              const isActive = selectedPower === item;
              return (
                <Pressable
                  style={[styles.powerChip, isActive && styles.powerChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedPower(item); }}
                >
                  <Text style={[styles.powerChipText, isActive && styles.powerChipTextActive]}>
                    {item === 'all' ? 'All Powers' : item}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {viewMode === 'cards' ? (
        cardsQuery.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : cardsQuery.isError ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle" size={40} color={Colors.error} />
            <Text style={styles.errorText}>Failed to load cards</Text>
            <Pressable style={styles.retryButton} onPress={() => cardsQuery.refetch()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            key="cards-grid"
            data={filteredCards}
            keyExtractor={(item) => item.id}
            renderItem={renderCardItem}
            numColumns={CARD_COLUMNS}
            columnWrapperStyle={gridStyles.cardRow}
            contentContainerStyle={{ paddingHorizontal: cardGridPadding, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!!filteredCards.length}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons name="search" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No cards found</Text>
              </View>
            }
          />
        )
      ) : (
        commandersQuery.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            key="commanders-grid"
            data={filteredCommanders}
            keyExtractor={(item) => item.id}
            renderItem={renderCommanderItem}
            numColumns={COMMANDER_COLUMNS}
            columnWrapperStyle={gridStyles.commanderRow}
            contentContainerStyle={{ paddingHorizontal: cardGridPadding, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!!(filteredCommanders.length)}
            ListEmptyComponent={
              <View style={styles.centered}>
                <MaterialCommunityIcons name="shield-crown-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No commanders found</Text>
              </View>
            }
          />
        )
      )}
    </View>
  );
}

const gridStyles = StyleSheet.create({
  cardRow: {
    gap: cardGap,
    marginBottom: cardGap,
  },
  commanderRow: {
    gap: cardGap,
    marginBottom: cardGap,
  },
  cardCell: {
    alignItems: 'center',
  },
  commanderCell: {
    alignItems: 'center',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  viewToggle: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
  viewToggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.surfaceBorder },
  viewToggleBtnActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  viewToggleText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  viewToggleTextActive: { color: Colors.primary },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.text },
  count: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },
  searchRow: { paddingHorizontal: 16, marginBottom: 12 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 12, paddingHorizontal: 14, height: 44, gap: 8,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.text },
  filterRow: { marginBottom: 8 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  filterChipText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary },
  powerChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, minWidth: 32, alignItems: 'center',
  },
  powerChipActive: { backgroundColor: Colors.warning + '25', borderColor: Colors.warning },
  powerChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  powerChipTextActive: { color: Colors.warning },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 60 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.error },
  emptyText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.textMuted },
  retryButton: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
});
