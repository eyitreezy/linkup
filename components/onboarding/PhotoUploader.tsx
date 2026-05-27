import { authSoftLabelStyle } from '@/components/Input';
import { onboarding } from '@/components/onboarding/onboardingTheme';
import { colors, radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'react-native';
import { MotiView } from 'moti';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  localUris: string[];
  remoteUrls: string[];
  onChangeLocal: (uris: string[]) => void;
  onRemoveLocal: (index: number) => void;
  onRemoveRemote: (index: number) => void;
  maxPhotos?: number;
};

/** Same as active chips / CTA gradients. */
const ADD_TILE_GRADIENT = [colors.primary, '#8B7CE8', colors.secondary] as const;

export function PhotoUploader({
  localUris,
  remoteUrls,
  onChangeLocal,
  onRemoveLocal,
  onRemoveRemote,
  maxPhotos = 6,
}: Props) {
  const allCount = localUris.length + remoteUrls.length;

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
  }

  return (
    <View>
      <Text style={[authSoftLabelStyle, styles.labelSpacing]}>Photos</Text>
      <Text style={styles.hint}>Add at least one — tap to pick from your library.</Text>
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
          <LinearGradient
            colors={[...ADD_TILE_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addTile}
          >
            <Ionicons name="add" size={36} color="#FFFFFF" />
            <Text style={styles.addLabel}>Add</Text>
          </LinearGradient>
        </Pressable>
        {remoteUrls.map((uri, i) => (
          <MotiView key={`r-${uri}-${i}`} from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <View style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              <Pressable style={styles.remove} onPress={() => onRemoveRemote(i)} hitSlop={8}>
                <Ionicons name="close-circle" size={22} color="#fff" />
              </Pressable>
            </View>
          </MotiView>
        ))}
        {localUris.map((uri, i) => (
          <MotiView key={`l-${uri}-${i}`} from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <View style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              <Pressable style={styles.remove} onPress={() => onRemoveLocal(i)} hitSlop={8}>
                <Ionicons name="close-circle" size={22} color="#fff" />
              </Pressable>
            </View>
          </MotiView>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  labelSpacing: { marginBottom: 4 },
  hint: { fontSize: 12, color: onboarding.muted, marginBottom: onboarding.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  addTileOuter: {
    borderRadius: onboarding.radius2xl,
    overflow: 'hidden',
  },
  addTilePressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  addTileDisabled: { opacity: 0.4 },
  addTile: {
    width: 108,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', marginTop: 4, letterSpacing: 0.2 },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 108,
    height: 132,
    borderRadius: onboarding.radius2xl,
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: '#D8DCE6',
  },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.button,
  },
});
