import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  color: string;
  size?: number;
};

export function MatchMakerTabIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="20" stroke={color} strokeWidth="2.5" fill="none" />
      <Path
        d="M24 33s-9-6.5-9-12.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3C33 26.5 24 33 24 33z"
        fill={color}
      />
    </Svg>
  );
}
