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
  rarity?: string;
  trait: string | null;
  traitValue: number | null;
  buffModifier: number;
  buffColor: string | null;
  debuffModifier: number;
  debuffColor: string | null;
  description?: string;
  imageUrl?: string;
  isCommander: boolean;
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
    value?: number;
    target?: string;
  };
}

export interface Commander {
  id: string;
  name: string;
  element: string;
  title: string;
  description: string;
  imageUrl?: string;
  abilities: CommanderAbility[];
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

export interface GameRecord {
  id: string;
  result?: string;
  winner?: string;
  createdAt?: string;
  mode?: string;
  opponent?: string;
}
