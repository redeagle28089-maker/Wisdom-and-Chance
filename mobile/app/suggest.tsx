import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors, { getElementColor, getElementBg } from '@/constants/colors';
import { api, Card, Commander, DeckSuggestion } from '@/lib/api';

const ELEMENTS = ['fire', 'water', 'earth', 'air', 'nature'];

export default function SuggestScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<DeckSuggestion | null>(null);

  const cardsQuery = useQuery({ queryKey: ['cards'], queryFn: () => api.getCards() });
  const commandersQuery = useQuery({ queryKey: ['commanders'], queryFn: () => api.getCommanders() });

  const suggestMutation = useMutation({
    mutationFn: () => api.getDeckSuggestions(selectedElement ? { element: selectedElement } : undefined),
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuggestion(data);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!suggestion) throw new Error('No suggestion');
      return api.createDeck({
        name: suggestion.name,
        commanderId: suggestion.commanderId,
        cardIds: suggestion.cardIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-decks'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Deck Saved', 'The suggested deck has been saved to your collection!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const allCards = cardsQuery.data ?? [];
  const commanders = commandersQuery.data ?? [];

  const suggestionCommander = suggestion ? commanders.find(c => c.id === suggestion.commanderId) : null;
  const suggestionCards = suggestion ? suggestion.cardIds.map(id => allCards.find(c => c.id === id)).filter(Boolean) as Card[] : [];

  const elementCounts: Record<string, number> = {};
  suggestionCards.forEach(c => {
    elementCounts[c.element] = (elementCounts[c.element] || 0) + 1;
  });

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>AI Deck Suggestion</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {!suggestion ? (
          <View style={styles.setupSection}>
            <View style={styles.aiIcon}>
              <MaterialCommunityIcons name="robot" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.setupTitle}>Get AI Deck Suggestions</Text>
            <Text style={styles.setupText}>
              Choose an element focus (optional) and let our AI build you a competitive deck
            </Text>

            <Text style={styles.filterLabel}>Element Focus (Optional)</Text>
            <View style={styles.elementGrid}>
              {ELEMENTS.map((el) => {
                const isActive = selectedElement === el;
                const elColor = getElementColor(el);
                return (
                  <Pressable
                    key={el}
                    style={[styles.elementBtn, isActive && { backgroundColor: elColor + '25', borderColor: elColor }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedElement(isActive ? null : el);
                    }}
                  >
                    <Ionicons
                      name={el === 'fire' ? 'flame' : el === 'water' ? 'water' : el === 'earth' ? 'earth' : el === 'air' ? 'cloud' : 'leaf' as any}
                      size={22}
                      color={isActive ? elColor : Colors.textMuted}
                    />
                    <Text style={[styles.elementBtnText, isActive && { color: elColor }]}>
                      {el.charAt(0).toUpperCase() + el.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.85 }]}
              onPress={() => suggestMutation.mutate()}
              disabled={suggestMutation.isPending}
            >
              {suggestMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="auto-fix" size={20} color="#fff" />
                  <Text style={styles.generateBtnText}>Generate Deck</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.resultSection}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultName}>{suggestion.name}</Text>
              {suggestion.strategy && (
                <Text style={styles.strategyText}>{suggestion.strategy}</Text>
              )}
            </View>

            {suggestionCommander && (
              <View style={styles.commanderRow}>
                <View style={[styles.cmdrIcon, { backgroundColor: getElementBg(suggestionCommander.element) }]}>
                  <MaterialCommunityIcons name="shield-crown" size={22} color={getElementColor(suggestionCommander.element)} />
                </View>
                <View>
                  <Text style={styles.cmdrName}>{suggestionCommander.name}</Text>
                  <Text style={[styles.cmdrElement, { color: getElementColor(suggestionCommander.element) }]}>
                    {suggestionCommander.title}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.compositionRow}>
              {Object.entries(elementCounts).sort((a, b) => b[1] - a[1]).map(([el, count]) => (
                <View key={el} style={[styles.compItem, { backgroundColor: getElementBg(el) }]}>
                  <View style={[styles.compDot, { backgroundColor: getElementColor(el) }]} />
                  <Text style={[styles.compText, { color: getElementColor(el) }]}>{el} ({count})</Text>
                </View>
              ))}
            </View>

            <Text style={styles.cardListLabel}>{suggestionCards.length} Cards</Text>
            {suggestionCards.sort((a, b) => a.power - b.power).map((card, idx) => (
              <View key={`${card.id}-${idx}`} style={styles.miniCard}>
                <View style={[styles.miniPower, { backgroundColor: getElementBg(card.element) }]}>
                  <Text style={[styles.miniPowerText, { color: getElementColor(card.element) }]}>{card.power}</Text>
                </View>
                <Text style={styles.miniName} numberOfLines={1}>{card.name}</Text>
                <Text style={[styles.miniElement, { color: getElementColor(card.element) }]}>{card.element}</Text>
              </View>
            ))}

            <View style={styles.resultActions}>
              <Pressable
                style={({ pressed }) => [styles.tryAgainBtn, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  setSuggestion(null);
                  suggestMutation.mutate();
                }}
                disabled={suggestMutation.isPending}
              >
                <Ionicons name="refresh" size={18} color={Colors.primary} />
                <Text style={styles.tryAgainText}>Try Again</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
                onPress={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Deck</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
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
  setupSection: { paddingHorizontal: 20, paddingTop: 20, alignItems: 'center' },
  aiIcon: {
    width: 96, height: 96, borderRadius: 28, backgroundColor: Colors.primary + '18',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  setupTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colors.text, marginBottom: 8 },
  setupText: {
    fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: 28, maxWidth: 300,
  },
  filterLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text, alignSelf: 'flex-start', marginBottom: 12 },
  elementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28, width: '100%' },
  elementBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
    width: '47%',
  },
  elementBtnText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, width: '100%',
  },
  generateBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#fff' },
  resultSection: { paddingHorizontal: 20 },
  resultHeader: { marginBottom: 16 },
  resultName: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text, marginBottom: 4 },
  strategyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  commanderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  cmdrIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cmdrName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  cmdrElement: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  compositionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  compItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  compDot: { width: 6, height: 6, borderRadius: 3 },
  compText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  cardListLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text, marginBottom: 10 },
  miniCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 10, padding: 10, marginBottom: 4, gap: 10,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  miniPower: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  miniPowerText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  miniName: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.text },
  miniElement: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  resultActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  tryAgainBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: Colors.primary,
  },
  tryAgainText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.primary },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.success, borderRadius: 12, paddingVertical: 14,
  },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
});
