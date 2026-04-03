import React, { useState, useEffect } from 'react';
import { Image, Platform, ImageStyle, StyleProp } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'wc_jwt_token';

let cachedToken: string | null = null;

async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    if (Platform.OS === 'web') {
      cachedToken = localStorage.getItem(TOKEN_KEY);
    } else {
      cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    }
    return cachedToken;
  } catch {
    return null;
  }
}

export function clearTokenCache() {
  cachedToken = null;
}

interface AuthImageProps {
  uri: string;
  fallbackUri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export default function AuthImage({ uri, fallbackUri, style, resizeMode = 'cover' }: AuthImageProps) {
  const [token, setToken] = useState<string | null>(cachedToken);
  const [useFallback, setUseFallback] = useState(false);
  const [tokenLoaded, setTokenLoaded] = useState(!!cachedToken);

  useEffect(() => {
    if (!tokenLoaded) {
      getToken().then(t => {
        setToken(t);
        setTokenLoaded(true);
      });
    }
  }, [tokenLoaded]);

  if (!tokenLoaded) {
    return <Image source={{ uri: fallbackUri }} style={style} resizeMode={resizeMode} />;
  }

  if (useFallback || !token || !uri) {
    return <Image source={{ uri: fallbackUri }} style={style} resizeMode={resizeMode} />;
  }

  return (
    <Image
      source={{
        uri,
        headers: { Authorization: `Bearer ${token}` },
      }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setUseFallback(true)}
    />
  );
}
