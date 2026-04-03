import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { api } from '@/lib/api';

export default function CreateRoomScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');

  const createMutation = useMutation({
    mutationFn: () => api.createRoom({
      name: roomName.trim(),
      isPrivate,
      password: isPrivate && password.trim() ? password.trim() : undefined,
    }),
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/room/[id]', params: { id: room.id } });
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Create Room</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.inputSection}>
          <Text style={styles.label}>Room Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter room name..."
            placeholderTextColor={Colors.textMuted}
            value={roomName}
            onChangeText={setRoomName}
            autoFocus
          />
        </View>

        <Pressable
          style={styles.toggleRow}
          onPress={() => setIsPrivate(!isPrivate)}
        >
          <View style={styles.toggleInfo}>
            <Ionicons name="lock-closed" size={20} color={Colors.textSecondary} />
            <Text style={styles.toggleLabel}>Private Room</Text>
          </View>
          <View style={[styles.toggle, isPrivate && styles.toggleActive]}>
            <View style={[styles.toggleKnob, isPrivate && styles.toggleKnobActive]} />
          </View>
        </Pressable>

        {isPrivate && (
          <View style={styles.inputSection}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Room password..."
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.createBtn,
            !roomName.trim() && styles.createBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => createMutation.mutate()}
          disabled={!roomName.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="game-controller" size={20} color="#fff" />
              <Text style={styles.createBtnText}>Create Room</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  topBarTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.text },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  inputSection: { marginBottom: 20 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  input: {
    fontFamily: 'Inter_400Regular', fontSize: 16, color: Colors.text,
    backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.text },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceLight, justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive: { backgroundColor: Colors.primary },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  toggleKnobActive: { alignSelf: 'flex-end' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, marginTop: 8,
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#fff' },
});
