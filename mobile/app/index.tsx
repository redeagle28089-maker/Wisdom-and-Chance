import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, TextInput as RNTextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useAuth } from '@/lib/auth-context';

let Animated: any;
let FadeInDown: any;
let FadeInUp: any;
try {
  const Reanimated = require('react-native-reanimated');
  Animated = Reanimated.default;
  FadeInDown = Reanimated.FadeInDown;
  FadeInUp = Reanimated.FadeInUp;
} catch {
  const RN = require('react-native');
  Animated = { View: RN.View };
  FadeInDown = undefined;
  FadeInUp = undefined;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, isLoading, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

          <Animated.View entering={FadeInUp?.duration?.(800)} style={styles.headerSection}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={[Colors.primaryLight, Colors.primaryDark]}
                style={styles.iconGradient}
              >
                <MaterialCommunityIcons name="cards-playing-outline" size={48} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={styles.title}>Wisdom &amp; Chance</Text>
            <Text style={styles.subtitle}>Master the elements. Build your deck. Battle for glory.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown?.duration?.(800)?.delay?.(200)} style={styles.formSection}>
            <View style={styles.elementRow}>
              <View style={[styles.elementDot, { backgroundColor: Colors.fire }]} />
              <View style={[styles.elementDot, { backgroundColor: Colors.water }]} />
              <View style={[styles.elementDot, { backgroundColor: Colors.earth }]} />
              <View style={[styles.elementDot, { backgroundColor: Colors.air }]} />
              <View style={[styles.elementDot, { backgroundColor: Colors.nature }]} />
            </View>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="Email address"
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
              disabled={isSubmitting}
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
    marginBottom: 28,
  },
  elementDot: { width: 10, height: 10, borderRadius: 5 },

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
