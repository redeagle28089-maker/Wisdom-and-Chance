import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const STEPS = [
  {
    title: 'Build Your Deck',
    icon: 'albums',
    color: Colors.nature,
    content: [
      'Choose 1 Commander that leads your army.',
      'Select 40 cards from the 5 elements: Fire, Water, Earth, Air, and Nature.',
      'Each element has its own strengths — mix them or focus on one.',
      'Your deck has 4 cards at each power level from 1 to 10.',
    ],
  },
  {
    title: 'Starting the Game',
    icon: 'game-controller',
    color: Colors.water,
    content: [
      'Each player starts with 20 HP.',
      'You draw 5 cards at the start of the game.',
      'Each round, you draw 2 more cards.',
      'Deploy up to 2 cards face-down each round.',
    ],
  },
  {
    title: 'Combat & Traits',
    icon: 'flash',
    color: Colors.fire,
    content: [
      'After deployment, cards are revealed.',
      'Quick Strike cards deal immediate damage before power comparison.',
      'Total power is compared — the higher side wins the round.',
      'The loser takes damage equal to the power difference.',
      'Guardian cards block incoming damage.',
      'Restoration cards heal your HP.',
    ],
  },
  {
    title: 'Buffs & Debuffs',
    icon: 'trending-up',
    color: Colors.warning,
    content: [
      'Cards can buff your allied cards, increasing their power.',
      'Cards can debuff enemy cards, reducing their power.',
      'Buff/Debuff targets depend on the card\'s color alignment.',
      'Black-colored modifiers affect ALL cards of the target side.',
      'Element-colored modifiers only affect cards of that element.',
    ],
  },
  {
    title: 'Commander Abilities',
    icon: 'shield',
    color: Colors.primary,
    content: [
      'Your Commander has unique abilities you can use during the game.',
      'Abilities cost Victory Currency (earned by winning rounds) or Withdrawal Currency (earned by losing rounds).',
      'Effects include direct damage, healing, extra draws, buffs, and debuffs.',
      'Each ability can only be used once per game.',
      'Use them strategically at the right moment to turn the tide!',
    ],
  },
];

export default function TutorialScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>How to Play</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.stepIndicator}>
        {STEPS.map((_, i) => (
          <Pressable
            key={i}
            onPress={() => { Haptics.selectionAsync(); setCurrentStep(i); }}
            style={[styles.stepDot, i === currentStep && { backgroundColor: STEPS[currentStep].color, width: 24 }]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 + (Platform.OS === 'web' ? 34 : 0) }} showsVerticalScrollIndicator={false}>
        <View style={[styles.stepCard, { borderColor: STEPS[currentStep].color + '40' }]}>
          <View style={[styles.stepIconBg, { backgroundColor: STEPS[currentStep].color + '20' }]}>
            <Ionicons name={STEPS[currentStep].icon as any} size={32} color={STEPS[currentStep].color} />
          </View>
          <Text style={styles.stepNum}>Step {currentStep + 1} of {STEPS.length}</Text>
          <Text style={styles.stepTitle}>{STEPS[currentStep].title}</Text>

          {STEPS[currentStep].content.map((line, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.bullet, { backgroundColor: STEPS[currentStep].color }]} />
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}
        </View>

        <View style={styles.navRow}>
          <Pressable
            style={[styles.navBtn, currentStep === 0 && { opacity: 0.3 }]}
            disabled={currentStep === 0}
            onPress={() => { Haptics.selectionAsync(); setCurrentStep(c => c - 1); }}
          >
            <Ionicons name="arrow-back" size={18} color={Colors.text} />
            <Text style={styles.navBtnText}>Previous</Text>
          </Pressable>
          <Pressable
            style={[styles.navBtn, currentStep === STEPS.length - 1 && { opacity: 0.3 }]}
            disabled={currentStep === STEPS.length - 1}
            onPress={() => { Haptics.selectionAsync(); setCurrentStep(c => c + 1); }}
          >
            <Text style={styles.navBtnText}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.text} />
          </Pressable>
        </View>

        <Pressable
          style={styles.practiceBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/practice'); }}
        >
          <MaterialCommunityIcons name="sword-cross" size={20} color="#fff" />
          <Text style={styles.practiceBtnText}>Try a Practice Battle</Text>
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
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.surfaceLight },
  stepCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 24, gap: 16,
    borderWidth: 1, marginBottom: 20,
  },
  stepIconBg: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  stepNum: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  stepTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colors.text, textAlign: 'center' },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.textSecondary, flex: 1, lineHeight: 22 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface,
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  navBtnText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text },
  practiceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
  },
  practiceBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
});
