import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '@/lib/api';
import { getCardArt, getCardImageUrl } from '@/constants/card-art';
import AuthImage from '@/components/AuthImage';

type CardSize = 'sm' | 'md' | 'lg' | 'xl';

interface CardFrameProps {
  card: Card;
  size?: CardSize;
  showArt?: boolean;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  faceDown?: boolean;
  count?: number;
}

const SIZES: Record<CardSize, { width: number; height: number }> = {
  sm: { width: 80, height: 120 },
  md: { width: 96, height: 144 },
  lg: { width: 128, height: 192 },
  xl: { width: 144, height: 216 },
};

const ELEMENT_BORDERS: Record<string, string> = {
  fire: '#ef4444',
  water: '#3b82f6',
  earth: '#f97316',
  air: '#22d3ee',
  nature: '#22c55e',
};

const ELEMENT_GRADIENT: Record<string, [string, string]> = {
  fire: ['#dc2626', '#ea580c'],
  water: ['#2563eb', '#06b6d4'],
  earth: ['#b45309', '#ca8a04'],
  air: ['#22d3ee', '#2dd4bf'],
  nature: ['#15803d', '#059669'],
};

const BUFF_COLORS: Record<string, string> = {
  Red: 'rgba(239, 68, 68, 0.9)',
  Blue: 'rgba(59, 130, 246, 0.9)',
  Amber: 'rgba(245, 158, 11, 0.9)',
  Green: 'rgba(34, 197, 94, 0.9)',
  Black: 'rgba(30, 41, 59, 0.9)',
};

const TRAIT_ICONS: Record<string, string> = {
  'Quick Strike': 'lightning-bolt',
  'Guardian': 'shield-half-full',
  'Restoration': 'heart-plus',
  'Care Package': 'package-variant',
};

function getElementBorder(element: string): string {
  return ELEMENT_BORDERS[element.toLowerCase()] ?? ELEMENT_BORDERS.fire;
}

function getElementGradient(element: string): [string, string] {
  return ELEMENT_GRADIENT[element.toLowerCase()] ?? ELEMENT_GRADIENT.fire;
}

function getBuffColor(color: string | null): string {
  if (!color) return '#334155';
  return BUFF_COLORS[color] ?? '#334155';
}

export default function CardFrame({
  card,
  size = 'md',
  showArt = true,
  onPress,
  selected = false,
  disabled = false,
  faceDown = false,
  count,
}: CardFrameProps) {
  const dims = SIZES[size];
  const isSmall = size === 'sm';
  const isMedium = size === 'md';
  const isLarge = size === 'lg' || size === 'xl';

  const powerFontSize = isSmall ? 7 : isMedium ? 8 : 10;
  const traitFontSize = isSmall ? 5 : isMedium ? 6 : 8;
  const buffFontSize = isSmall ? 6 : isMedium ? 7 : 9;
  const nameFontSize = isSmall ? 6 : isMedium ? 7 : 9;
  const unitFontSize = isSmall ? 5 : isMedium ? 6 : 8;
  const barHeight = isSmall ? 14 : isMedium ? 16 : 20;
  const footerHeight = isSmall ? 16 : isMedium ? 20 : 26;
  const badgePad = isSmall ? 2 : 3;

  if (faceDown) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || !onPress}
        activeOpacity={0.8}
        style={[
          {
            width: dims.width,
            height: dims.height,
            borderRadius: 8,
            borderWidth: 4,
            borderColor: '#9333ea',
            overflow: 'hidden',
            opacity: disabled ? 0.5 : 1,
          },
          ...(selected ? [styles.selectedRing] : []),
        ]}
      >
        <LinearGradient
          colors={['#7e22ce', '#581c87', '#3b0764']}
          style={styles.faceDownGradient}
        >
          <Text style={[styles.faceDownQuestion, { fontSize: dims.width * 0.35 }]}>?</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const containerStyle: ViewStyle[] = [
    {
      width: dims.width,
      height: dims.height,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: getElementBorder(card.element),
      overflow: 'hidden' as const,
      backgroundColor: '#0f172a',
      opacity: disabled ? 0.5 : 1,
    },
    ...(selected ? [styles.selectedRing] : []),
  ];

  const content = (
    <View style={containerStyle}>
      <View style={[styles.topBar, { height: barHeight }]}>
        <View style={[styles.powerBadge, { paddingHorizontal: badgePad, paddingVertical: 1, borderRadius: 3 }]}>
          <Text style={[styles.powerText, { fontSize: powerFontSize }]}>{card.power}</Text>
        </View>
        {card.trait && card.traitValue ? (
          <View style={[styles.traitBadge, { paddingHorizontal: badgePad, paddingVertical: 1, borderRadius: 3 }]}>
            {!isSmall && TRAIT_ICONS[card.trait] && (
              <MaterialCommunityIcons
                name={TRAIT_ICONS[card.trait] as any}
                size={traitFontSize + 2}
                color="#fff"
                style={{ marginRight: 1 }}
              />
            )}
            <Text style={[styles.traitText, { fontSize: traitFontSize }]}>{card.traitValue}</Text>
          </View>
        ) : (
          <View style={[styles.traitBadgeEmpty, { paddingHorizontal: badgePad, paddingVertical: 1, borderRadius: 3 }]}>
            <Text style={[styles.traitTextEmpty, { fontSize: traitFontSize }]}>-</Text>
          </View>
        )}
      </View>

      <View style={styles.artArea}>
        {showArt ? (
          card.id ? (
            <AuthImage
              uri={getCardImageUrl(card.id)}
              fallbackUri={getCardArt(card)}
              style={styles.artImage}
              resizeMode="cover"
            />
          ) : (
            <Image
              source={{ uri: getCardArt(card) }}
              style={styles.artImage}
              resizeMode="cover"
            />
          )
        ) : (
          <LinearGradient
            colors={getElementGradient(card.element)}
            style={styles.artFallback}
          />
        )}
      </View>

      <View style={[styles.bottomBar, { height: barHeight }]}>
        <View style={[styles.buffBadge, { backgroundColor: getBuffColor(card.buffColor), paddingHorizontal: badgePad, borderRadius: 3 }]}>
          <Text style={[styles.buffText, { fontSize: buffFontSize }]}>+{card.buffModifier}</Text>
        </View>
        <View style={[styles.debuffBadge, { backgroundColor: getBuffColor(card.debuffColor), paddingHorizontal: badgePad, borderRadius: 3 }]}>
          <Text style={[styles.debuffText, { fontSize: buffFontSize }]}>-{card.debuffModifier}</Text>
        </View>
      </View>

      <View style={[styles.footer, { height: footerHeight }]}>
        <Text style={[styles.cardName, { fontSize: nameFontSize }]} numberOfLines={1}>
          {card.name}
        </Text>
        <Text style={[styles.unitLabel, { fontSize: unitFontSize }]}>UNIT</Text>
      </View>

      {count !== undefined && count > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  selectedRing: {
    shadowColor: '#facc15',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
    borderColor: '#facc15',
  },
  topBar: {
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
  },
  powerBadge: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  powerText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  traitBadge: {
    backgroundColor: '#9333ea',
    flexDirection: 'row',
    alignItems: 'center',
  },
  traitText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  traitBadgeEmpty: {
    backgroundColor: '#334155',
  },
  traitTextEmpty: {
    color: '#94a3b8',
  },
  artArea: {
    flex: 1,
    overflow: 'hidden',
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  artFallback: {
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
  },
  buffBadge: {
    paddingVertical: 1,
  },
  buffText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  debuffBadge: {
    paddingVertical: 1,
  },
  debuffText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  cardName: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  unitLabel: {
    color: '#d8b4fe',
    fontWeight: '600' as const,
    textAlign: 'center',
    marginTop: -1,
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#facc15',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  countText: {
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: 10,
  },
  faceDownGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceDownQuestion: {
    color: '#d8b4fe',
    fontWeight: 'bold',
  },
});
