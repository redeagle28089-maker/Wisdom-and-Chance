import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const WS_URL = 'wss://wisdom-and-chance.replit.app/ws';
const TOKEN_KEY = 'wc_jwt_token';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;

type MessageHandler = (data: any) => void;

async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export interface GameAction {
  type: string;
  [key: string]: any;
}

export interface WebSocketManager {
  isConnected: boolean;
  isAuthenticated: boolean;
  send: (type: string, payload?: any) => void;
  subscribe: (type: string, handler: MessageHandler) => () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  joinGame: (gameId: string) => void;
  leaveGame: (gameId: string) => void;
  sendRoomMessage: (roomId: string, message: string) => void;
  sendGameMessage: (gameId: string, message: string) => void;
  selectDeck: (roomId: string, deckId: string) => void;
  toggleReady: (roomId: string) => void;
  sendGameAction: (gameId: string, action: GameAction) => void;
  sendEmote: (roomId: string, emote: string) => void;
}

export function useWebSocket(enabled: boolean = true): WebSocketManager {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY);
  const mountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const dispatch = useCallback((type: string, data: any) => {
    const handlers = handlersRef.current.get(type);
    if (handlers) {
      handlers.forEach(h => h(data));
    }
    const wildcardHandlers = handlersRef.current.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(h => h(data));
    }
  }, []);

  const connect = useCallback(async () => {
    if (!mountedRef.current || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = await getToken();
    if (!token) return;

    try {
      const wsUrl = `${WS_URL}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setIsConnected(true);
        reconnectDelayRef.current = RECONNECT_DELAY;

        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const msgType = data.type;
          if (!msgType) return;

          if (msgType === 'auth_success') {
            setIsAuthenticated(true);
          } else if (msgType === 'auth_error') {
            setIsAuthenticated(false);
          }

          dispatch(msgType, data);
        } catch {}
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        setIsConnected(false);
        setIsAuthenticated(false);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        if (mountedRef.current && enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, MAX_RECONNECT_DELAY);
            connect();
          }, reconnectDelayRef.current);
        }
      };
    } catch {}
  }, [enabled, clearTimers, dispatch]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && enabled) {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          connect();
        }
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimers();
      sub.remove();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setIsAuthenticated(false);
    };
  }, [enabled, connect, clearTimers]);

  const send = useCallback((type: string, payload?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  const subscribe = useCallback((type: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    send('join_room', { roomId });
  }, [send]);

  const leaveRoom = useCallback((roomId: string) => {
    send('leave_room', { roomId });
  }, [send]);

  const joinGame = useCallback((gameId: string) => {
    send('join_game', { gameId });
  }, [send]);

  const leaveGame = useCallback((gameId: string) => {
    send('leave_game', { gameId });
  }, [send]);

  const sendRoomMessage = useCallback((roomId: string, message: string) => {
    send('room_message', { roomId, message });
  }, [send]);

  const sendGameMessage = useCallback((gameId: string, message: string) => {
    send('game_message', { gameId, message });
  }, [send]);

  const selectDeck = useCallback((roomId: string, deckId: string) => {
    send('select_deck', { roomId, deckId });
  }, [send]);

  const toggleReady = useCallback((roomId: string) => {
    send('toggle_ready', { roomId });
  }, [send]);

  const sendGameAction = useCallback((gameId: string, action: GameAction) => {
    send('game_action', { gameId, action });
  }, [send]);

  const sendEmote = useCallback((roomId: string, emote: string) => {
    send('send_emote', { roomId, emote });
  }, [send]);

  return {
    isConnected,
    isAuthenticated,
    send,
    subscribe,
    joinRoom,
    leaveRoom,
    joinGame,
    leaveGame,
    sendRoomMessage,
    sendGameMessage,
    selectDeck,
    toggleReady,
    sendGameAction,
    sendEmote,
  };
}
