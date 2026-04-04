import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { Component, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Platform, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/lib/auth-context";

SplashScreen.preventAutoHideAsync().catch(() => {});

class SimpleErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0D0D14', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 12 }}>Something went wrong</Text>
          <Text selectable style={{ color: '#f87171', fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
            {this.state.error.message}
          </Text>
          <Text selectable style={{ color: '#888', fontSize: 10, textAlign: 'center', marginBottom: 20, maxHeight: 200 }}>
            {this.state.error.stack?.slice(0, 500)}
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={{ backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

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
      <Stack.Screen name="challenges" options={{ presentation: 'modal' }} />
      <Stack.Screen name="game/pvp-board" />
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
        setFontTimeout(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded || fontTimeout || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontTimeout, fontError]);

  if (!fontsLoaded && !fontTimeout && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D0D14', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={{ color: '#888', marginTop: 16, fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <SimpleErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <View style={{ flex: 1 }}>
            <StatusBar style="light" />
            <RootLayoutNav />
          </View>
        </AuthProvider>
      </QueryClientProvider>
    </SimpleErrorBoundary>
  );
}
