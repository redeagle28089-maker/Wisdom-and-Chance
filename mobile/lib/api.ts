import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

let fetchFn: typeof globalThis.fetch = globalThis.fetch.bind(globalThis);
try {
  if (Platform.OS !== 'web') {
    const expoFetch = require('expo/fetch');
    if (expoFetch?.fetch) {
      fetchFn = expoFetch.fetch;
    }
  }
} catch {
}
import type {
  User,
  Card,
  Commander,
  CommanderAbility,
  SavedDeck,
  PlayerStats,
  PlayerRating,
  Achievement,
  PlayerAchievement,
  LeaderboardEntry,
  Friend,
  FriendRequest,
  FriendMessage,
  GameRoom,
  RoomPlayer,
  DeckSuggestion,
  DailyChallenge,
  PlayerChallenge,
  GameRecord,
} from '@shared/mobile-types';

export type {
  User,
  Card,
  Commander,
  CommanderAbility,
  SavedDeck,
  PlayerStats,
  PlayerRating,
  Achievement,
  PlayerAchievement,
  LeaderboardEntry,
  Friend,
  FriendRequest,
  FriendMessage,
  GameRoom,
  RoomPlayer,
  DeckSuggestion,
  DailyChallenge,
  PlayerChallenge,
  GameRecord,
};

const REMOTE_URL = 'https://wisdom-and-chance.replit.app';

function getBaseUrl(): string {
  if (Platform.OS !== 'web') return REMOTE_URL;

  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:5000`;
  }

  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }

  return 'http://localhost:5000';
}

const BASE_URL = getBaseUrl();
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

  const res = await fetchFn(`${BASE_URL}${path}`, {
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
    apiRequest<GameRecord[]>('/api/games', { auth: true }),

  exportDeck: (id: string) =>
    apiRequest<{ code: string }>(`/api/user-decks/${id}/export`, { auth: true }),

  importDeck: (code: string) =>
    apiRequest<SavedDeck>('/api/user-decks/import', { method: 'POST', body: { code }, auth: true }),

  updateProfile: (data: { firstName?: string; lastName?: string }) =>
    apiRequest<User>('/api/user/profile', { method: 'PATCH', body: data, auth: true }),

  healthCheck: () =>
    apiRequest<{ status: string }>('/api/health'),
};
