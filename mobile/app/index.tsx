import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, TextInput as RNTextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth-context';
import { signInWithGoogle, GoogleAuthError } from '@/lib/google-auth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, isLoading, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const firstNameRef = useRef<RNTextInput>(null);
  const lastNameRef = useRef<RNTextInput>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) return null;

  async function handleGoogleSignIn() {
    setError('');
    setIsGoogleLoading(true);
    try {
      const profile = await signInWithGoogle();
      await login(profile.email, profile.firstName || undefined, profile.lastName || undefined);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      if (e instanceof GoogleAuthError) {
        if (e.code === 'cancelled') {
          setError('Sign-in was cancelled.');
        } else if (e.code === 'missing_client_id') {
          setError('Google sign-in is not configured yet. Use email sign-in below.');
        } else {
          setError(e.message);
        }
      } else {
        setError('Google sign-in failed. Please try again or use email below.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await login(email.trim(), firstName.trim() || undefined, lastName.trim() || undefined);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('Network')) {
        setError('Network error — check your connection and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.backgroundGradientTop, Colors.background, Colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.content, { paddingTop: insets.top + webTopInset + 40, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 20 }]}>

          <Animated.View entering={FadeInUp.duration(800)} style={styles.headerSection}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={[Colors.primaryLight, Colors.primaryDark]}
                style={styles.iconGradient}
              >
                <MaterialCommunityIcons name="cards-playing-outline" size={48} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={styles.title}>Wisdom and Chance Mobile</Text>
            <Text style={styles.subtitle}>Master the elements. Build your deck. Battle for glory.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(800).delay(200)} style={styles.formSection}>
            <View style={styles.elementRow}>
              <View style={[styles.elementDot, { backgroundColor: Colors.fire }]} />
              <View style={[styles.elementDot, { backgroundColor: Colors.water }]} />
              <View style={[styles.elementDot, { backgroundColor: Colors.earth }]} />
              <View style={[styles.elementDot, { backgroundColor: Colors.air }]} />
              <View style={[styles.elementDot, { backgroundColor: Colors.nature }]} />
            </View>

            {/* Google Sign-In */}
            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.googleButtonPressed,
                isGoogleLoading && styles.googleButtonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading || isSubmitting}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="#1f2937" />
              ) : (
                <>
                  <MaterialCommunityIcons name="google" size={20} color="#EA4335" />
                  <Text style={styles.googleButtonText}>Sign in with Google</Text>
                </>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign in with email</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email hint */}
            <View style={styles.hintBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.hintText}>
                Use the same email address linked to your Google account on the web version.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="Your Google account email"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => firstNameRef.current?.focus()}
              />

              <Text style={styles.optionalLabel}>Display name (optional — leave blank if you have an existing account)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  ref={firstNameRef}
                  style={[styles.input, styles.halfInput]}
                  placeholder="First name"
                  placeholderTextColor={Colors.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
                <TextInput
                  ref={lastNameRef}
                  style={[styles.input, styles.halfInput]}
                  placeholder="Last name"
                  placeholderTextColor={Colors.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>

            {!!error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
                isSubmitting && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isSubmitting || isGoogleLoading}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                style={styles.loginButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Enter the Arena</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  keyboardView: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },

  headerSection: { alignItems: 'center', marginBottom: 40 },
  iconContainer: { marginBottom: 20 },
  iconGradient: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },

  formSection: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  elementRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  elementDot: { width: 8, height: 8, borderRadius: 4 },

  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  googleButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  googleButtonDisabled: { opacity: 0.6 },
  googleButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#1f2937',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  dividerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },

  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  hintText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  inputGroup: { gap: 10, marginBottom: 16 },
  inputRow: { flexDirection: 'row', gap: 12 },
  input: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  halfInput: { flex: 1 },
  optionalLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    paddingHorizontal: 4,
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.error,
    flex: 1,
  },

  loginButton: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  loginButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  loginButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: '#fff',
  },
});
