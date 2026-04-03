import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors, { getElementColor, getElementBg } from '@/constants/colors';
import { api } from '@/lib/api';

const TABS = ['world', 'elements', 'commanders', 'factions'] as const;
type LoreTab = typeof TABS[number];

const WORLD_LORE = [
  { title: 'The Fractured Realm', text: 'In the beginning, the world was one. A single harmonious plane where all elements coexisted in balance. But the Great Sundering shattered this unity, splitting the world into five elemental domains.' },
  { title: 'The Age of Commanders', text: 'From the chaos rose powerful beings — the Commanders. Each one attuned to a specific element, they gathered followers and built armies of elemental warriors. Their battles would shape the fate of the realm.' },
  { title: 'The Card Wars', text: 'Rather than total annihilation, the Commanders agreed to settle their disputes through ritualized combat — the Card Wars. Each commander fields a deck of 40 warriors, deploying them in strategic rounds of combat.' },
  { title: 'The Currency of Battle', text: 'Victory and defeat both hold value. Winning rounds earns Victory Currency to power offensive abilities, while losing rounds grants Withdrawal Currency for defensive powers. Every outcome matters.' },
];

const ELEMENT_LORE = [
  { element: 'fire', name: 'Fire', desc: 'The element of pure destruction and passion. Fire cards tend to have high power and Quick Strike abilities, dealing immediate damage before the main combat phase. Fire decks overwhelm opponents with sheer aggression.', traits: 'Quick Strike, High Power, Aggressive' },
  { element: 'water', name: 'Water', desc: 'The element of adaptability and flow. Water cards excel at buffing allies and debuffing enemies, shifting the balance of power. Water decks control the battlefield through manipulation.', traits: 'Buffs, Debuffs, Control' },
  { element: 'earth', name: 'Earth', desc: 'The element of resilience and stability. Earth cards feature Guardian abilities that block incoming damage, making earth decks incredibly durable and hard to defeat.', traits: 'Guardian, Defense, Endurance' },
  { element: 'air', name: 'Air', desc: 'The element of speed and cunning. Air cards feature Care Package abilities that draw extra cards, giving air decks more options and flexibility each round.', traits: 'Care Package, Card Draw, Versatility' },
  { element: 'nature', name: 'Nature', desc: 'The element of life and renewal. Nature cards have Restoration abilities that heal HP, keeping nature decks alive through sustained combat. They outlast opponents through attrition.', traits: 'Restoration, Healing, Sustain' },
];

const FACTION_LORE = [
  { name: 'The Ember Pact', element: 'fire', desc: 'A coalition of fire warriors who believe in overwhelming force. They strike first and ask questions never. Their motto: "From ashes, we rise."' },
  { name: 'The Tidal Council', element: 'water', desc: 'Strategic manipulators who control the flow of battle. They bend the rules of engagement, buffing allies and weakening foes with calculated precision.' },
  { name: 'The Stone Wardens', element: 'earth', desc: 'Unyielding defenders of the realm. They build walls of living stone, absorbing damage that would fell lesser warriors. Their patience is their greatest weapon.' },
  { name: 'The Zephyr Court', element: 'air', desc: 'Cunning tricksters who always have more cards up their sleeves. They draw from the winds of fortune, ensuring they always have the right answer at the right time.' },
  { name: 'The Verdant Circle', element: 'nature', desc: 'Healers and sustainers who outlast all opposition. They draw life from the world itself, regenerating from wounds that would be fatal to others.' },
];

export default function LoreScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [tab, setTab] = useState<LoreTab>('world');

  const commandersQuery = useQuery({
    queryKey: ['commanders'],
    queryFn: () => api.getCommanders(),
  });
  const commanders = commandersQuery.data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Lore Archives</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow} style={{ flexGrow: 0 }}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => { Haptics.selectionAsync(); setTab(t); }}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }} showsVerticalScrollIndicator={false}>
        {tab === 'world' && WORLD_LORE.map((entry, i) => (
          <View key={i} style={styles.loreCard}>
            <View style={styles.loreIconBg}>
              <MaterialCommunityIcons name="book-open-page-variant" size={20} color={Colors.primaryLight} />
            </View>
            <Text style={styles.loreTitle}>{entry.title}</Text>
            <Text style={styles.loreText}>{entry.text}</Text>
          </View>
        ))}

        {tab === 'elements' && ELEMENT_LORE.map((el, i) => {
          const color = getElementColor(el.element);
          return (
            <View key={i} style={[styles.loreCard, { borderColor: color + '30' }]}>
              <View style={[styles.loreIconBg, { backgroundColor: getElementBg(el.element) }]}>
                <Ionicons name={el.element === 'fire' ? 'flame' : el.element === 'water' ? 'water' : el.element === 'earth' ? 'earth' : el.element === 'air' ? 'cloud' : 'leaf'} size={22} color={color} />
              </View>
              <Text style={[styles.loreTitle, { color }]}>{el.name}</Text>
              <Text style={styles.loreText}>{el.desc}</Text>
              <View style={[styles.traitBadge, { backgroundColor: color + '15' }]}>
                <Text style={[styles.traitText, { color }]}>{el.traits}</Text>
              </View>
            </View>
          );
        })}

        {tab === 'commanders' && commanders.map((cmd) => {
          const color = getElementColor(cmd.element);
          return (
            <Pressable
              key={cmd.id}
              style={[styles.loreCard, { borderColor: color + '30' }]}
              onPress={() => router.push({ pathname: '/commander/[id]', params: { id: cmd.id } })}
            >
              <View style={[styles.loreIconBg, { backgroundColor: getElementBg(cmd.element) }]}>
                <MaterialCommunityIcons name="shield-crown" size={22} color={color} />
              </View>
              <Text style={[styles.loreTitle, { color }]}>{cmd.name}</Text>
              <Text style={styles.loreSubtitle}>{cmd.title}</Text>
              <Text style={styles.loreText}>{cmd.description}</Text>
              <Text style={styles.abilityLabel}>{cmd.abilities.length} abilities</Text>
            </Pressable>
          );
        })}

        {tab === 'factions' && FACTION_LORE.map((f, i) => {
          const color = getElementColor(f.element);
          return (
            <View key={i} style={[styles.loreCard, { borderColor: color + '30' }]}>
              <View style={[styles.loreIconBg, { backgroundColor: getElementBg(f.element) }]}>
                <MaterialCommunityIcons name="flag-variant" size={22} color={color} />
              </View>
              <Text style={[styles.loreTitle, { color }]}>{f.name}</Text>
              <Text style={styles.loreText}>{f.desc}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  backBtn: { padding: 6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text },
  tabRow: { paddingHorizontal: 16, gap: 8, marginBottom: 16, paddingVertical: 4 },
  tabBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder },
  tabBtnActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  tabBtnText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.primary },
  loreCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder, gap: 8,
  },
  loreIconBg: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  loreTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: Colors.text },
  loreSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary },
  loreText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  traitBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  traitText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  abilityLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.textMuted },
});
