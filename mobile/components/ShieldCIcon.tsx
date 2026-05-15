import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MciName } from '@/lib/icon-types';

interface ShieldCIconProps {
  size?: number;
  color?: string;
}

export function ShieldCIcon({ size = 16, color = '#fff' }: ShieldCIconProps) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name={'shield-half-full' as MciName}
        size={size}
        color={color}
      />
      <Text
        style={[
          styles.letter,
          {
            fontSize: size * 0.45,
            color,
            lineHeight: size,
          },
        ]}
        aria-hidden
      >
        C
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    position: 'absolute',
    fontWeight: '900',
    textAlign: 'center',
  },
});
