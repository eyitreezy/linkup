import { authSoftLabelStyle } from '@/components/Input';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { colors, radius } from '@/constants/theme';
import { PROFILE_MIN_PHOTOS_ONBOARDING } from '@/lib/profile/media/constants';
import {
  defaultPrimaryRef,
  orderedPhotoTiles,
  primaryRefAfterRemove,
  resolvePhotoUrl,
} from '@/lib/profile/media/photoOrder';
import type { PrimaryPhotoRef } from '@/lib/profile/media/types';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const ADD_TILE_GRADIENT = [colors.primary, '#8B7CE8', colors.secondary] as const;

type Props = {
  localUris: string[];
  remoteUrls: string[];
  primaryRef: PrimaryPhotoRef | null;
  onChangeLocal: (uris: string[]) => void;
  onRemoveLocal: (index: number) => void;
  onRemoveRemote: (index: number) => void;
  onPrimaryChange: (ref: PrimaryPhotoRef | null) => void;
  maxPhotos?: number;
  minPhotosHint?: number;
};

function isPrimary(
  ref: PrimaryPhotoRef | null,
  kind: 'remote' | 'local',
  index: number,
  url?: string
): boolean {
  if (!ref) return kind === 'remote' && index === 0;
  if (ref.kind === 'remote' && kind === 'remote') return ref.url === url;
  if (ref.kind === 'local' && kind === 'local') return ref.index === index;
  return false;
}

export function ProfilePhotoGallery({
  localUris,
  remoteUrls,
  primaryRef,
  onChangeLocal,
  onRemoveLocal,
  onRemoveRemote,
  onPrimaryChange,
  maxPhotos = 6,
  minPhotosHint = PROFILE_MIN_PHOTOS_ONBOARDING,
}: Props) {
  const allCount = localUris.length + remoteUrls.length;
  const photoTiles = useMemo(
    () => orderedPhotoTiles(remoteUrls, localUris, primaryRef),
    [remoteUrls, localUris, primaryRef]
  );

  async function pick() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(0, maxPhotos - allCount),
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.length) return;
    const next = [...localUris, ...res.assets.map((a) => a.uri)].slice(0, maxPhotos);
    onChangeLocal(next);
    if (!primaryRef) onPrimaryChange(defaultPrimaryRef(remoteUrls, next));
  }

  function setPrimary(kind: 'remote' | 'local', index: number, url?: string) {
    if (kind === 'remote' && url) onPrimaryChange({ kind: 'remote', url });
    else onPrimaryChange({ kind: 'local', index });
  }

  return (
    <View>
      <Text style={[authSoftLabelStyle, styles.labelSpacing]}>Photos</Text>
      <Text style={styles.hint}>
        Add at least {minPhotosHint} — tap a photo and choose Set as Primary for your main look.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable
          style={({ pressed }) => [
            styles.addTileOuter,
            allCount >= maxPhotos && styles.addTileDisabled,
            pressed && allCount < maxPhotos && styles.addTilePressed,
          ]}
          onPress={pick}
          disabled={allCount >= maxPhotos}
        >
          <LinearGradient colors={[...ADD_TILE_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addTile}>
            <Ionicons name="add" size={36} color="#FFFFFF" />
            <Text style={styles.addLabel}>Add</Text>
          </LinearGradient>
        </Pressable>

        {photoTiles.map((tile) => (
          <PhotoTile
            key={`${tile.kind}-${tile.index}-${tile.uri}`}
            uri={tile.uri}
            primary={isPrimary(primaryRef, tile.kind, tile.index, tile.uri)}
            onSetPrimary={() =>
              tile.kind === 'remote'
                ? setPrimary('remote', tile.index, tile.uri)
                : setPrimary('local', tile.index)
            }
            onRemove={() => {
              const nextRef = primaryRefAfterRemove(primaryRef, remoteUrls, localUris, {
                kind: tile.kind,
                index: tile.index,
              });
              if (tile.kind === 'remote') onRemoveRemote(tile.index);
              else onRemoveLocal(tile.index);
              onPrimaryChange(nextRef);
            }}
          />
        ))}
      </ScrollView>
      {primaryRef ? (
        <Text style={styles.primaryHint}>
          Primary: {resolvePhotoUrl(primaryRef, remoteUrls, localUris) ? '✓ set' : 'pick a photo'}
        </Text>
      ) : null}
    </View>
  );
}

function PhotoTile({
  uri,
  primary,
  onSetPrimary,
  onRemove,
}: {
  uri: string;
  primary: boolean;
  onSetPrimary: () => void;
  onRemove: () => void;
}) {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 220 }}
    >
      <Pressable onPress={onSetPrimary} style={({ pressed }) => [pressed && styles.tilePressed]}>
        <View style={[styles.thumbWrap, primary && styles.thumbWrapPrimary]}>
          {primary ? (
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryRing}
            />
          ) : null}
          <Image source={{ uri }} style={[styles.thumb, primary && styles.thumbPrimary]} />
          {primary ? (
            <View style={styles.primaryBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.primaryBadgeTxt}>Primary</Text>
            </View>
          ) : (
            <View style={styles.setPrimaryBadge}>
              <Text style={styles.setPrimaryTxt}>Set as Primary</Text>
            </View>
          )}
          <Pressable style={styles.remove} onPress={onRemove} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color="#fff" />
          </Pressable>
        </View>
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  labelSpacing: { marginBottom: 4 },
  hint: { fontSize: 12, color: onboarding.muted, marginBottom: onboarding.spacing.md, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  addTileOuter: { borderRadius: onboarding.radius2xl, overflow: 'hidden' },
  addTilePressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  addTileDisabled: { opacity: 0.4 },
  addTile: { width: 108, height: 132, alignItems: 'center', justifyContent: 'center' },
  addLabel: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
  thumbWrap: { position: 'relative', borderRadius: onboarding.radius2xl, padding: 2 },
  thumbWrapPrimary: { padding: 3 },
  primaryRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: onboarding.radius2xl,
  },
  thumb: {
    width: 108,
    height: 132,
    borderRadius: onboarding.radius2xl - 2,
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: '#D8DCE6',
  },
  thumbPrimary: {
    borderWidth: 0,
  },
  tilePressed: { opacity: 0.94 },
  primaryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(108,99,255,0.92)',
    borderRadius: radius.button,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  primaryBadgeTxt: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  setPrimaryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(26,29,38,0.55)',
    borderRadius: radius.button,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  setPrimaryTxt: { fontSize: 9, fontWeight: '800', color: '#fff', textAlign: 'center' },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.button,
  },
  primaryHint: { marginTop: 8, fontSize: 12, fontWeight: '700', color: colors.primary },
});
