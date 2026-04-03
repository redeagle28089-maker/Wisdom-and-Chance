import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform, Alert,
  Modal, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors, { getElementColor } from '@/constants/colors';
import { api, SavedDeck, Commander } from '@/lib/api';
import CommanderFrame from '@/components/CommanderFrame';

function DeckCard({ deck, commanders, onDelete }: { deck: SavedDeck; commanders: Commander[]; onDelete: (id: string) => void }) {
  const commander = commanders.find(c => c.id === deck.commanderId);
  const elColor = commander ? getElementColor(commander.element) : Colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [styles.deckCard, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/deck/view', params: { deckId: deck.id } });
      }}
    >
      <View style={[styles.deckColorBar, { backgroundColor: elColor }]} />
      {commander && (
        <View style={styles.commanderFrameWrap}>
          <CommanderFrame commander={commander} size="sm" />
        </View>
      )}
      <View style={styles.deckContent}>
        <View style={styles.deckHeader}>
          <Text style={styles.deckName} numberOfLines={1}>{deck.name}</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('Delete Deck', `Delete "${deck.name}"?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(deck.id) },
              ]);
            }}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.deckMeta}>
          {commander && (
            <Text style={[styles.commanderLabel, { color: elColor }]}>{commander.name}</Text>
          )}
          <Text style={styles.deckCardCount}>{deck.cardIds.length}/40 cards</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function DecksScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [importVisible, setImportVisible] = useState(false);
  const [importCode, setImportCode] = useState('');

  const decksQuery = useQuery({
    queryKey: ['user-decks'],
    queryFn: () => api.getUserDecks(),
  });

  const commandersQuery = useQuery({
    queryKey: ['commanders'],
    queryFn: () => api.getCommanders(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDeck(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-decks'] });
    },
  });

  const importMutation = useMutation({
    mutationFn: (code: string) => api.importDeck(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-decks'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setImportVisible(false);
      setImportCode('');
      Alert.alert('Success', 'Deck imported successfully!');
    },
    onError: (err: Error) => {
      Alert.alert('Import Failed', err.message);
    },
  });

  const commanders = commandersQuery.data ?? [];
  const decks = decksQuery.data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <View>
          <Text style={styles.title}>My Decks</Text>
          <Text style={styles.subtitle}>{decks.length} deck{decks.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            testID="import-deck-button"
            accessibilityLabel="Import deck"
            style={({ pressed }) => [styles.importButton, pressed && { opacity: 0.8 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setImportVisible(true);
            }}
          >
            <Ionicons name="download-outline" size={20} color={Colors.primary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.aiButton, pressed && { opacity: 0.8 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/suggest');
            }}
          >
            <Ionicons name="sparkles" size={20} color={Colors.warning} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/deck/new');
            }}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      {decksQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : decksQuery.isError ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={40} color={Colors.error} />
          <Text style={styles.errorText}>Failed to load decks</Text>
          <Pressable style={styles.retryButton} onPress={() => decksQuery.refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DeckCard
              deck={item}
              commanders={commanders}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!decks.length}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons name="cards-playing-outline" size={48} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Decks Yet</Text>
              <Text style={styles.emptyText}>Build your first deck to start battling</Text>
              <Pressable
                style={({ pressed }) => [styles.emptyButton, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/deck/new')}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.emptyButtonText}>Create Deck</Text>
              </Pressable>
            </View>
          }
        />
      )}

      <Modal
        visible={importVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImportVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setImportVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Import Deck</Text>
                <Pressable onPress={() => setImportVisible(false)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={Colors.textMuted} />
                </Pressable>
              </View>
              <Text style={styles.modalDesc}>Paste a deck code to import it into your collection</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="Paste deck code here..."
                placeholderTextColor={Colors.textMuted}
                value={importCode}
                onChangeText={setImportCode}
                multiline
                numberOfLines={4}
                autoFocus
                textAlignVertical="top"
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalCancelBtn]}
                  onPress={() => { setImportVisible(false); setImportCode(''); }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalImportBtn, !importCode.trim() && { opacity: 0.4 }]}
                  onPress={() => { if (importCode.trim()) importMutation.mutate(importCode.trim()); }}
                  disabled={!importCode.trim() || importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color="#fff" />
                      <Text style={styles.modalImportText}>Import</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  importButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  aiButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.warning + '18', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.text },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  deckCard: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 14, marginBottom: 10,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  deckColorBar: { width: 4 },
  commanderFrameWrap: { paddingVertical: 8, paddingLeft: 10 },
  deckContent: { flex: 1, padding: 16, gap: 8 },
  deckHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deckName: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.text, flex: 1, marginRight: 8 },
  deckMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  commanderLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  deckCardCount: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.error },
  retryButton: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: Colors.text },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.textSecondary },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 24, width: '100%', maxWidth: 420,
    borderWidth: 1, borderColor: Colors.surfaceBorder, gap: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text },
  modalDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  codeInput: {
    fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.text,
    backgroundColor: Colors.background, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder, minHeight: 100,
  },
  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  modalCancelBtn: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
  },
  modalCancelText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary },
  modalImportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  modalImportText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
});
