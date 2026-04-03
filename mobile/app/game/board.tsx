import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView, ActivityIndicator, Alert, Image,
  Dimensions, Modal, FlatList, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { LinearGradient } from 'expo-linear-gradient';
import Colors, { getElementColor, getElementBg } from '@/constants/colors';
import { api, Card, Commander, CommanderAbility } from '@/lib/api';
import {
  GameState, GamePhase, DeployedCard, RoundResult, AbilityEffect, initializeGame, drawCards, deployCard, undeployCard,
  resolveCombat, nextRound, useCommanderAbility, GAME_CONSTANTS,
} from '@/lib/game-engine';
import { aiTurn, AIDifficulty } from '@/lib/ai-player';
import { getCardImageUrl } from '@/constants/card-art';
import AuthImage from '@/components/AuthImage';

const ELEMENT_ART: Record<string, string> = {
  fire: 'https://wisdom-and-chance.replit.app/assets/fire_element_card_art-CVY0E2Oz.png',
  water: 'https://wisdom-and-chance.replit.app/assets/water_element_card_art-1rT54hTT.png',
  earth: 'https://wisdom-and-chance.replit.app/assets/earth_element_card_art-DFKomA2g.png',
  air: 'https://wisdom-and-chance.replit.app/assets/air_element_card_art-CvArjYh_.png',
  nature: 'https://wisdom-and-chance.replit.app/assets/nature_element_card_art-BxKtqsEq.png',
};

const BUFF_DEBUFF_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  red: { bg: '#DC262640', text: '#FCA5A5', border: '#DC262680' },
  fire: { bg: '#DC262640', text: '#FCA5A5', border: '#DC262680' },
  blue: { bg: '#2563EB40', text: '#93C5FD', border: '#2563EB80' },
  water: { bg: '#2563EB40', text: '#93C5FD', border: '#2563EB80' },
  brown: { bg: '#92400E40', text: '#FCD34D', border: '#92400E80' },
  amber: { bg: '#92400E40', text: '#FCD34D', border: '#92400E80' },
  earth: { bg: '#92400E40', text: '#FCD34D', border: '#92400E80' },
  green: { bg: '#16A34A40', text: '#86EFAC', border: '#16A34A80' },
  air: { bg: '#64748B40', text: '#CBD5E1', border: '#64748B80' },
  nature: { bg: '#16A34A40', text: '#86EFAC', border: '#16A34A80' },
  'dark green': { bg: '#16A34A40', text: '#86EFAC', border: '#16A34A80' },
  black: { bg: '#1E293B', text: '#FFFFFF', border: '#475569' },
};

function getBuffDebuffStyle(color: string | null) {
  if (!color) return null;
  return BUFF_DEBUFF_COLORS[color.toLowerCase()] ?? null;
}

const ELEMENT_SOLID_BORDERS: Record<string, string> = {
  fire: '#EF444480',
  water: '#3B82F680',
  earth: '#A1620780',
  air: '#94A3B880',
  nature: '#22C55E80',
};

function safeHaptic(fn: () => void) { try { fn(); } catch {} }

function getPhaseColor(phase: GamePhase): string {
  if (phase === 'deployment' || phase === 'card_draw') return '#22C55E';
  if (phase === 'combat' || phase === 'quick_strike' || phase === 'power_calculation' || phase === 'guardian_block') return '#EF4444';
  if (phase === 'round_end' || phase === 'damage_resolution') return '#F59E0B';
  return '#64748B';
}

function getPhaseLabel(phase: GamePhase): string {
  if (phase === 'card_draw') return 'Draw';
  if (phase === 'deployment') return 'Deploy';
  if (phase === 'combat' || phase === 'quick_strike' || phase === 'power_calculation' || phase === 'guardian_block') return 'Combat';
  if (phase === 'healing') return 'Heal';
  if (phase === 'damage_resolution') return 'Damage';
  if (phase === 'round_end') return 'End';
  if (phase === 'game_over') return 'Over';
  return 'Setup';
}

function BattlefieldCard({ card, faceDown, onPress, isPlayer, canRemove, cardWidth = 56 }: {
  card: Card & { currentPower?: number; appliedBuffs?: number; appliedDebuffs?: number; faceDown?: boolean };
  faceDown?: boolean; onPress?: () => void; isPlayer?: boolean; canRemove?: boolean; cardWidth?: number;
}) {
  const elColor = getElementColor(card.element);
  const borderColor = ELEMENT_SOLID_BORDERS[card.element.toLowerCase()] ?? '#7C3AED80';
  const actualFaceDown = faceDown ?? card.faceDown;
  const fallbackArt = card.imageUrl || ELEMENT_ART[card.element.toLowerCase()];
  const s = cardWidth / 56;

  if (actualFaceDown) {
    return (
      <View style={[styles.bfCard, styles.bfCardFaceDown, { width: cardWidth }]}>
        <LinearGradient colors={['#581C87', '#1E293B']} style={styles.bfCardInner}>
          <MaterialCommunityIcons name="cards" size={Math.round(18 * s)} color="#7C3AED" />
        </LinearGradient>
      </View>
    );
  }

  const buffStyle = getBuffDebuffStyle(card.buffColor);
  const debuffStyle = getBuffDebuffStyle(card.debuffColor);

  return (
    <Pressable onPress={onPress} style={[styles.bfCard, { borderColor, width: cardWidth }]}>
      <View style={[styles.bfCardInner, { backgroundColor: '#0F172A' }]}>
        {card.id ? (
          <AuthImage uri={getCardImageUrl(card.id)} fallbackUri={fallbackArt} style={styles.bfCardArt} resizeMode="cover" />
        ) : fallbackArt ? (
          <Image source={{ uri: fallbackArt }} style={styles.bfCardArt} resizeMode="cover" />
        ) : null}
        <View style={[styles.bfCardArtOverlay, { backgroundColor: elColor + '10', pointerEvents: 'none' }]} />

        <View style={[styles.bfPowerBadge, { minWidth: Math.round(16 * s), height: Math.round(16 * s), paddingHorizontal: Math.round(3 * s) }]}>
          <Text style={[styles.bfPowerText, { fontSize: Math.round(10 * s) }]}>{card.currentPower ?? card.power}</Text>
        </View>

        <View style={[styles.bfTraitBadge, { height: Math.round(16 * s), paddingHorizontal: Math.round(2 * s) }, card.trait ? { backgroundColor: '#9333EA' } : { backgroundColor: '#334155' }]}>
          <Text style={[styles.bfTraitText, { fontSize: Math.round(8 * s) }, !card.trait && { color: '#94A3B8' }]}>
            {card.traitValue ?? 0}
          </Text>
          {card.trait && (
            <Text style={[styles.bfTraitLabel, { fontSize: Math.round(5 * s) }]} numberOfLines={1}>
              {card.trait === 'Quick Strike' ? 'QS' : card.trait === 'Care Package' ? 'CP' : card.trait === 'Guardian' ? 'GD' : card.trait === 'Restoration' ? 'RS' : card.trait?.charAt(0)}
            </Text>
          )}
        </View>

        <View style={[styles.bfBuffBadge, { width: Math.round(18 * s), height: Math.round(14 * s), bottom: Math.round(14 * s) }, card.buffModifier > 0 && buffStyle ? { backgroundColor: buffStyle.bg, borderColor: buffStyle.border } : { backgroundColor: '#334155', borderColor: '#47556950' }]}>
          <Text style={[styles.bfModText, { fontSize: Math.round(7 * s) }, card.buffModifier > 0 ? { color: '#fff' } : { color: '#94A3B8' }]}>
            +{card.buffModifier}
          </Text>
        </View>

        <View style={[styles.bfDebuffBadge, { width: Math.round(18 * s), height: Math.round(14 * s), bottom: Math.round(14 * s) }, card.debuffModifier > 0 && debuffStyle ? { backgroundColor: debuffStyle.bg, borderColor: debuffStyle.border } : { backgroundColor: '#334155', borderColor: '#47556950' }]}>
          <Text style={[styles.bfModText, { fontSize: Math.round(7 * s) }, card.debuffModifier > 0 ? { color: '#fff' } : { color: '#94A3B8' }]}>
            -{card.debuffModifier}
          </Text>
        </View>

        <View style={[styles.bfCardNameBar, { height: Math.round(13 * s) }]}>
          <Text style={[styles.bfCardName, { fontSize: Math.round(6 * s) }]} numberOfLines={1}>{card.name}</Text>
        </View>

        {canRemove && (
          <View style={styles.bfRemoveBadge}>
            <Ionicons name="close" size={Math.round(10 * s)} color="#EF4444" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function HandCardComponent({ card, onPress, onHoldPreview, selected, cardWidth = 52 }: {
  card: Card & { currentPower?: number }; onPress?: () => void; onHoldPreview?: () => void; selected?: boolean; cardWidth?: number;
}) {
  const elColor = getElementColor(card.element);
  const borderColor = selected ? '#7C3AED' : (ELEMENT_SOLID_BORDERS[card.element.toLowerCase()] ?? '#7C3AED80');
  const fallbackHandArt = card.imageUrl || ELEMENT_ART[card.element.toLowerCase()];
  const buffStyle = getBuffDebuffStyle(card.buffColor);
  const debuffStyle = getBuffDebuffStyle(card.debuffColor);
  const s = cardWidth / 52;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onHoldPreview}
      delayLongPress={500}
      pressRetentionOffset={{ top: 50, bottom: 50, left: 50, right: 50 }}
      style={[styles.handCard, { borderColor, width: cardWidth }, selected && styles.handCardSelected]}
    >
      {card.id ? (
        <AuthImage uri={getCardImageUrl(card.id)} fallbackUri={fallbackHandArt} style={styles.handCardArt} resizeMode="cover" />
      ) : fallbackHandArt ? (
        <Image source={{ uri: fallbackHandArt }} style={styles.handCardArt} resizeMode="cover" />
      ) : null}
      <View style={[styles.handCardOverlay, { backgroundColor: elColor + '08', pointerEvents: 'none' }]} />

      <View style={[styles.handPowerBadge, { minWidth: Math.round(14 * s), height: Math.round(14 * s) }]}>
        <Text style={[styles.handPowerText, { fontSize: Math.round(9 * s) }]}>{card.currentPower ?? card.power}</Text>
      </View>

      <View style={[styles.handTraitBadge, { height: Math.round(14 * s) }, card.trait ? { backgroundColor: '#9333EA' } : { backgroundColor: '#334155' }]}>
        <Text style={[styles.handTraitVal, { fontSize: Math.round(8 * s) }, !card.trait && { color: '#94A3B8' }]}>
          {card.traitValue ?? 0}
        </Text>
      </View>

      <View style={[styles.handBottomRow, { bottom: Math.round(13 * s) }]}>
        <View style={[styles.handModBox, { height: Math.round(12 * s) }, card.buffModifier > 0 && buffStyle ? { backgroundColor: buffStyle.bg } : { backgroundColor: '#33415580' }]}>
          <Text style={[styles.handModText, { fontSize: Math.round(7 * s) }, card.buffModifier > 0 ? { color: '#fff' } : { color: '#94A3B8' }]}>+{card.buffModifier}</Text>
        </View>
        <View style={[styles.handModBox, { height: Math.round(12 * s) }, card.debuffModifier > 0 && debuffStyle ? { backgroundColor: debuffStyle.bg } : { backgroundColor: '#33415580' }]}>
          <Text style={[styles.handModText, { fontSize: Math.round(7 * s) }, card.debuffModifier > 0 ? { color: '#fff' } : { color: '#94A3B8' }]}>-{card.debuffModifier}</Text>
        </View>
      </View>

      <View style={[styles.handCardNameWrap, { height: Math.round(12 * s) }]}>
        <Text style={[styles.handCardNameText, { fontSize: Math.round(5 * s) }]} numberOfLines={1}>{card.name}</Text>
      </View>
    </Pressable>
  );
}

function HPBar({ hp, max, isPlayer, label }: { hp: number; max: number; isPlayer: boolean; label: string }) {
  const pct = Math.max(0, (hp / max) * 100);
  const low = pct <= 25;
  const borderColor = isPlayer ? '#22C55E30' : '#EF444430';
  const barBg = isPlayer ? '#0F172ACC' : '#0F172A99';

  return (
    <View style={[styles.hpBarWrap, { borderColor, backgroundColor: barBg }]}>
      <View style={styles.hpBarInner}>
        <View style={[styles.hpBarFill, {
          width: `${pct}%`,
          backgroundColor: low ? '#EF4444' : isPlayer ? '#22C55E' : '#EF4444',
        }]} />
      </View>
      <Text style={[styles.hpLabel]}>{label}</Text>
      <Text style={[styles.hpValue, low && { color: '#EF4444' }]}>
        {hp}/{max}
      </Text>
    </View>
  );
}

function PhaseIndicator({ phase }: { phase: GamePhase }) {
  const phases: { id: GamePhase[]; label: string; color: string; icon: string }[] = [
    { id: ['card_draw'], label: 'Draw', color: '#3B82F6', icon: 'albums' },
    { id: ['deployment'], label: 'Deploy', color: '#22C55E', icon: 'layers' },
    { id: ['combat', 'quick_strike', 'power_calculation', 'guardian_block'], label: 'Combat', color: '#EF4444', icon: 'flash' },
    { id: ['healing', 'damage_resolution', 'round_end'], label: 'End', color: '#F59E0B', icon: 'flag' },
  ];

  return (
    <View style={styles.phaseRow}>
      {phases.map((p, i) => {
        const active = p.id.includes(phase);
        return (
          <View key={i} style={[styles.phaseDot, active && { backgroundColor: p.color + '30', borderColor: p.color + '60' }]}>
            <Ionicons name={p.icon as any} size={10} color={active ? p.color : '#475569'} />
          </View>
        );
      })}
    </View>
  );
}

function isAbilityUsableInPhase(abilityPhase: string, gamePhase: GamePhase): boolean {
  const phase = abilityPhase.toLowerCase();
  if (phase === 'deployment' || phase === 'deploy') return gamePhase === 'deployment' || gamePhase === 'card_draw';
  if (phase === 'combat') return gamePhase === 'combat' || gamePhase === 'power_calculation' || gamePhase === 'quick_strike' || gamePhase === 'guardian_block';
  if (phase === 'calculation' || phase === 'calc') return gamePhase === 'power_calculation' || gamePhase === 'combat';
  if (phase === 'draw') return gamePhase === 'card_draw';
  if (phase === 'end') return gamePhase === 'round_end' || gamePhase === 'damage_resolution';
  return gamePhase === 'deployment' || gamePhase === 'card_draw';
}

function getAbilityPhaseBg(phase: string): string {
  const p = phase.toLowerCase();
  if (p === 'deployment' || p === 'deploy') return '#16A34A';
  if (p === 'combat') return '#DC2626';
  if (p === 'draw') return '#2563EB';
  if (p === 'end') return '#D97706';
  return '#475569';
}

export default function GameBoardScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const params = useLocalSearchParams<{ deckId: string; difficulty: string; gameMode: string }>();
  const difficulty = (params.difficulty || 'medium') as AIDifficulty;
  const cardsPerTurn = params.gameMode === '3' ? 3 : 2;
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [handView, setHandView] = useState<'units' | 'abilities'>('units');
  const [showDialog, setShowDialog] = useState<'none' | 'log' | 'history' | 'cardPopup' | 'commanderInfo' | 'oppCommanderInfo'>('none');
  const [popupCard, setPopupCard] = useState<Card | null>(null);
  const [combatResult, setCombatResult] = useState<RoundResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [combatPhase, setCombatPhase] = useState<number>(-1);
  const [combatSteps, setCombatSteps] = useState<{ label: string; detail: string; icon: string; color: string }[]>([]);
  const [showGameOver, setShowGameOver] = useState(false);
  const [drawToast, setDrawToast] = useState<string | null>(null);
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const isNativeLandscape = Platform.OS !== 'web' || screenW > screenH;
  const needsWebRotation = Platform.OS === 'web' && screenW <= screenH;

  const effW = needsWebRotation ? screenH : screenW;
  const effH = needsWebRotation ? screenW : screenH;

  const safeT = Platform.OS === 'web' ? 4 : insets.top || 2;
  const safeB = Platform.OS === 'web' ? 4 : insets.bottom || 2;
  const safeL = Platform.OS === 'web' ? 4 : insets.left || 4;
  const safeR = Platform.OS === 'web' ? 4 : insets.right || 4;

  const contentW = effW - safeL - safeR;
  const contentH = effH - safeT - safeB;

  const headerH = 32;
  const oppHandRowH = 26;
  const centerStripH = 28;
  const bottomPanelH = 74;
  const containerGap = 2;
  const numGaps = 5;
  const fieldZoneBorderPad = 6;
  const fixedH = headerH + oppHandRowH + centerStripH + bottomPanelH + (containerGap * numGaps) + (fieldZoneBorderPad * 2);
  const fieldZoneH = Math.max(40, Math.floor((contentH - fixedH) / 2));

  const fieldHeaderH = 14;
  const fieldCardAreaH = fieldZoneH - fieldHeaderH - 4;
  const bfCardH = Math.max(30, fieldCardAreaH);
  const bfCardW = Math.round(bfCardH * 0.75);

  const handToggleRowH = 22;
  const handCardAreaH = bottomPanelH - handToggleRowH - 6;
  const handCardH = Math.max(24, handCardAreaH);
  const handCardW = Math.round(handCardH * 0.75);

  const oppHandCardH = oppHandRowH - 4;
  const oppHandCardW = Math.round(oppHandCardH * 0.7);

  useEffect(() => {
    let cancelled = false;
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
        .then(() => {
          if (cancelled) {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      if (Platform.OS !== 'web') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    };
  }, []);

  const deckQuery = useQuery({
    queryKey: ['deck', params.deckId],
    queryFn: () => api.getDeck(params.deckId),
    enabled: !!params.deckId,
  });
  const cardsQuery = useQuery({ queryKey: ['cards'], queryFn: () => api.getCards() });
  const commandersQuery = useQuery({ queryKey: ['commanders'], queryFn: () => api.getCommanders() });

  useEffect(() => {
    if (!deckQuery.data || !cardsQuery.data || !commandersQuery.data || game) return;
    const deck = deckQuery.data;
    const allCards = cardsQuery.data;
    const allCommanders = commandersQuery.data;

    const playerCards = deck.cardIds.map(id => allCards.find(c => c.id === id)).filter(Boolean) as Card[];
    const playerCommander = allCommanders.find(c => c.id === deck.commanderId);
    if (!playerCommander || playerCards.length < 10) return;

    const nonCommanderCards = allCards.filter(c => !c.isCommander);
    const aiCards: Card[] = [];
    for (let power = 1; power <= 10; power++) {
      const cardsAtPower = nonCommanderCards.filter(c => c.power === power);
      const shuffled = cardsAtPower.sort(() => Math.random() - 0.5);
      aiCards.push(...shuffled.slice(0, GAME_CONSTANTS.cardsPerPowerRank));
    }
    const aiCommanderIdx = Math.floor(Math.random() * allCommanders.length);
    const aiCommander = allCommanders[aiCommanderIdx];

    const initialState = initializeGame(playerCards, playerCommander, aiCards, aiCommander, { cardsDrawn: cardsPerTurn, cardsDeployed: cardsPerTurn });
    const withDraws = drawCards(drawCards(initialState, 'p1'), 'p2');
    setGame(withDraws);
  }, [deckQuery.data, cardsQuery.data, commandersQuery.data, cardsPerTurn]);

  const handleDeploy = useCallback((index: number) => {
    if (!game || (game.phase !== 'deployment' && game.phase !== 'card_draw') || isProcessing) return;
    if (game.player1.deployed.length >= game.cardsDeployedPerTurn) return;
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    const deployingCard = game.player1.hand[index];
    const isCarePackage = deployingCard?.trait === 'Care Package';
    const cpExtra = deployingCard?.traitValue || 1;
    setGame(prev => prev ? deployCard(prev, 'p1', index) : null);
    setSelectedHandIndex(null);
    if (isCarePackage) {
      setDrawToast(`Care Package: drawing ${cpExtra} extra card${cpExtra !== 1 ? 's' : ''}!`);
      setTimeout(() => { if (isMountedRef.current) setDrawToast(null); }, 2500);
    }
  }, [game, isProcessing]);

  const handleUndeploy = useCallback((index: number) => {
    if (!game || (game.phase !== 'deployment' && game.phase !== 'card_draw') || isProcessing) return;
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    setGame(prev => prev ? undeployCard(prev, 'p1', index) : null);
  }, [game, isProcessing]);

  const handleUseAbility = useCallback((abilityId: string) => {
    if (!game || isProcessing) return;
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    setGame(prev => prev ? useCommanderAbility(prev, 'p1', abilityId) : null);
  }, [game, isProcessing]);

  const handleEndDeployment = useCallback(async () => {
    if (!game || isProcessing) return;
    if (game.player1.deployed.length === 0) {
      Alert.alert('Deploy Cards', 'You must deploy at least 1 card before ending your turn.');
      return;
    }
    setIsProcessing(true);
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

    let state = { ...game };
    state = aiTurn(state, difficulty);
    state = { ...state, phase: 'combat' };
    setGame(state);

    const resolved = resolveCombat(state);
    const result = resolved.roundResults[resolved.roundResults.length - 1];

    const steps: typeof combatSteps = [];
    steps.push({ label: 'Reveal & Flip', detail: 'All cards revealed face-up', icon: 'eye', color: '#7C3AED' });
    const p1QS = state.player1.quickStrikeDamage;
    const p2QS = state.player2.quickStrikeDamage;
    if (p1QS > 0 || p2QS > 0) {
      steps.push({ label: 'Quick Strike', detail: `You: ${p1QS} dmg | Opp: ${p2QS} dmg`, icon: 'flash', color: '#EF4444' });
    }
    steps.push({ label: 'Power Calculation', detail: `You: ${result.p1Power} | Opp: ${result.p2Power}`, icon: 'calculator', color: '#3B82F6' });
    const p1Guard = state.player1.deployed.filter(c => c.trait === 'Guardian').reduce((s, c) => s + (c.traitValue || 3), 0);
    const p2Guard = state.player2.deployed.filter(c => c.trait === 'Guardian').reduce((s, c) => s + (c.traitValue || 3), 0);
    if (p1Guard > 0 || p2Guard > 0) {
      steps.push({ label: 'Guardian Block', detail: `You: ${p1Guard} | Opp: ${p2Guard}`, icon: 'shield', color: '#A16207' });
    }
    const p1Heal = state.player1.deployed.filter(c => c.trait === 'Restoration').reduce((s, c) => s + (c.traitValue || 2), 0);
    const p2Heal = state.player2.deployed.filter(c => c.trait === 'Restoration').reduce((s, c) => s + (c.traitValue || 2), 0);
    if (p1Heal > 0 || p2Heal > 0) {
      steps.push({ label: 'Healing', detail: `You: ${p1Heal} HP | Opp: ${p2Heal} HP`, icon: 'heart', color: '#22C55E' });
    }
    steps.push({
      label: 'Damage Resolution',
      detail: result.damage > 0
        ? `${result.winner === 'p1' ? 'Opponent' : 'You'} take${result.winner === 'p1' ? 's' : ''} ${result.damage} damage`
        : 'No damage — draw!',
      icon: 'flame',
      color: result.damage > 0 ? '#EF4444' : '#64748B',
    });

    if (!isMountedRef.current) return;
    setCombatSteps(steps);
    setCombatPhase(0);

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 700));
      if (!isMountedRef.current) return;
      setCombatPhase(i + 1);
      if (i < steps.length - 1) safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    }

    await new Promise(r => setTimeout(r, 500));
    if (!isMountedRef.current) return;
    safeHaptic(() => Haptics.notificationAsync(result.winner === 'p1' ? Haptics.NotificationFeedbackType.Success : result.winner === 'p2' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Warning));
    setCombatResult(result);
    setGame(resolved);
    setCombatPhase(-1);
    setCombatSteps([]);
    setIsProcessing(false);

    if (resolved.phase === 'game_over') {
      setTimeout(() => { if (isMountedRef.current) setShowGameOver(true); }, 400);
    }
  }, [game, difficulty, isProcessing]);

  const handleNextRound = useCallback(() => {
    if (!game) return;
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    setCombatResult(null);
    let state = nextRound(game);
    state = drawCards(state, 'p1');
    state = { ...state, phase: 'deployment' };
    setGame(state);
    setHandView('units');
  }, [game]);

  const handleNewGame = useCallback(() => {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    setGame(null);
    setCombatResult(null);
    setIsProcessing(false);
    setSelectedHandIndex(null);
    setCombatPhase(-1);
    setCombatSteps([]);
    setShowDialog('none');
    setShowGameOver(false);
    setHandView('units');
  }, []);

  const handleLeave = useCallback(() => {
    Alert.alert('Leave Battle', 'Are you sure you want to forfeit?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => { isMountedRef.current = false; setIsProcessing(false); router.back(); } },
    ]);
  }, []);

  if (!deckQuery.data || !cardsQuery.data || !commandersQuery.data || !game) {
    const loadingContent = (
      <LinearGradient colors={['#0F172A', '#1E1033', '#0F172A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={{ backgroundColor: '#7C3AED20', padding: 20, borderRadius: 16 }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
        <Text style={styles.loadingText}>Setting up battle...</Text>
      </LinearGradient>
    );
    if (needsWebRotation) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0F172A', overflow: 'hidden' }}>
          <View style={{ width: effW, height: effH, transform: [{ rotate: '90deg' }], position: 'absolute', top: (screenH - effH) / 2, left: (screenW - effW) / 2 }}>
            {loadingContent}
          </View>
        </View>
      );
    }
    return loadingContent;
  }

  const p1 = game.player1;
  const p2 = game.player2;
  const isDeployPhase = game.phase === 'deployment' || game.phase === 'card_draw';
  const isGameOver = game.phase === 'game_over';
  const isRoundEnd = game.phase === 'round_end';

  const cmdElColor1 = getElementColor(p1.commander.element);
  const cmdElColor2 = getElementColor(p2.commander.element);

  const gameContent = (
    <LinearGradient
      colors={['#0F172A', '#1E1033', '#0F172A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingLeft: safeL, paddingRight: safeR, paddingTop: safeT, paddingBottom: safeB }]}
    >
      {/* === HEADER BAR (full width) === */}
      <View style={[styles.header, { height: headerH }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={handleLeave} hitSlop={8} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={14} color="#E2E8F0" />
          </Pressable>
          <Pressable style={styles.cmdAvatar} onPress={() => setShowDialog('commanderInfo')}>
            <LinearGradient colors={['#7C3AED', '#EC4899']} style={styles.cmdAvatarInner}>
              <MaterialCommunityIcons name="shield-crown" size={14} color="#fff" />
            </LinearGradient>
          </Pressable>
          <View>
            <Text style={styles.headerPlayerName} numberOfLines={1}>{p1.commander.name}</Text>
            <Text style={styles.headerPlayerTitle} numberOfLines={1}>{p1.commander.title}</Text>
          </View>
        </View>

        <View style={styles.headerCenter}>
          <View style={styles.roundPhaseRow}>
            <View style={styles.roundBadge}>
              <Text style={styles.roundText}>Round {game.round}</Text>
            </View>
            <PhaseIndicator phase={game.phase} />
            <View style={[styles.phaseLabelBadge, { backgroundColor: getPhaseColor(game.phase) + 'CC' }]}>
              <Text style={styles.phaseLabelText}>{getPhaseLabel(game.phase)}</Text>
            </View>
          </View>
          <View style={styles.hpSection}>
            <HPBar hp={p2.hp} max={GAME_CONSTANTS.initialHP} isPlayer={false} label="Opp" />
            <HPBar hp={p1.hp} max={GAME_CONSTANTS.initialHP} isPlayer={true} label="You" />
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.currencyCol}>
            <View style={styles.currencyBadge}>
              <Ionicons name="star" size={9} color="#F59E0B" />
              <Text style={styles.currencyText}>{p1.victoryCurrency}</Text>
            </View>
            <View style={styles.currencyBadge}>
              <Ionicons name="shield" size={9} color="#94A3B8" />
              <Text style={styles.currencyText}>{p1.withdrawalCurrency}</Text>
            </View>
          </View>
          <View style={styles.headerBtns}>
            <Pressable onPress={() => setShowDialog(showDialog === 'history' ? 'none' : 'history')} hitSlop={8} style={[styles.headerLogBtn, showDialog === 'history' && styles.headerLogBtnActive]}>
              <Ionicons name="time-outline" size={12} color={showDialog === 'history' ? '#7C3AED' : '#94A3B8'} />
              <Text style={[styles.headerLogBtnText, showDialog === 'history' && { color: '#7C3AED' }]}>Hist</Text>
            </Pressable>
            <Pressable onPress={() => setShowDialog(showDialog === 'log' ? 'none' : 'log')} hitSlop={8} style={[styles.headerLogBtn, showDialog === 'log' && styles.headerLogBtnActive]}>
              <Ionicons name="document-text-outline" size={12} color={showDialog === 'log' ? '#7C3AED' : '#94A3B8'} />
              <Text style={[styles.headerLogBtnText, showDialog === 'log' && { color: '#7C3AED' }]}>Log</Text>
            </Pressable>
          </View>
          <Pressable style={styles.cmdAvatar} onPress={() => setShowDialog('oppCommanderInfo')}>
            <LinearGradient colors={[getElementColor(p2.commander.element), '#334155']} style={styles.cmdAvatarInner}>
              <MaterialCommunityIcons name="shield-crown" size={14} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {/* === OPPONENT HAND ROW === */}
      <View style={[styles.oppHandRow, { height: oppHandRowH }]}>
        <View style={styles.oppHandInfo}>
          <View style={[styles.zoneCmdDot, { backgroundColor: cmdElColor2 }]}>
            <MaterialCommunityIcons name="shield-crown" size={7} color="#fff" />
          </View>
          <Text style={styles.oppHandLabel} numberOfLines={1}>{p2.commander.name}</Text>
          <View style={styles.zoneCurrRow}>
            <View style={styles.zoneCurrBadge}>
              <Ionicons name="star" size={6} color="#F59E0B" />
              <Text style={styles.zoneCurrText}>{p2.victoryCurrency}</Text>
            </View>
            <View style={styles.zoneCurrBadge}>
              <Ionicons name="shield" size={6} color="#94A3B8" />
              <Text style={styles.zoneCurrText}>{p2.withdrawalCurrency}</Text>
            </View>
          </View>
          <Text style={styles.oppHandCount}>D:{p2.deck.length} H:{p2.hand.length}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.oppHandCards}>
          {p2.hand.map((c, i) => (
            <View key={'oh-' + i} style={[styles.oppHandCard, { width: oppHandCardW, height: oppHandCardH }]}>
              <LinearGradient colors={['#581C87', '#1E293B']} style={styles.oppHandCardInner}>
                <MaterialCommunityIcons name="cards" size={10} color="#7C3AED" />
              </LinearGradient>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* === OPPONENT FIELD === */}
      <View style={[styles.fieldZone, styles.opponentZone, { height: fieldZoneH }]}>
        <View style={styles.zoneHeader}>
          <Text style={styles.zoneLabel}>OPPONENT'S FIELD</Text>
          <Text style={styles.zoneCountText}>{p2.deployed.length} deployed</Text>
        </View>
        <View style={styles.zoneCards}>
          {p2.deployed.length === 0 ? (
            <Text style={styles.zoneEmptyText}>{isDeployPhase ? 'Opponent deploying...' : 'No cards'}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardScrollContent}>
              {p2.deployed.map((c, i) => (
                <BattlefieldCard key={c.id + '-o-' + i} card={c} faceDown={c.faceDown} isPlayer={false} cardWidth={bfCardW} onPress={!c.faceDown ? () => { setPopupCard(c); setShowDialog('cardPopup'); } : undefined} />
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      {/* === CENTER STRIP === */}
      <View style={[styles.centerStrip, { height: centerStripH }]}>
        {combatPhase >= 0 && combatSteps.length > 0 ? (
          <View style={styles.combatStepsRow}>
            {combatSteps.map((step, i) => (
              <View key={i} style={[styles.combatStep, i < combatPhase && { backgroundColor: step.color + '20', borderColor: step.color + '40' }]}>
                <Ionicons name={step.icon as any} size={8} color={i < combatPhase ? step.color : '#475569'} />
                <Text style={[styles.combatStepText, i < combatPhase && { color: step.color }]} numberOfLines={1}>
                  {step.label}
                </Text>
              </View>
            ))}
          </View>
        ) : combatResult && combatPhase < 0 && !isGameOver ? (
          <View style={styles.combatResultRow}>
            <View style={[styles.combatResultBanner, {
              backgroundColor: combatResult.winner === 'p1' ? '#22C55E20' : combatResult.winner === 'p2' ? '#EF444420' : '#F59E0B20',
              borderColor: combatResult.winner === 'p1' ? '#22C55E50' : combatResult.winner === 'p2' ? '#EF444450' : '#F59E0B50',
            }]}>
              <View style={styles.resultPowerBox}>
                <Text style={styles.resultPowerLabel}>You</Text>
                <Text style={styles.resultPowerNum}>{combatResult.p1Power}</Text>
              </View>
              <Text style={[styles.resultWinText, {
                color: combatResult.winner === 'p1' ? '#22C55E' : combatResult.winner === 'p2' ? '#EF4444' : '#F59E0B'
              }]}>
                {combatResult.winner === 'p1' ? 'WIN!' : combatResult.winner === 'p2' ? 'LOSS!' : 'DRAW!'}
              </Text>
              {combatResult.damage > 0 && (
                <Text style={styles.resultDmgText}>{combatResult.damage}dmg</Text>
              )}
              <View style={styles.resultPowerBox}>
                <Text style={styles.resultPowerLabel}>Opp</Text>
                <Text style={styles.resultPowerNum}>{combatResult.p2Power}</Text>
              </View>
            </View>
            {isRoundEnd && (
              <Pressable style={styles.nextRoundBtn} onPress={handleNextRound}>
                <Ionicons name="play" size={10} color="#fff" />
                <Text style={styles.nextRoundText}>Next</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.vsDivider}>
            <View style={styles.vsLine} />
            <View style={styles.vsBadge}>
              <MaterialCommunityIcons name="sword-cross" size={10} color="#7C3AED" />
            </View>
            <View style={styles.vsLine} />
          </View>
        )}
      </View>

      {/* === PLAYER FIELD === */}
      <View style={[styles.fieldZone, styles.playerZone, { height: fieldZoneH }]}>
        <View style={styles.zoneHeader}>
          <View style={styles.zonePlayerInfo}>
            <Text style={styles.zoneLabel}>YOUR FIELD</Text>
            {isDeployPhase && (
              <View style={styles.deployCounter}>
                <Text style={styles.deployCounterText}>{p1.deployed.length}/{game.cardsDeployedPerTurn}</Text>
              </View>
            )}
          </View>
          <Text style={styles.zoneCountText}>Deck: {p1.deck.length}</Text>
        </View>
        <View style={styles.zoneCards}>
          {p1.deployed.length === 0 ? (
            <Text style={styles.zoneEmptyText}>Tap cards below to deploy</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardScrollContent}>
              {p1.deployed.map((c, i) => (
                <BattlefieldCard
                  key={c.id + '-p-' + i}
                  card={c}
                  faceDown={false}
                  isPlayer={true}
                  canRemove={isDeployPhase}
                  onPress={isDeployPhase ? () => handleUndeploy(i) : () => { setPopupCard(c); setShowDialog('cardPopup'); }}
                  cardWidth={bfCardW}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      {/* === BOTTOM PANEL: Hand + Abilities + Battle === */}
      <View style={[styles.bottomPanel, { height: bottomPanelH }]}>
        <View style={styles.bottomTopRow}>
          <View style={styles.handToggle}>
            <Pressable style={[styles.handToggleBtn, handView === 'units' && styles.handToggleBtnActiveUnits]} onPress={() => setHandView('units')}>
              <Ionicons name="layers" size={8} color={handView === 'units' ? '#BBF7D0' : '#94A3B8'} />
              <Text style={[styles.handToggleText, handView === 'units' && { color: '#BBF7D0' }]}>Hand ({p1.hand.length})</Text>
            </Pressable>
            <Pressable style={[styles.handToggleBtn, handView === 'abilities' && styles.handToggleBtnActiveAbilities]} onPress={() => setHandView('abilities')}>
              <MaterialCommunityIcons name="shield-crown" size={8} color={handView === 'abilities' ? '#FDE68A' : '#94A3B8'} />
              <Text style={[styles.handToggleText, handView === 'abilities' && { color: '#FDE68A' }]}>Abilities</Text>
            </Pressable>
          </View>
          {isDeployPhase && (
            <Pressable
              style={[styles.battleButton, isProcessing && { opacity: 0.5 }]}
              disabled={isProcessing}
              onPress={handleEndDeployment}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="sword-cross" size={12} color="#fff" />
                  <Text style={styles.battleButtonText}>Battle!</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
        <View style={[styles.handCardArea, { height: handCardAreaH }]}>
          {handView === 'units' ? (
            <View style={styles.handRow}>
              {p1.hand.map((c, i) => (
                <HandCardComponent
                  key={c.id + '-h-' + i}
                  card={c}
                  onPress={() => isDeployPhase ? handleDeploy(i) : setSelectedHandIndex(selectedHandIndex === i ? null : i)}
                  onHoldPreview={() => { safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)); setPopupCard(c); setShowDialog('cardPopup'); }}
                  selected={selectedHandIndex === i}
                  cardWidth={handCardW}
                />
              ))}
              {p1.hand.length === 0 && <Text style={styles.zoneEmptyText}>No cards in hand</Text>}
            </View>
          ) : (
            <View style={styles.handRow}>
              {p1.commander.abilities.map((ab) => {
                const used = p1.usedAbilities.includes(ab.id);
                const canAfford = (ab.victoryCost === 0 || p1.victoryCurrency >= ab.victoryCost) && (ab.withdrawalCost === 0 || p1.withdrawalCurrency >= ab.withdrawalCost);
                const phaseMatch = isAbilityUsableInPhase(ab.phase, game.phase);
                const canUse = !used && canAfford && phaseMatch;
                return (
                  <Pressable
                    key={ab.id}
                    style={[styles.abilityCardH, { height: handCardAreaH }, !canUse && styles.abilityCardDisabled]}
                    disabled={!canUse || isProcessing}
                    onPress={() => handleUseAbility(ab.id)}
                  >
                    <View style={styles.abilityCardTop}>
                      <Text style={styles.abilityCardName} numberOfLines={1}>{ab.name}</Text>
                      <View style={[styles.abilityPhaseBadge, { backgroundColor: getAbilityPhaseBg(ab.phase) }]}>
                        <Text style={styles.abilityPhaseText}>{ab.phase}</Text>
                      </View>
                    </View>
                    <Text style={styles.abilityCardDesc} numberOfLines={1}>{ab.description}</Text>
                    <View style={styles.abilityCardBottom}>
                      <View style={{ flexDirection: 'row', gap: 3 }}>
                        {ab.victoryCost > 0 && (
                          <View style={styles.abilityCostBadge}>
                            <Ionicons name="star" size={7} color="#F59E0B" />
                            <Text style={styles.abilityCostText}>{ab.victoryCost}</Text>
                          </View>
                        )}
                        {ab.withdrawalCost > 0 && (
                          <View style={styles.abilityCostBadge}>
                            <Ionicons name="shield" size={7} color="#94A3B8" />
                            <Text style={styles.abilityCostText}>{ab.withdrawalCost}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.abilityStatusText, canUse ? { color: '#22C55E' } : used ? { color: '#EF4444' } : { color: '#94A3B8' }]}>
                        {used ? 'USED' : canUse ? 'READY' : !phaseMatch ? ab.phase.toUpperCase() : "CAN'T AFFORD"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* === GAME OVER OVERLAY === */}
      <Modal visible={showGameOver && isGameOver} transparent animationType="fade">
        <View style={styles.gameOverBg}>
          <View style={styles.gameOverCard}>
            <LinearGradient
              colors={game.winner === 'p1' ? ['#1E293B', '#1A3320'] : ['#1E293B', '#331A1A']}
              style={styles.gameOverGradient}
            >
              <MaterialCommunityIcons
                name={game.winner === 'p1' ? 'trophy' : 'skull-crossbones'}
                size={40}
                color={game.winner === 'p1' ? '#F59E0B' : '#EF4444'}
              />
              <Text style={[styles.gameOverTitle, { color: game.winner === 'p1' ? '#22C55E' : '#EF4444' }]}>
                {game.winner === 'p1' ? 'VICTORY!' : 'DEFEAT'}
              </Text>
              <Text style={styles.gameOverSub}>
                {game.winner === 'p1' ? 'You defeated the AI opponent!' : 'Better luck next time!'}
              </Text>

              <View style={styles.gameOverStats}>
                <View style={styles.gameOverStatBox}>
                  <Text style={styles.gameOverStatLabel}>Your HP</Text>
                  <Text style={[styles.gameOverStatValue, { color: '#22C55E' }]}>{p1.hp}</Text>
                </View>
                <View style={styles.gameOverStatBox}>
                  <Text style={styles.gameOverStatLabel}>Rounds</Text>
                  <Text style={styles.gameOverStatValue}>{game.roundResults.length}</Text>
                </View>
                <View style={styles.gameOverStatBox}>
                  <Text style={styles.gameOverStatLabel}>Opp HP</Text>
                  <Text style={[styles.gameOverStatValue, { color: '#EF4444' }]}>{p2.hp}</Text>
                </View>
              </View>

              <View style={styles.gameOverButtons}>
                <Pressable style={styles.gameOverBtnPrimary} onPress={handleNewGame}>
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.gameOverBtnText}>Play Again</Text>
                </Pressable>
                <Pressable style={styles.gameOverBtnSecondary} onPress={() => router.back()}>
                  <Ionicons name="arrow-back" size={16} color="#E2E8F0" />
                  <Text style={styles.gameOverBtnSecText}>Exit</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* === DIALOGS (Combat Log / History) === */}
      <Modal visible={showDialog === 'log' || showDialog === 'history'} transparent animationType="fade" onRequestClose={() => setShowDialog('none')}>
        <View style={styles.dialogBg}>
          <View style={[styles.dialogCard, { marginTop: safeT + 16, marginBottom: safeB + 16, marginLeft: safeL + 16, marginRight: safeR + 16 }]}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>
                {showDialog === 'history' ? 'Combat History' : 'Battle Log'}
              </Text>
              <Pressable onPress={() => setShowDialog('none')} hitSlop={8} style={styles.dialogClose}>
                <Ionicons name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 20 }}>
              {showDialog === 'log' && game.log.map((l, i) => (
                <Text key={i} style={[styles.logLine, l.startsWith('---') && styles.logDivider]}>{l}</Text>
              ))}
              {showDialog === 'history' && (
                game.roundResults.length === 0 ? (
                  <Text style={styles.zoneEmptyText}>No rounds played yet</Text>
                ) : (
                  game.roundResults.map((r, i) => (
                    <View key={i} style={styles.historyItem}>
                      <View style={styles.historyHeader}>
                        <Text style={styles.historyRound}>Round {r.round}</Text>
                        <Text style={[styles.historyResult, {
                          color: r.winner === 'p1' ? '#22C55E' : r.winner === 'p2' ? '#EF4444' : '#F59E0B'
                        }]}>
                          {r.winner === 'p1' ? 'Victory' : r.winner === 'p2' ? 'Defeat' : 'Draw'}
                        </Text>
                      </View>
                      <View style={styles.historyDetail}>
                        <View style={[styles.historyPowerBox, { backgroundColor: '#22C55E15', borderColor: '#22C55E30' }]}>
                          <Text style={styles.historyPowerLabel}>You</Text>
                          <Text style={[styles.historyPowerVal, { color: '#22C55E' }]}>{r.p1Power}</Text>
                        </View>
                        <Text style={styles.historyVs}>vs</Text>
                        <View style={[styles.historyPowerBox, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}>
                          <Text style={styles.historyPowerLabel}>Opp</Text>
                          <Text style={[styles.historyPowerVal, { color: '#EF4444' }]}>{r.p2Power}</Text>
                        </View>
                        {r.damage > 0 && (
                          <View style={styles.historyDmgBadge}>
                            <Ionicons name="flame" size={10} color="#F59E0B" />
                            <Text style={styles.historyDmgText}>{r.damage} dmg</Text>
                          </View>
                        )}
                      </View>
                      {(r.p1QS > 0 || r.p2QS > 0 || r.p1Guardian > 0 || r.p2Guardian > 0 || r.p1Healing > 0 || r.p2Healing > 0) && (
                        <View style={styles.historyTraits}>
                          {r.p1QS > 0 && <View style={styles.historyTraitBadge}><Text style={[styles.historyTraitText, { color: '#F59E0B' }]}>QS {r.p1QS}dmg (You)</Text></View>}
                          {r.p2QS > 0 && <View style={styles.historyTraitBadge}><Text style={[styles.historyTraitText, { color: '#F59E0B' }]}>QS {r.p2QS}dmg (Opp)</Text></View>}
                          {r.p1Guardian > 0 && <View style={styles.historyTraitBadge}><Text style={[styles.historyTraitText, { color: '#3B82F6' }]}>Guard {r.p1Guardian} (You)</Text></View>}
                          {r.p2Guardian > 0 && <View style={styles.historyTraitBadge}><Text style={[styles.historyTraitText, { color: '#3B82F6' }]}>Guard {r.p2Guardian} (Opp)</Text></View>}
                          {r.p1Healing > 0 && <View style={styles.historyTraitBadge}><Text style={[styles.historyTraitText, { color: '#22C55E' }]}>Heal {r.p1Healing} (You)</Text></View>}
                          {r.p2Healing > 0 && <View style={styles.historyTraitBadge}><Text style={[styles.historyTraitText, { color: '#22C55E' }]}>Heal {r.p2Healing} (Opp)</Text></View>}
                        </View>
                      )}
                      {r.abilityEffects && r.abilityEffects.length > 0 && (
                        <View style={styles.historyTraits}>
                          {r.abilityEffects.map((ae, aei) => {
                            const isYou = ae.playerSide === 'player1' || ae.playerSide === 'p1';
                            return (
                              <View key={aei} style={[styles.abilityEffectBadge, {
                                backgroundColor: isYou ? '#22C55E15' : '#EF444415',
                                borderColor: isYou ? '#22C55E30' : '#EF444430',
                              }]}>
                                <Text style={[styles.abilityEffectName, { color: isYou ? '#22C55E' : '#EF4444' }]}>{ae.abilityName}</Text>
                                <Text style={styles.abilityEffectDesc}>{ae.effectDescription}</Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                      <View style={styles.historyCards}>
                        {r.p1Cards.map((c, ci) => (
                          <View key={ci} style={[styles.historyCardDot, { backgroundColor: getElementColor(c.element) }]}>
                            <Text style={styles.historyCardPower}>{c.currentPower}</Text>
                          </View>
                        ))}
                        <Text style={styles.historyVs}>vs</Text>
                        {r.p2Cards.map((c, ci) => (
                          <View key={ci} style={[styles.historyCardDot, { backgroundColor: getElementColor(c.element) + '80' }]}>
                            <Text style={styles.historyCardPower}>{c.currentPower}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* === CARD POPUP (inline overlay, not Modal — avoids landscape orientation crash on native) === */}
      {showDialog === 'cardPopup' && !!popupCard && (
        <Pressable style={[StyleSheet.absoluteFillObject, styles.dialogBg]} onPress={() => setShowDialog('none')}>
          <View style={styles.cardPopup}>
            <View style={[styles.cardPopupInner, { borderColor: ELEMENT_SOLID_BORDERS[popupCard.element.toLowerCase()] ?? '#7C3AED80' }]}>
              {popupCard.id ? (
                <AuthImage
                  uri={getCardImageUrl(popupCard.id)}
                  fallbackUri={popupCard.imageUrl || ELEMENT_ART[popupCard.element.toLowerCase()]}
                  style={styles.cardPopupArt}
                  resizeMode="cover"
                />
              ) : (popupCard.imageUrl || ELEMENT_ART[popupCard.element.toLowerCase()]) ? (
                <Image
                  source={{ uri: popupCard.imageUrl || ELEMENT_ART[popupCard.element.toLowerCase()] }}
                  style={styles.cardPopupArt}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={[getElementBg(popupCard.element), '#0F172A']}
                  style={StyleSheet.absoluteFillObject}
                />
              )}
              <View style={styles.cardPopupOverlay}>
                <View style={styles.cardPopupPower}>
                  <Text style={styles.cardPopupPowerText}>{(popupCard as any).currentPower ?? popupCard.power}</Text>
                  <Text style={styles.cardPopupPowerLabel}>PWR</Text>
                </View>
                {popupCard.trait && (
                  <View style={styles.cardPopupTrait}>
                    <Text style={styles.cardPopupTraitVal}>{popupCard.traitValue ?? 0}</Text>
                    <Text style={styles.cardPopupTraitName}>{popupCard.trait}</Text>
                  </View>
                )}
                <View style={styles.cardPopupNameBar}>
                  <Text style={styles.cardPopupName}>{popupCard.name}</Text>
                  <View style={[styles.cardPopupElement, { backgroundColor: getElementColor(popupCard.element) }]}>
                    <Text style={styles.cardPopupElementText}>{popupCard.element}</Text>
                  </View>
                </View>
                <View style={styles.cardPopupMods}>
                  <View style={[styles.cardPopupModBox, { backgroundColor: popupCard.buffModifier > 0 ? '#22C55E30' : '#33415580' }]}>
                    <Text style={styles.cardPopupModLabel}>Buff</Text>
                    <Text style={[styles.cardPopupModVal, popupCard.buffModifier > 0 && { color: '#22C55E' }]}>+{popupCard.buffModifier}</Text>
                  </View>
                  <View style={[styles.cardPopupModBox, { backgroundColor: popupCard.debuffModifier > 0 ? '#EF444430' : '#33415580' }]}>
                    <Text style={styles.cardPopupModLabel}>Debuff</Text>
                    <Text style={[styles.cardPopupModVal, popupCard.debuffModifier > 0 && { color: '#EF4444' }]}>-{popupCard.debuffModifier}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Pressable>
      )}

      {/* === COMMANDER INFO OVERLAY === */}
      {(showDialog === 'commanderInfo' || showDialog === 'oppCommanderInfo') && (
        <Pressable style={[StyleSheet.absoluteFillObject, styles.dialogBg]} onPress={() => setShowDialog('none')}>
          <View style={styles.cmdInfoOverlay}>
            {(() => {
              const cmd = showDialog === 'commanderInfo' ? p1.commander : p2.commander;
              const isPlayer = showDialog === 'commanderInfo';
              const elColor = getElementColor(cmd.element);
              return (
                <ScrollView style={styles.cmdInfoScroll} contentContainerStyle={{ paddingBottom: 16 }}>
                  <View style={[styles.cmdInfoHeader, { borderBottomColor: elColor + '40' }]}>
                    <View style={[styles.cmdInfoAvatar, { backgroundColor: elColor + '30', borderColor: elColor }]}>
                      <MaterialCommunityIcons name="shield-crown" size={24} color={elColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cmdInfoName}>{cmd.name}</Text>
                      <Text style={[styles.cmdInfoTitle, { color: elColor }]}>{cmd.title}</Text>
                      <View style={[styles.cmdInfoElBadge, { backgroundColor: elColor + '25' }]}>
                        <Text style={[styles.cmdInfoElText, { color: elColor }]}>{cmd.element}</Text>
                      </View>
                    </View>
                    <Text style={styles.cmdInfoLabel}>{isPlayer ? 'YOUR' : 'OPPONENT'}</Text>
                  </View>
                  {cmd.description ? <Text style={styles.cmdInfoDesc}>{cmd.description}</Text> : null}
                  <Text style={styles.cmdInfoAbilitiesTitle}>Abilities</Text>
                  {cmd.abilities.map((ab) => (
                    <View key={ab.id} style={[styles.cmdInfoAbilityCard, { borderColor: elColor + '30' }]}>
                      <View style={styles.cmdInfoAbilityHeader}>
                        <Text style={styles.cmdInfoAbilityName}>{ab.name}</Text>
                        <View style={[styles.cmdInfoPhaseBadge, { backgroundColor: getAbilityPhaseBg(ab.phase) }]}>
                          <Text style={styles.cmdInfoPhaseText}>{ab.phase}</Text>
                        </View>
                      </View>
                      <Text style={styles.cmdInfoAbilityDesc}>{ab.description}</Text>
                      <View style={styles.cmdInfoCostRow}>
                        {ab.victoryCost > 0 && (
                          <View style={styles.cmdInfoCostBadge}>
                            <Ionicons name="star" size={10} color="#F59E0B" />
                            <Text style={styles.cmdInfoCostText}>{ab.victoryCost}</Text>
                          </View>
                        )}
                        {ab.withdrawalCost > 0 && (
                          <View style={styles.cmdInfoCostBadge}>
                            <Ionicons name="shield" size={10} color="#94A3B8" />
                            <Text style={styles.cmdInfoCostText}>{ab.withdrawalCost}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              );
            })()}
          </View>
        </Pressable>
      )}

      {/* === DRAW TOAST === */}
      {!!drawToast && (
        <View style={[styles.drawToast, { pointerEvents: 'none' }]}>
          <MaterialCommunityIcons name="cards" size={14} color="#F59E0B" />
          <Text style={styles.drawToastText}>{drawToast}</Text>
        </View>
      )}
    </LinearGradient>
  );

  if (needsWebRotation) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', overflow: 'hidden' }}>
        <View style={{
          width: effW,
          height: effH,
          transform: [{ rotate: '90deg' }],
          position: 'absolute',
          top: (screenH - effH) / 2,
          left: (screenW - effW) / 2,
        }}>
          {gameContent}
        </View>
      </View>
    );
  }

  return gameContent;
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', gap: 2 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#94A3B8', marginTop: 12 },

  drawToast: {
    position: 'absolute', bottom: 90, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1E293BF0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: '#F59E0B60',
  },
  drawToastText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#FCD34D' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 6, paddingVertical: 2,
    borderBottomWidth: 1, borderBottomColor: '#7C3AED33',
    backgroundColor: '#0F172AF2', overflow: 'hidden',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, overflow: 'hidden' },
  headerBtn: { padding: 3, borderRadius: 6 },
  cmdAvatar: { width: 24, height: 24, borderRadius: 6, overflow: 'hidden' },
  cmdAvatarInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerPlayerName: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#E2E8F0', maxWidth: 70 },
  headerPlayerTitle: { fontFamily: 'Inter_400Regular', fontSize: 7, color: '#7C3AED' },

  headerCenter: { flex: 2, alignItems: 'center', gap: 2, overflow: 'hidden' },
  roundPhaseRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roundBadge: { backgroundColor: '#7C3AED25', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  roundText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#7C3AED' },
  phaseRow: { flexDirection: 'row', gap: 2 },
  phaseDot: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center',
  },
  phaseLabelBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  phaseLabelText: { fontFamily: 'Inter_600SemiBold', fontSize: 7, color: '#fff', textTransform: 'uppercase' },

  hpSection: { flexDirection: 'row', gap: 4, width: '100%', maxWidth: 280 },
  hpBarWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: 1, borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2,
    overflow: 'hidden',
  },
  hpBarInner: { flex: 1, height: 5, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: 3 },
  hpLabel: { fontFamily: 'Inter_500Medium', fontSize: 7, color: '#94A3B8', width: 22 },
  hpValue: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#E2E8F0', minWidth: 28, textAlign: 'right' },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' },
  currencyCol: { gap: 1 },
  currencyBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#1E293B', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  currencyText: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: '#E2E8F0' },
  headerBtns: { flexDirection: 'row', gap: 3 },
  headerLogBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
    backgroundColor: '#1E293B',
  },
  headerLogBtnActive: { backgroundColor: '#7C3AED20', borderWidth: 1, borderColor: '#7C3AED40' },
  headerLogBtnText: { fontFamily: 'Inter_500Medium', fontSize: 7, color: '#94A3B8' },

  oppHandRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 6,
    borderBottomWidth: 1, borderBottomColor: '#EF444415', backgroundColor: '#EF444008',
    overflow: 'hidden',
  },
  oppHandInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 120 },
  oppHandLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: '#E2E8F0', maxWidth: 60 },
  oppHandCount: { fontFamily: 'Inter_400Regular', fontSize: 7, color: '#64748B' },
  oppHandCards: { flexDirection: 'row', gap: 3, alignItems: 'center', paddingVertical: 2 },
  oppHandCard: { borderRadius: 4, borderWidth: 1, borderColor: '#7C3AED40', overflow: 'hidden' },
  oppHandCardInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 3 },

  fieldZone: {
    borderRadius: 6, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 2, overflow: 'hidden',
    marginHorizontal: 2,
  },
  opponentZone: { borderColor: '#EF444420', backgroundColor: '#EF444008' },
  playerZone: { borderColor: '#22C55E20', backgroundColor: '#22C55E08' },
  zoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 14 },
  zonePlayerInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  zoneLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 7, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  zoneCmdDot: { width: 14, height: 14, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  zoneCurrRow: { flexDirection: 'row', gap: 3 },
  zoneCurrBadge: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  zoneCurrText: { fontFamily: 'Inter_600SemiBold', fontSize: 7, color: '#CBD5E1' },
  zoneCountText: { fontFamily: 'Inter_400Regular', fontSize: 7, color: '#64748B' },
  deployCounter: { backgroundColor: '#22C55E30', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  deployCounterText: { fontFamily: 'Inter_700Bold', fontSize: 7, color: '#22C55E' },

  zoneCards: { flex: 1, justifyContent: 'center' },
  zoneEmptyText: { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#475569', textAlign: 'center' },
  cardScrollContent: { gap: 4, alignItems: 'center', paddingHorizontal: 2, justifyContent: 'center' },

  bfCard: {
    aspectRatio: 3 / 4, borderRadius: 6, borderWidth: 2, overflow: 'hidden',
  },
  bfCardFaceDown: { borderColor: '#7C3AED60' },
  bfCardInner: { flex: 1, position: 'relative' },
  bfCardArt: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  bfCardArtOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0 },

  bfPowerBadge: {
    position: 'absolute', top: 1, left: 1, minWidth: 16, height: 16, paddingHorizontal: 3,
    backgroundColor: '#0F172AE6', borderRadius: 4, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#FFFFFF33',
  },
  bfPowerText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#fff' },

  bfTraitBadge: {
    position: 'absolute', top: 1, right: 1, height: 16, paddingHorizontal: 2,
    borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 1,
  },
  bfTraitText: { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#fff' },
  bfTraitLabel: { fontFamily: 'Inter_500Medium', fontSize: 5, color: '#E9D5FF' },

  bfBuffBadge: {
    position: 'absolute', bottom: 14, left: 1, width: 18, height: 14,
    borderRadius: 3, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  bfDebuffBadge: {
    position: 'absolute', bottom: 14, right: 1, width: 18, height: 14,
    borderRadius: 3, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  bfModText: { fontFamily: 'Inter_700Bold', fontSize: 7 },

  bfCardNameBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 13,
    backgroundColor: '#0F172ACC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
  },
  bfCardName: { fontFamily: 'Inter_500Medium', fontSize: 6, color: '#CBD5E1' },

  bfRemoveBadge: {
    position: 'absolute', top: -1, right: -1, width: 14, height: 14,
    borderRadius: 7, backgroundColor: '#0F172AE6', borderWidth: 1, borderColor: '#EF444440',
    alignItems: 'center', justifyContent: 'center',
  },

  centerStrip: {
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },

  combatStepsRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2,
    paddingHorizontal: 4,
  },
  combatStep: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4,
    borderWidth: 1, borderColor: 'transparent', backgroundColor: '#1E293B',
  },
  combatStepText: { fontFamily: 'Inter_500Medium', fontSize: 7, color: '#475569' },

  combatResultRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1,
  },
  combatResultBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  resultPowerBox: { alignItems: 'center', minWidth: 28 },
  resultPowerLabel: { fontFamily: 'Inter_400Regular', fontSize: 6, color: '#94A3B8' },
  resultPowerNum: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#E2E8F0' },
  resultWinText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  resultDmgText: { fontFamily: 'Inter_400Regular', fontSize: 7, color: '#F59E0B' },

  nextRoundBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#7C3AED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  nextRoundText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#fff' },

  vsDivider: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, flex: 1 },
  vsLine: { flex: 1, height: 1, backgroundColor: '#7C3AED20' },
  vsBadge: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: '#7C3AED40', alignItems: 'center', justifyContent: 'center', marginHorizontal: 4,
  },

  bottomPanel: {
    backgroundColor: '#1E293B40', borderRadius: 6, borderWidth: 1, borderColor: '#33415540',
    marginHorizontal: 2, paddingHorizontal: 4, paddingVertical: 2, overflow: 'hidden',
  },
  bottomTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 22,
  },
  handToggle: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 4, padding: 1 },
  handToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },
  handToggleBtnActiveUnits: { backgroundColor: '#16A34ACC' },
  handToggleBtnActiveAbilities: { backgroundColor: '#D97706CC' },
  handToggleText: { fontFamily: 'Inter_500Medium', fontSize: 7, color: '#94A3B8' },

  battleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
    backgroundColor: '#7C3AED', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4,
    elevation: 4,
  },
  battleButtonText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#fff' },

  handCardArea: { overflow: 'hidden' },
  handHorizontalContent: { gap: 4, alignItems: 'center', paddingVertical: 2 },
  handRow: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 2, flexWrap: 'nowrap' },

  handCard: {
    aspectRatio: 3 / 4, borderRadius: 6, borderWidth: 2, overflow: 'hidden',
    backgroundColor: '#0F172A', position: 'relative',
  },
  handCardSelected: { borderColor: '#7C3AED', shadowColor: '#7C3AED', shadowOpacity: 0.5, shadowRadius: 6, elevation: 6 },
  handCardArt: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  handCardOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0 },
  handPowerBadge: {
    position: 'absolute', top: 1, left: 1, minWidth: 14, height: 14, paddingHorizontal: 2,
    backgroundColor: '#0F172AE6', borderRadius: 3, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#FFFFFF33',
  },
  handPowerText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#fff' },
  handTraitBadge: {
    position: 'absolute', top: 1, right: 1, height: 14, paddingHorizontal: 2,
    borderRadius: 3, alignItems: 'center', justifyContent: 'center',
  },
  handTraitVal: { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#fff' },
  handBottomRow: {
    position: 'absolute', bottom: 13, left: 1, right: 1,
    flexDirection: 'row', gap: 2,
  },
  handModBox: { flex: 1, height: 12, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  handModText: { fontFamily: 'Inter_700Bold', fontSize: 7 },
  handCardNameWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0F172ACC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 1,
  },
  handCardNameText: {
    fontFamily: 'Inter_500Medium', color: '#CBD5E1', textAlign: 'center',
  },

  abilityCardH: {
    backgroundColor: '#1E293B', borderRadius: 6, padding: 5,
    borderWidth: 1, borderColor: '#7C3AED30', gap: 1,
    width: 140,
  },
  abilityCardDisabled: { opacity: 0.4 },
  abilityCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  abilityCardName: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: '#E2E8F0', flex: 1, marginRight: 3 },
  abilityPhaseBadge: { paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 },
  abilityPhaseText: { fontFamily: 'Inter_500Medium', fontSize: 6, color: '#fff', textTransform: 'capitalize' },
  abilityCardDesc: { fontFamily: 'Inter_400Regular', fontSize: 7, color: '#94A3B8', lineHeight: 9 },
  abilityCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  abilityCostBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  abilityCostText: { fontFamily: 'Inter_500Medium', fontSize: 7, color: '#CBD5E1' },
  abilityStatusText: { fontFamily: 'Inter_700Bold', fontSize: 6 },

  gameOverBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  gameOverCard: {
    width: '60%', maxWidth: 380, maxHeight: '90%', borderRadius: 14, overflow: 'hidden',
    borderWidth: 2, borderColor: '#F59E0B50',
  },
  gameOverGradient: { padding: 12, alignItems: 'center', gap: 4 },
  gameOverTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  gameOverSub: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94A3B8', textAlign: 'center' },
  gameOverStats: { flexDirection: 'row', gap: 8, marginTop: 4 },
  gameOverStatBox: { backgroundColor: '#334155', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' },
  gameOverStatLabel: { fontFamily: 'Inter_400Regular', fontSize: 7, color: '#94A3B8' },
  gameOverStatValue: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#E2E8F0' },
  gameOverButtons: { flexDirection: 'row', gap: 8, marginTop: 6 },
  gameOverBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  gameOverBtnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#fff' },
  gameOverBtnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#334155', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  gameOverBtnSecText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#E2E8F0' },

  dialogBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  dialogCard: {
    flex: 1, backgroundColor: '#0F172A', borderRadius: 14, overflow: 'hidden',
    borderWidth: 2, borderColor: '#7C3AED30',
    maxWidth: 460, maxHeight: '88%',
  },
  dialogHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  dialogTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#E2E8F0' },
  dialogClose: { padding: 4 },

  logLine: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94A3B8', lineHeight: 15 },
  logDivider: { fontFamily: 'Inter_600SemiBold', color: '#7C3AED', marginTop: 6 },

  historyItem: { backgroundColor: '#1E293B', borderRadius: 10, padding: 10, marginBottom: 6, gap: 4, borderWidth: 1, borderColor: '#334155' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyRound: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#E2E8F0' },
  historyResult: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  historyDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyPowerBox: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', borderWidth: 1 },
  historyPowerLabel: { fontFamily: 'Inter_400Regular', fontSize: 7, color: '#94A3B8' },
  historyPowerVal: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  historyVs: { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#64748B' },
  historyDmgBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F59E0B20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  historyDmgText: { fontFamily: 'Inter_500Medium', fontSize: 9, color: '#F59E0B' },
  historyTraits: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 2 },
  historyTraitBadge: { backgroundColor: '#1E293B', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, borderWidth: 1, borderColor: '#33415540' },
  historyTraitText: { fontFamily: 'Inter_500Medium', fontSize: 8 },
  historyCards: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  historyCardDot: { width: 20, height: 20, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  historyCardPower: { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#fff' },

  cardPopup: { alignItems: 'center', justifyContent: 'center' },
  cardPopupInner: { width: 150, aspectRatio: 3 / 4, borderRadius: 12, borderWidth: 3, overflow: 'hidden', position: 'relative' },
  cardPopupArt: { ...StyleSheet.absoluteFillObject },
  cardPopupOverlay: { flex: 1, justifyContent: 'space-between', padding: 10 },
  cardPopupPower: {
    position: 'absolute', top: 10, left: 10, width: 44, height: 44,
    borderRadius: 10, backgroundColor: '#0F172AE6', borderWidth: 2, borderColor: '#FFFFFF33',
    alignItems: 'center', justifyContent: 'center',
  },
  cardPopupPowerText: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#fff' },
  cardPopupPowerLabel: { fontFamily: 'Inter_500Medium', fontSize: 6, color: '#94A3B8' },
  cardPopupTrait: {
    position: 'absolute', top: 10, right: 10, width: 44, height: 44,
    borderRadius: 10, backgroundColor: '#9333EAE6', borderWidth: 2, borderColor: '#A855F780',
    alignItems: 'center', justifyContent: 'center',
  },
  cardPopupTraitVal: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff' },
  cardPopupTraitName: { fontFamily: 'Inter_500Medium', fontSize: 5, color: '#E9D5FF' },
  cardPopupNameBar: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    backgroundColor: '#0F172ACC', paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardPopupName: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#E2E8F0', flex: 1 },
  cardPopupElement: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  cardPopupElementText: { fontFamily: 'Inter_600SemiBold', fontSize: 8, color: '#fff', textTransform: 'capitalize' },
  cardPopupMods: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#0F172AE6',
  },
  cardPopupModBox: { flex: 1, borderRadius: 6, padding: 4, alignItems: 'center' },
  cardPopupModLabel: { fontFamily: 'Inter_400Regular', fontSize: 7, color: '#94A3B8' },
  cardPopupModVal: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#94A3B8' },

  cmdInfoOverlay: {
    position: 'absolute', top: '5%', bottom: '5%', left: '10%', right: '10%',
    backgroundColor: '#1E293BF5', borderRadius: 12, borderWidth: 1, borderColor: '#7C3AED40',
    overflow: 'hidden',
  },
  cmdInfoScroll: { flex: 1, padding: 12 },
  cmdInfoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingBottom: 10, borderBottomWidth: 1, marginBottom: 8,
  },
  cmdInfoAvatar: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  cmdInfoName: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#E2E8F0' },
  cmdInfoTitle: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  cmdInfoElBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, alignSelf: 'flex-start', marginTop: 2 },
  cmdInfoElText: { fontFamily: 'Inter_600SemiBold', fontSize: 8, textTransform: 'capitalize' },
  cmdInfoLabel: { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#64748B', textTransform: 'uppercase' },
  cmdInfoDesc: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94A3B8', marginBottom: 8, lineHeight: 14 },
  cmdInfoAbilitiesTitle: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#E2E8F0', marginBottom: 6 },
  cmdInfoAbilityCard: {
    backgroundColor: '#0F172A80', borderRadius: 8, borderWidth: 1, padding: 8, marginBottom: 6, gap: 4,
  },
  cmdInfoAbilityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cmdInfoAbilityName: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#E2E8F0' },
  cmdInfoPhaseBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  cmdInfoPhaseText: { fontFamily: 'Inter_600SemiBold', fontSize: 7, color: '#fff', textTransform: 'capitalize' },
  cmdInfoAbilityDesc: { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#94A3B8', lineHeight: 13 },
  cmdInfoCostRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  cmdInfoCostBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#33415560', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  cmdInfoCostText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#E2E8F0' },

  abilityEffectBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
    borderWidth: 1,
  },
  abilityEffectName: { fontFamily: 'Inter_600SemiBold', fontSize: 8 },
  abilityEffectDesc: { fontFamily: 'Inter_400Regular', fontSize: 7, color: '#CBD5E1' },
});
