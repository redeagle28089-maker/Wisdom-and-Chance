import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBg}>
          <Ionicons name={icon as any} size={18} color={Colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function RuleCard({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.ruleCard}>
      <Text style={styles.ruleCardTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.ruleItem}>
          <View style={styles.ruleBullet} />
          <Text style={styles.ruleText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function PhaseCard({ phase, title, description, color }: { phase: string; title: string; description: string; color: string }) {
  return (
    <View style={styles.phaseCard}>
      <View style={[styles.phaseNum, { backgroundColor: color + '20' }]}>
        <Text style={[styles.phaseNumText, { color }]}>{phase}</Text>
      </View>
      <View style={styles.phaseInfo}>
        <Text style={styles.phaseTitle}>{title}</Text>
        <Text style={styles.phaseDesc}>{description}</Text>
      </View>
    </View>
  );
}

function ElementInfo({ name, color, icon, description }: { name: string; color: string; icon: string; description: string }) {
  return (
    <View style={styles.elementRow}>
      <View style={[styles.elementIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={styles.elementInfo}>
        <Text style={[styles.elementName, { color }]}>{name}</Text>
        <Text style={styles.elementDesc}>{description}</Text>
      </View>
    </View>
  );
}

function TraitCard({ emoji, name, description }: { emoji: string; name: string; description: string }) {
  return (
    <View style={styles.traitCard}>
      <Text style={styles.traitEmoji}>{emoji}</Text>
      <View style={styles.traitInfo}>
        <Text style={styles.traitName}>{name}</Text>
        <Text style={styles.traitDesc}>{description}</Text>
      </View>
    </View>
  );
}

export default function RulesScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Game Rules</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>Master the mechanics of Wisdom and Chance</Text>

        <Section title="Game Setup" icon="construct-outline">
          <RuleCard
            title="Deck Construction"
            items={[
              '40 unit cards total',
              'Exactly 4 cards of each power rank (1-10)',
              'Maximum 3 copies of any single card',
              '1 commander card (not in deck)',
            ]}
          />
          <RuleCard
            title="Starting Conditions"
            items={[
              'Both players start with 40 HP',
              'Draw 5 cards to start',
              'Shuffle your 40-card deck',
              'Commander is placed in the command zone',
            ]}
          />
        </Section>

        <Section title="Turn Phases" icon="sync-outline">
          <PhaseCard phase="1" title="Draw Phase" description="Draw 2 cards from your deck" color={Colors.water} />
          <PhaseCard phase="2" title="Deployment" description="Play up to 2 cards face-down on your battlefield, use deployment phase commander abilities" color={Colors.nature} />
          <PhaseCard phase="3" title="Combat Phase" description="Reveal and flip all deployed cards, use combat phase commander abilities" color={Colors.fire} />
          <PhaseCard phase="4" title="Calculation" description="Compare total power, loser takes damage, use calculation phase commander abilities" color={Colors.earth} />
          <PhaseCard phase="5" title="End Phase" description="Check win conditions and prepare for next turn" color={Colors.air} />
        </Section>

        <Section title="Elements" icon="color-palette-outline">
          <ElementInfo name="Fire" color={Colors.fire} icon="flame" description="Aggressive, damage-focused cards with high offensive power" />
          <ElementInfo name="Water" color={Colors.water} icon="water" description="Control and manipulation, drawing cards and managing resources" />
          <ElementInfo name="Earth" color={Colors.earth} icon="earth" description="Defense and durability, high resilience and protection" />
          <ElementInfo name="Air" color={Colors.air} icon="cloud" description="Speed and mobility, fast tactical plays" />
          <ElementInfo name="Nature" color={Colors.nature} icon="leaf" description="Growth and life, healing and regeneration" />
        </Section>

        <Section title="Card Mechanics" icon="document-text-outline">
          <RuleCard
            title="Power System"
            items={[
              'Base Power (Top Left): Card\'s inherent strength (1-10)',
              'Buff Modifier (Bottom Left): Bonus given to allied cards matching element',
              'Debuff Modifier (Bottom Right): Penalty applied to enemy cards matching element',
            ]}
          />
          <View style={styles.ruleCard}>
            <Text style={styles.ruleCardTitle}>Buff/Debuff Color System</Text>
            <View style={styles.colorRow}>
              <View style={[styles.colorDot, { backgroundColor: Colors.fire }]} />
              <Text style={styles.ruleText}>Red = Fire cards only</Text>
            </View>
            <View style={styles.colorRow}>
              <View style={[styles.colorDot, { backgroundColor: Colors.water }]} />
              <Text style={styles.ruleText}>Blue = Water cards only</Text>
            </View>
            <View style={styles.colorRow}>
              <View style={[styles.colorDot, { backgroundColor: Colors.earth }]} />
              <Text style={styles.ruleText}>Amber/Brown = Earth cards only</Text>
            </View>
            <View style={styles.colorRow}>
              <View style={[styles.colorDot, { backgroundColor: Colors.air }]} />
              <Text style={styles.ruleText}>Green = Air/Nature cards only</Text>
            </View>
            <View style={styles.colorRow}>
              <View style={[styles.colorDot, { backgroundColor: '#333' }]} />
              <Text style={styles.ruleText}>Black = Universal (affects ALL cards)</Text>
            </View>
          </View>
        </Section>

        <Section title="Card Traits" icon="flash-outline">
          <TraitCard emoji="⚡" name="Quick Strike" description="Deal immediate damage to opponent during deployment" />
          <TraitCard emoji="➕" name="Care Package" description="Draw additional cards when deployed" />
          <TraitCard emoji="💚" name="Restoration" description="Heal HP when deployed" />
          <TraitCard emoji="🛡️" name="Guardian" description="Provides shield that reduces incoming damage during calculation" />
        </Section>

        <Section title="Commander Abilities" icon="shield-outline">
          <RuleCard
            title="Ability Costs"
            items={[
              'Victory Costs: Earned by winning combat rounds — used for offensive abilities',
              'Withdrawal Costs: Earned by losing combat rounds — used for defensive abilities',
              'Each commander has 4-6 unique abilities with various effects',
            ]}
          />
        </Section>

        <Section title="Victory Conditions" icon="trophy-outline">
          <View style={styles.victoryCard}>
            <MaterialCommunityIcons name="sword-cross" size={24} color={Colors.fire} />
            <View style={styles.victoryInfo}>
              <Text style={styles.victoryTitle}>Win by Combat</Text>
              <Text style={styles.victoryDesc}>Reduce your opponent's HP to 0 through successful battles</Text>
            </View>
          </View>
          <View style={styles.victoryCard}>
            <MaterialCommunityIcons name="cards-outline" size={24} color={Colors.water} />
            <View style={styles.victoryInfo}>
              <Text style={styles.victoryTitle}>Win by Depletion</Text>
              <Text style={styles.victoryDesc}>If your opponent cannot draw cards when required, you win</Text>
            </View>
          </View>
        </Section>
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
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.textSecondary, marginBottom: 20, textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionIconBg: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text },
  ruleCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.surfaceBorder, gap: 8,
  },
  ruleCardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text, marginBottom: 4 },
  ruleItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ruleBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 6 },
  ruleText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  phaseCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  phaseNum: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  phaseNumText: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  phaseInfo: { flex: 1 },
  phaseTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  phaseDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  elementRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  elementIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  elementInfo: { flex: 1 },
  elementName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  elementDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  traitCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  traitEmoji: { fontSize: 28, width: 44, textAlign: 'center' },
  traitInfo: { flex: 1 },
  traitName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  traitDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  victoryCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16, marginBottom: 8, gap: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  victoryInfo: { flex: 1 },
  victoryTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  victoryDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
