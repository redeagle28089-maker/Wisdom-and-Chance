import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export interface GoogleProfile {
  email: string;
  firstName: string;
  lastName: string;
}

export class GoogleAuthError extends Error {
  constructor(public code: 'cancelled' | 'missing_client_id' | 'network' | 'unknown', message: string) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

export async function signInWithGoogle(): Promise<GoogleProfile> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new GoogleAuthError('missing_client_id', 'Google Client ID is not configured. Please add EXPO_PUBLIC_GOOGLE_CLIENT_ID to your environment secrets.');
  }

  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
  console.log('[GoogleAuth] Redirect URI (add this to Google Cloud Console):', redirectUri);

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    usePKCE: true,
  });

  let result: AuthSession.AuthSessionResult;
  try {
    result = await request.promptAsync(GOOGLE_DISCOVERY);
  } catch (e) {
    throw new GoogleAuthError('network', 'Failed to open Google sign-in. Check your connection and try again.');
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new GoogleAuthError('cancelled', 'Sign-in was cancelled.');
  }

  if (result.type !== 'success' || !result.params?.code) {
    throw new GoogleAuthError('unknown', 'Google sign-in did not complete successfully.');
  }

  let tokenResponse: AuthSession.TokenResponse;
  try {
    tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId,
        code: result.params.code,
        redirectUri,
        extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : {},
      },
      GOOGLE_DISCOVERY
    );
  } catch {
    throw new GoogleAuthError('network', 'Failed to complete sign-in with Google. Please try again.');
  }

  const accessToken = tokenResponse.accessToken;
  if (!accessToken) {
    throw new GoogleAuthError('unknown', 'No access token received from Google.');
  }

  let profile: { email?: string; given_name?: string; family_name?: string };
  try {
    const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Profile fetch failed');
    profile = await res.json();
  } catch {
    throw new GoogleAuthError('network', 'Could not retrieve your Google profile. Please try again.');
  }

  if (!profile.email) {
    throw new GoogleAuthError('unknown', 'Google did not return your email address. Please try again.');
  }

  return {
    email: profile.email,
    firstName: profile.given_name ?? '',
    lastName: profile.family_name ?? '',
  };
}
