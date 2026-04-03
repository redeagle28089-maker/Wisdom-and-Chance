import { Platform } from 'react-native';

const ART_BASE = 'https://wisdom-and-chance.replit.app/assets';
const REMOTE_URL = 'https://wisdom-and-chance.replit.app';
const LOCAL_PROXY = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : 'http://localhost:5000';
const API_BASE = Platform.OS === 'web' ? LOCAL_PROXY : REMOTE_URL;

export const ELEMENT_CARD_ART: Record<string, string> = {
  fire: `${ART_BASE}/fire_element_card_art-CVY0E2Oz.png`,
  water: `${ART_BASE}/water_element_card_art-DoFc8puz.png`,
  earth: `${ART_BASE}/earth_element_card_art-DFKomA2g.png`,
  air: `${ART_BASE}/air_element_card_art-CvArjYh_.png`,
  nature: `${ART_BASE}/nature_element_card_art-DNhvaHWr.png`,
};

export const COMMANDER_PORTRAITS: Record<string, string> = {
  fire: `${ART_BASE}/fire_commander_portrait-BQ3utqsP.png`,
  water: `${ART_BASE}/water_commander_portrait-DZksJ6uP.png`,
  earth: `${ART_BASE}/earth_commander_portrait-BnzMOiAI.png`,
  air: `${ART_BASE}/air_commander_portrait-BN-t8iDW.png`,
  nature: `${ART_BASE}/nature_commander_portrait-mhKPicbV.png`,
};

export function getCardArt(card: { imageUrl?: string | null; element: string }): string {
  if (card.imageUrl) return card.imageUrl;
  return ELEMENT_CARD_ART[card.element.toLowerCase()] ?? ELEMENT_CARD_ART.fire;
}

export function getCommanderPortrait(element: string): string {
  return COMMANDER_PORTRAITS[element.toLowerCase()] ?? COMMANDER_PORTRAITS.fire;
}

export function getCardImageUrl(cardId: string): string {
  return `${API_BASE}/api/cards/${cardId}/image`;
}

export function getCommanderImageUrl(commanderId: string): string {
  return `${API_BASE}/api/commanders/${commanderId}/image`;
}
