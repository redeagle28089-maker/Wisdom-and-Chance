import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>About</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[Colors.primaryDark + '60', Colors.primary + '30', 'transparent']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <MaterialCommunityIcons name="cards-playing-spade-multiple" size={48} color={Colors.primaryLight} />
          <Text style={styles.heroTitle}>Wisdom and Chance Mobile</Text>
          <Text style={styles.heroSubtitle}>Trading Card Game</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About the Game</Text>
          <Text style={styles.cardText}>
            Wisdom and Chance is a strategic trading card game where players build decks of 40 cards led by powerful Commanders. Combining elements of strategy, deck building, and tactical combat, the game offers deep gameplay with its unique buff/debuff system, multiple card traits, and commander abilities.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>The Creator</Text>
          <Text style={styles.cardText}>
            Built with passion for card games and strategic gameplay. Wisdom and Chance was designed to be accessible yet deep, rewarding both careful planning and bold plays.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Game Features</Text>
          {[
            '200 unique cards across 5 elements',
            '5 Commanders with unique abilities',
            'Strategic buff/debuff combat system',
            'Daily challenges and achievements',
            'ELO-based ranked matchmaking',
            'AI practice mode with 3 difficulties',
            'Deck building with AI suggestions',
            'Social features and friend system',
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={styles.linkBtn}
          onPress={() => Linking.openURL('https://wisdom-and-chance.replit.app')}
        >
          <Ionicons name="globe-outline" size={20} color={Colors.primary} />
          <Text style={styles.linkBtnText}>Visit Web Version</Text>
          <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  backBtn: { padding: 6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text },
  heroCard: {
    borderRadius: 18, padding: 32, alignItems: 'center', gap: 8, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.text },
  heroSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.textSecondary },
  version: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: Colors.surfaceBorder, gap: 10 },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.text },
  cardText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: Colors.primary + '40', marginBottom: 12,
  },
  linkBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.primary },
});
