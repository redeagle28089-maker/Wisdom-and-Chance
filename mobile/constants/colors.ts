const Colors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceLight: '#334155',
  surfaceBorder: '#334155',
  card: '#1e293b',
  cardBorder: '#475569',

  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  primary: '#9333ea',
  primaryLight: '#a855f7',
  primaryDark: '#7e22ce',
  backgroundGradientTop: '#1e1b4b',

  fire: '#ef4444',
  fireLight: '#fca5a5',
  fireDark: '#dc2626',
  fireBg: 'rgba(239, 68, 68, 0.15)',

  water: '#3b82f6',
  waterLight: '#93c5fd',
  waterDark: '#2563eb',
  waterBg: 'rgba(59, 130, 246, 0.15)',

  earth: '#d97706',
  earthLight: '#fcd34d',
  earthDark: '#b45309',
  earthBg: 'rgba(217, 119, 6, 0.15)',

  air: '#94a3b8',
  airLight: '#cbd5e1',
  airDark: '#64748b',
  airBg: 'rgba(148, 163, 184, 0.15)',

  nature: '#22c55e',
  natureLight: '#86efac',
  natureDark: '#16a34a',
  natureBg: 'rgba(34, 197, 94, 0.15)',

  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',

  tabIconDefault: '#64748b',
  tint: '#9333ea',

  light: {
    text: '#e2e8f0',
    background: '#0f172a',
    tint: '#9333ea',
    tabIconDefault: '#64748b',
    tabIconSelected: '#9333ea',
  },
};

export function getElementColor(element: string): string {
  switch (element.toLowerCase()) {
    case 'fire': return Colors.fire;
    case 'water': return Colors.water;
    case 'earth': return Colors.earth;
    case 'air': return Colors.air;
    case 'nature': return Colors.nature;
    default: return Colors.primary;
  }
}

export function getElementBg(element: string): string {
  switch (element.toLowerCase()) {
    case 'fire': return Colors.fireBg;
    case 'water': return Colors.waterBg;
    case 'earth': return Colors.earthBg;
    case 'air': return Colors.airBg;
    case 'nature': return Colors.natureBg;
    default: return 'rgba(147, 51, 234, 0.15)';
  }
}

export function getElementLightColor(element: string): string {
  switch (element.toLowerCase()) {
    case 'fire': return Colors.fireLight;
    case 'water': return Colors.waterLight;
    case 'earth': return Colors.earthLight;
    case 'air': return Colors.airLight;
    case 'nature': return Colors.natureLight;
    default: return Colors.primaryLight;
  }
}

export default Colors;
