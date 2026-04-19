/**
 * User avatar — image URL or initials fallback.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

export function Avatar({
  uri,
  name,
  size = 44,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
}) {
  const initial = (name || '?').slice(0, 1).toUpperCase();
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.fallback, { fontSize: size * 0.4 }]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: { color: colors.text, fontWeight: '700' },
});
