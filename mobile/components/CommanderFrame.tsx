import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Commander } from '@/lib/api';
import { getCommanderPortrait, getCommanderImageUrl } from '@/constants/card-art';
import AuthImage from '@/components/AuthImage';

const SIZES = {
  sm: { width: 96, height: 144 },
  md: { width: 128, height: 192 },
  lg: { width: 160, height: 240 },
  xl: { width: 192, height: 288 },
} as const;

const ELEMENT_CONFIG: Record<string, {
  headerBg: string;
  icon: keyof typeof Ionicons.glyphMap;
  borderColor: string;
}> = {
  fire: { headerBg: '#dc2626', icon: 'flame', borderColor: '#ef4444' },
  water: { headerBg: '#2563eb', icon: 'water', borderColor: '#3b82f6' },
  earth: { headerBg: '#c2410c', icon: 'earth', borderColor: '#f97316' },
  air: { headerBg: '#0891b2', icon: 'cloud', borderColor: '#22d3ee' },
  nature: { headerBg: '#16a34a', icon: 'leaf', borderColor: '#22c55e' },
};

interface CommanderFrameProps {
  commander: Commander;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onPress?: () => void;
  selected?: boolean;
}

export default function CommanderFrame({
  commander,
  size = 'md',
  onPress,
  selected = false,
}: CommanderFrameProps) {
  const dims = SIZES[size];
  const el = commander.element.toLowerCase();
  const config = ELEMENT_CONFIG[el] ?? ELEMENT_CONFIG.fire;
  const portrait = getCommanderPortrait(el);

  const headerFontSize = size === 'sm' ? 7 : size === 'md' ? 8 : 10;
  const nameFontSize = size === 'sm' ? 10 : size === 'md' ? 12 : 14;
  const titleFontSize = size === 'sm' ? 7 : size === 'md' ? 8 : 10;
  const pillFontSize = size === 'sm' ? 6 : size === 'md' ? 7 : 8;
  const iconSize = size === 'sm' ? 8 : size === 'md' ? 10 : 12;
  const headerPadding = size === 'sm' ? 3 : size === 'md' ? 4 : 6;
  const bottomPadding = size === 'sm' ? 4 : size === 'md' ? 6 : 8;
  const pillPaddingH = size === 'sm' ? 3 : size === 'md' ? 4 : 6;
  const pillPaddingV = size === 'sm' ? 1 : 2;
  const maxAbilities = 3;

  const content = (
    <View
      style={[
        styles.container,
        {
          width: dims.width,
          height: dims.height,
          borderRadius: size === 'sm' ? 8 : 12,
        },
        selected && styles.selected,
      ]}
    >
      <AuthImage
        uri={getCommanderImageUrl(commander.id)}
        fallbackUri={portrait}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: config.headerBg,
            paddingVertical: headerPadding,
            paddingHorizontal: headerPadding + 2,
          },
        ]}
      >
        <Ionicons name={config.icon} size={iconSize} color="#fff" />
        <Text
          style={[
            styles.headerText,
            { fontSize: headerFontSize, marginLeft: headerPadding - 1 },
          ]}
          numberOfLines={1}
        >
          {commander.element.toUpperCase()} COMMANDER
        </Text>
      </View>

      <View style={styles.spacer} />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.80)', 'rgba(0,0,0,0.95)']}
        style={[styles.bottomOverlay, { padding: bottomPadding }]}
      >
        <Text
          style={[styles.nameText, { fontSize: nameFontSize }]}
          numberOfLines={1}
        >
          {commander.name}
        </Text>
        <Text
          style={[styles.titleText, { fontSize: titleFontSize }]}
          numberOfLines={1}
        >
          {commander.title}
        </Text>
        {commander.abilities && commander.abilities.length > 0 && (
          <View style={styles.pillRow}>
            {commander.abilities.slice(0, maxAbilities).map((ability) => (
              <View
                key={ability.id}
                style={[
                  styles.pill,
                  {
                    paddingHorizontal: pillPaddingH,
                    paddingVertical: pillPaddingV,
                  },
                ]}
              >
                <Text
                  style={[styles.pillText, { fontSize: pillFontSize }]}
                  numberOfLines={1}
                >
                  {ability.name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </LinearGradient>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  selected: {
    borderWidth: 2,
    borderColor: '#facc15',
    shadowColor: '#facc15',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  headerText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  spacer: {
    flex: 1,
  },
  bottomOverlay: {
    zIndex: 2,
  },
  nameText: {
    color: '#fff',
    fontWeight: '700',
  },
  titleText: {
    color: '#cbd5e1',
    marginTop: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 4,
  },
  pill: {
    backgroundColor: 'rgba(147, 51, 234, 0.9)',
    borderRadius: 4,
  },
  pillText: {
    color: '#fff',
    fontWeight: '600',
  },
});
