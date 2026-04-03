import { fetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REMOTE_URL = 'https://wisdom-and-chance.replit.app';
const LOCAL_PROXY = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : 'http://localhost:5000';
const BASE_URL = Platform.OS === 'web' ? LOCAL_PROXY : REMOTE_URL;
const TOKEN_KEY = 'wc_jwt_token';
const USER_KEY = 'wc_user_data';

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch {}
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export interface Card {
  id: string;
  name: string;
  element: string;
  power: number;
  trait: string | null;
  traitValue: number | null;
  buffModifier: number;
  buffColor: string | null;
  debuffModifier: number;
  debuffColor: string | null;
  description: string;
  imageUrl: string | null;
  isCommander: boolean;
}

export interface Commander {
  id: string;
  name: string;
  element: string;
  title: string;
  description: string;
  abilities: CommanderAbility[];
}

export interface CommanderAbility {
  id: string;
  name: string;
  description: string;
  phase: string;
  victoryCost: number;
  withdrawalCost: number;
  effect: {
    type: string;
    value: number;
    target: string;
  };
}

export interface SavedDeck {
  id: string;
  name: string;
  commanderId: string;
  cardIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PlayerStats {
  totalGames?: number;
  wins?: number;
  losses?: number;
  winRate?: number;
  favoriteElement?: string;
}

export interface PlayerRating {
  rating?: number;
  rank?: string;
  tier?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requirement: number;
  xpReward: number;
  isSecret: boolean;
  createdAt: string;
}

export interface PlayerAchievement {
  id: string;
  achievementId: string;
  progress: number;
  completed: boolean;
  completedAt: string | null;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  rating: number;
  wins: number;
  losses: number;
  totalGames: number;
  profileImageUrl: string | null;
}

export interface Friend {
  id: string;
  friendId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isOnline: boolean;
  lastSeen: string | null;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromEmail: string;
  fromFirstName: string | null;
  fromLastName: string | null;
  toUserId: string;
  status: string;
  createdAt: string;
}

export interface FriendMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
}

export interface GameRoom {
  id: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  status: string;
  players: RoomPlayer[];
  createdAt: string;
}

export interface RoomPlayer {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isReady: boolean;
  deckId: string | null;
}

export interface DeckSuggestion {
  name: string;
  commanderId: string;
  cardIds: string[];
  strategy: string;
  elementFocus: string;
}

export interface DailyChallenge {
  id: string;
  name: string;
  description: string;
  requirement: number;
  xpReward: number;
  type: string;
  expiresAt: string;
}

export interface PlayerChallenge {
  id: string;
  challengeId: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

async function getToken(): Promise<string | null> {
  try {
    return await storage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await storage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    const { clearTokenCache } = require('../components/AuthImage');
    clearTokenCache();
  } catch {}
  try {
    await storage.deleteItem(TOKEN_KEY);
    await storage.deleteItem(USER_KEY);
  } catch {}
}

export async function saveUserData(user: User): Promise<void> {
  await storage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getSavedUser(): Promise<User | null> {
  try {
    const data = await storage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: boolean;
  } = {}
): Promise<T> {
  const { method = 'GET', body, auth = false } = options;
  const headers: Record<string, string> = {};

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return {} as T;
}

export const api = {
  login: (data: { email: string; firstName?: string; lastName?: string; provider?: string }) =>
    apiRequest<{ token: string; user: User }>('/api/mobile/auth/login', { method: 'POST', body: data }),

  refreshToken: () =>
    apiRequest<{ token: string }>('/api/mobile/auth/refresh', { method: 'POST', auth: true }),

  getMe: () =>
    apiRequest<User>('/api/mobile/auth/me', { auth: true }),

  getCards: () =>
    apiRequest<Card[]>('/api/cards'),

  getCard: (id: string) =>
    apiRequest<Card>(`/api/cards/${id}`),

  getCardsByElement: (element: string) =>
    apiRequest<Card[]>(`/api/cards/element/${element}`),

  getCommanders: () =>
    apiRequest<Commander[]>('/api/commanders'),

  getCommander: (id: string) =>
    apiRequest<Commander>(`/api/commanders/${id}`),

  getUserDecks: () =>
    apiRequest<SavedDeck[]>('/api/user-decks', { auth: true }),

  getDeck: (id: string) =>
    apiRequest<SavedDeck>(`/api/user-decks/${id}`, { auth: true }),

  createDeck: (data: { name: string; commanderId: string; cardIds: string[] }) =>
    apiRequest<SavedDeck>('/api/user-decks', { method: 'POST', body: data, auth: true }),

  updateDeck: (id: string, data: { name?: string; commanderId?: string; cardIds?: string[] }) =>
    apiRequest<SavedDeck>(`/api/user-decks/${id}`, { method: 'PATCH', body: data, auth: true }),

  deleteDeck: (id: string) =>
    apiRequest<void>(`/api/user-decks/${id}`, { method: 'DELETE', auth: true }),

  getDeckSuggestions: (data?: { element?: string; strategy?: string }) =>
    apiRequest<DeckSuggestion>('/api/deck-suggestions', { method: 'POST', body: data || {}, auth: true }),

  getPlayerStats: () =>
    apiRequest<PlayerStats>('/api/player-stats', { auth: true }),

  getPlayerRating: () =>
    apiRequest<PlayerRating>('/api/player-rating', { auth: true }),

  getLeaderboard: () =>
    apiRequest<LeaderboardEntry[]>('/api/leaderboard'),

  getAchievements: () =>
    apiRequest<Achievement[]>('/api/achievements'),

  getPlayerAchievements: () =>
    apiRequest<PlayerAchievement[]>('/api/player-achievements', { auth: true }),

  getDailyChallenges: () =>
    apiRequest<DailyChallenge[]>('/api/daily-challenges'),

  getPlayerChallenges: () =>
    apiRequest<PlayerChallenge[]>('/api/player-challenges', { auth: true }),

  claimChallenge: (id: string) =>
    apiRequest<void>(`/api/player-challenges/${id}/claim`, { method: 'POST', auth: true }),

  getFriends: () =>
    apiRequest<Friend[]>('/api/friends', { auth: true }),

  getFriendRequests: () =>
    apiRequest<FriendRequest[]>('/api/friend-requests', { auth: true }),

  sendFriendRequest: (email: string) =>
    apiRequest<void>('/api/friend-requests', { method: 'POST', body: { email }, auth: true }),

  acceptFriendRequest: (id: string) =>
    apiRequest<void>(`/api/friend-requests/${id}/accept`, { method: 'POST', auth: true }),

  declineFriendRequest: (id: string) =>
    apiRequest<void>(`/api/friend-requests/${id}/decline`, { method: 'POST', auth: true }),

  removeFriend: (friendId: string) =>
    apiRequest<void>(`/api/friends/${friendId}`, { method: 'DELETE', auth: true }),

  getFriendMessages: (friendId: string) =>
    apiRequest<FriendMessage[]>(`/api/friend-messages/${friendId}`, { auth: true }),

  sendFriendMessage: (friendId: string, content: string) =>
    apiRequest<FriendMessage>(`/api/friend-messages/${friendId}`, { method: 'POST', body: { content }, auth: true }),

  searchUsers: (query: string) =>
    apiRequest<User[]>(`/api/users/search?q=${encodeURIComponent(query)}`, { auth: true }),

  getRooms: () =>
    apiRequest<GameRoom[]>('/api/rooms', { auth: true }),

  getRoom: (id: string) =>
    apiRequest<GameRoom>(`/api/rooms/${id}`, { auth: true }),

  createRoom: (data: { name: string; isPrivate?: boolean; password?: string }) =>
    apiRequest<GameRoom>('/api/rooms', { method: 'POST', body: data, auth: true }),

  joinRoom: (id: string) =>
    apiRequest<void>(`/api/rooms/${id}/join`, { method: 'POST', auth: true }),

  leaveRoom: (id: string) =>
    apiRequest<void>(`/api/rooms/${id}/leave`, { method: 'POST', auth: true }),

  setReady: (id: string, deckId: string, ready?: boolean) =>
    apiRequest<void>(`/api/rooms/${id}/ready`, { method: 'POST', body: { deckId, ready: ready ?? true }, auth: true }),

  startGame: (id: string) =>
    apiRequest<void>(`/api/rooms/${id}/start`, { method: 'POST', auth: true }),

  getGames: () =>
    apiRequest<any[]>('/api/games', { auth: true }),

  exportDeck: (id: string) =>
    apiRequest<{ code: string }>(`/api/user-decks/${id}/export`, { auth: true }),

  importDeck: (code: string) =>
    apiRequest<SavedDeck>('/api/user-decks/import', { method: 'POST', body: { code }, auth: true }),

  updateProfile: (data: { firstName?: string; lastName?: string }) =>
    apiRequest<User>('/api/user/profile', { method: 'PATCH', body: data, auth: true }),

  healthCheck: () =>
    apiRequest<{ status: string }>('/api/health'),
};
