import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
  active?: boolean;
};

export function MatchMakerTabIcon({ size = 24, color = '#C8BDB8', active = false }: Props) {
  const sw = active ? 2 : 1.5;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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
