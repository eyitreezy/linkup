import {
  MATCHMAKER_NAV_INACTIVE_FILL,
  matchMakerNavIconBasename,
} from '@/lib/navigation/matchmakerNavIcon';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import type { ImageSourcePropType } from 'react-native';
import { View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

const NAV_SOURCES: Record<'matchmaker-active.png' | 'matchmaker-inactive.png', ImageSourcePropType> = {
  'matchmaker-active.png': require('@/assets/navigation/matchmaker-active.png'),
  'matchmaker-inactive.png': require('@/assets/navigation/matchmaker-inactive.png'),
};

type Props = {
  size?: number;
  color?: string;
  active?: boolean;
  style?: StyleProp<ViewStyle | ImageStyle>;
  /** Main tab bar only — supplied active vs inactive PNG artwork. */
  navActive?: boolean;
};

function MatchMakerNavIconMasked({
  source,
  fill,
  size,
  style,
}: {
  source: ImageSourcePropType;
  fill: string;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <MaskedView
      style={[{ width: size, height: size }, style]}
      maskElement={
        <Image
          source={source}
          style={{ width: size, height: size }}
          contentFit="contain"
          accessible={false}
        />
      }
    >
      <View style={{ width: size, height: size, backgroundColor: fill }} />
    </MaskedView>
  );
}

export function MatchMakerTabIcon({
  size = 24,
  color = '#C8BDB8',
  active = false,
  style,
  navActive,
}: Props) {
  if (navActive !== undefined) {
    if (navActive) {
      const basename = matchMakerNavIconBasename(true) as keyof typeof NAV_SOURCES;
      return (
        <Image
          source={NAV_SOURCES[basename]}
          style={[{ width: size, height: size, mixBlendMode: 'lighten' }, style]}
          contentFit="contain"
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      );
    }
    return (
      <MatchMakerNavIconMasked
        source={NAV_SOURCES['matchmaker-inactive.png']}
        fill={MATCHMAKER_NAV_INACTIVE_FILL}
        size={size}
        style={style as StyleProp<ViewStyle>}
      />
    );
  }

  const sw = active ? 2 : 1.5;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M4.5 12.8C4.5 14.5 7.8 16 12 16C16.2 16 19.5 14.5 19.5 12.8"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        opacity={0.35}
      />
      <Path
        d="M12 19C12 19 4.5 14 4.5 8.5C4.5 6.3 6.1 4.5 8.1 4.5C9.5 4.5 10.8 5.3 12 6.5C13.2 5.3 14.5 4.5 15.9 4.5C17.9 4.5 19.5 6.3 19.5 8.5C19.5 14 12 19 12 19Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
        fill={active ? color : 'none'}
        fillOpacity={active ? 0.15 : 0}
      />
      <Path
        d="M19.5 12.8C19.5 11.1 16.2 9.6 12 9.6C7.8 9.6 4.5 11.1 4.5 12.8"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </Svg>
  );
}
