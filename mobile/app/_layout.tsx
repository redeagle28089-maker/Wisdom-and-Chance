import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/lib/auth-context";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="card/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="deck/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="deck/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="commander/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="suggest" options={{ presentation: 'modal' }} />
      <Stack.Screen name="room/create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="room/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="deck/view" options={{ presentation: 'modal' }} />
      <Stack.Screen name="rules" options={{ presentation: 'modal' }} />
      <Stack.Screen name="history" options={{ presentation: 'modal' }} />
      <Stack.Screen name="practice" options={{ presentation: 'modal' }} />
      <Stack.Screen name="game/board" />
      <Stack.Screen name="tutorial" options={{ presentation: 'modal' }} />
      <Stack.Screen name="lore" options={{ presentation: 'modal' }} />
      <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
      <Stack.Screen name="analytics" options={{ presentation: 'modal' }} />
      <Stack.Screen name="live-matches" options={{ presentation: 'modal' }} />
      <Stack.Screen name="about" options={{ presentation: 'modal' }} />
      <Stack.Screen name="messages/[friendId]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fontsLoaded) {
        console.warn('[layout] Font loading timed out after 5s, proceeding without custom fonts');
        setFontTimeout(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded || fontTimeout) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontTimeout]);

  useEffect(() => {
    if (fontError) {
      console.error('[layout] Font load error:', fontError);
      SplashScreen.hideAsync();
    }
  }, [fontError]);

  if (!fontsLoaded && !fontTimeout && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D0D14', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={{ color: '#888', marginTop: 16, fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <StatusBar style="light" />
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
