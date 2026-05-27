/**
 * Persisted chat thread look — presets, optional wallpaper, readable text sizing.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/constants/theme';

const STORAGE_KEY = 'linkup.chatAppearance.v1';

export type ChatAppearancePresetId = 'default' | 'midnight' | 'ocean' | 'sunset' | 'forest' | 'paper';

export type ChatFontScale = 's' | 'm' | 'l';
export type ChatFontEmphasis = 'normal' | 'bold';

export type ChatAppearanceState = {
  presetId: ChatAppearancePresetId;
  /** Local file:// or content:// from image picker */
  backgroundImageUri: string | null;
  fontScale: ChatFontScale;
  fontEmphasis: ChatFontEmphasis;
};

export type ChatAppearancePreset = {
  id: ChatAppearancePresetId;
  label: string;
  /** Full-screen gradient (4 stops, matches discover-style threads) */
  threadGradient: [string, string, string, string];
  locations?: [number, number, number, number];
  mineBubble: [string, string, string];
  themBubble: [string, string, string];
  themBubbleBorder: string;
  textMine: string;
  textThem: string;
  editedMine: string;
  editedThem: string;
  metaTimeMine: string;
  metaTimeThem: string;
  metaTick: string;
  metaRead: string;
  /** Bottom composer chrome */
  composerBg: string;
  composerBorder: string;
  sendActive: [string, string];
  headerHairline: string;
  /** Single-line composer field inside sheet */
  composerInputBg: string;
  composerInputText: string;
  composerInputBorder: string;
  composerAttachIcon: string;
  composerInputPlaceholder: string;
};

export const CHAT_APPEARANCE_PRESETS: Record<ChatAppearancePresetId, ChatAppearancePreset> = {
  default: {
    id: 'default',
    label: 'Lavender',
    threadGradient: ['#EDE8FF', '#FFF5F8', '#E8FAF4', colors.discoveryGradientBottom],
    locations: [0, 0.3, 0.55, 1],
    mineBubble: [colors.primary, '#9D5CFF', colors.secondary],
    themBubble: ['#FFFFFF', '#F4F0FF', '#FFF5F8'],
    themBubbleBorder: 'rgba(108, 99, 255, 0.14)',
    textMine: '#FFFFFF',
    textThem: colors.text,
    editedMine: 'rgba(255,255,255,0.75)',
    editedThem: colors.textMuted,
    metaTimeMine: 'rgba(255,255,255,0.72)',
    metaTimeThem: colors.textMuted,
    metaTick: 'rgba(255,255,255,0.85)',
    metaRead: 'rgba(200, 230, 255, 0.95)',
    composerBg: 'rgba(255,255,255,0.97)',
    composerBorder: 'rgba(108, 99, 255, 0.28)',
    sendActive: [colors.primary, colors.secondary],
    headerHairline: 'rgba(108, 99, 255, 0.1)',
    composerInputBg: 'rgba(255,255,255,0.98)',
    composerInputText: colors.text,
    composerInputBorder: 'rgba(108, 99, 255, 0.18)',
    composerAttachIcon: colors.primary,
    composerInputPlaceholder: 'rgba(15,23,42,0.38)',
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    threadGradient: ['#0F172A', '#1E293B', '#312E81', '#4C1D95'],
    mineBubble: ['#6366F1', '#7C3AED', '#EC4899'],
    themBubble: ['#1E293B', '#334155', '#1E293B'],
    themBubbleBorder: 'rgba(148, 163, 184, 0.35)',
    textMine: '#FFFFFF',
    textThem: '#F1F5F9',
    editedMine: 'rgba(255,255,255,0.7)',
    editedThem: '#94A3B8',
    metaTimeMine: 'rgba(255,255,255,0.65)',
    metaTimeThem: '#94A3B8',
    metaTick: 'rgba(255,255,255,0.8)',
    metaRead: '#A5B4FC',
    composerBg: 'rgba(15,23,42,0.94)',
    composerBorder: 'rgba(99, 102, 241, 0.45)',
    sendActive: ['#6366F1', '#EC4899'],
    headerHairline: 'rgba(148, 163, 184, 0.2)',
    composerInputBg: 'rgba(30,41,59,0.92)',
    composerInputText: '#F1F5F9',
    composerInputBorder: 'rgba(148, 163, 184, 0.35)',
    composerAttachIcon: '#A5B4FC',
    composerInputPlaceholder: 'rgba(241,245,249,0.45)',
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    threadGradient: ['#ECFEFF', '#E0F2FE', '#DBEAFE', '#CFFAFE'],
    mineBubble: ['#0284C7', '#0369A1', '#7C3AED'],
    themBubble: ['#FFFFFF', '#F0F9FF', '#E0F2FE'],
    themBubbleBorder: 'rgba(14, 165, 233, 0.25)',
    textMine: '#FFFFFF',
    textThem: '#0F172A',
    editedMine: 'rgba(255,255,255,0.78)',
    editedThem: colors.textMuted,
    metaTimeMine: 'rgba(255,255,255,0.75)',
    metaTimeThem: colors.textMuted,
    metaTick: 'rgba(255,255,255,0.9)',
    metaRead: '#BAE6FD',
    composerBg: 'rgba(255,255,255,0.96)',
    composerBorder: 'rgba(14, 165, 233, 0.35)',
    sendActive: ['#0284C7', '#7C3AED'],
    headerHairline: 'rgba(14, 165, 233, 0.2)',
    composerInputBg: 'rgba(255,255,255,0.98)',
    composerInputText: '#0F172A',
    composerInputBorder: 'rgba(14, 165, 233, 0.22)',
    composerAttachIcon: '#0284C7',
    composerInputPlaceholder: 'rgba(15,23,42,0.42)',
  },
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    threadGradient: ['#FFF1F2', '#FFEDD5', '#FDE68A', '#FBCFE8'],
    mineBubble: ['#EA580C', '#DB2777', '#7C3AED'],
    themBubble: ['#FFFFFF', '#FFFBEB', '#FEF3C7'],
    themBubbleBorder: 'rgba(234, 88, 12, 0.2)',
    textMine: '#FFFFFF',
    textThem: '#431407',
    editedMine: 'rgba(255,255,255,0.8)',
    editedThem: '#78350F',
    metaTimeMine: 'rgba(255,255,255,0.75)',
    metaTimeThem: '#92400E',
    metaTick: 'rgba(255,255,255,0.9)',
    metaRead: '#FDE68A',
    composerBg: 'rgba(255,255,255,0.97)',
    composerBorder: 'rgba(219, 39, 119, 0.3)',
    sendActive: ['#EA580C', '#DB2777'],
    headerHairline: 'rgba(234, 88, 12, 0.18)',
    composerInputBg: 'rgba(255,255,255,0.98)',
    composerInputText: '#431407',
    composerInputBorder: 'rgba(234, 88, 12, 0.2)',
    composerAttachIcon: '#EA580C',
    composerInputPlaceholder: 'rgba(67,20,7,0.45)',
  },
  forest: {
    id: 'forest',
    label: 'Forest',
    threadGradient: ['#F0FDF4', '#DCFCE7', '#D1FAE5', '#ECFCCB'],
    mineBubble: ['#059669', '#0D9488', '#6366F1'],
    themBubble: ['#FFFFFF', '#F0FDF4', '#ECFDF5'],
    themBubbleBorder: 'rgba(16, 185, 129, 0.22)',
    textMine: '#FFFFFF',
    textThem: '#14532D',
    editedMine: 'rgba(255,255,255,0.78)',
    editedThem: '#166534',
    metaTimeMine: 'rgba(255,255,255,0.72)',
    metaTimeThem: '#15803D',
    metaTick: 'rgba(255,255,255,0.88)',
    metaRead: '#BBF7D0',
    composerBg: 'rgba(255,255,255,0.97)',
    composerBorder: 'rgba(5, 150, 105, 0.28)',
    sendActive: ['#059669', '#6366F1'],
    headerHairline: 'rgba(16, 185, 129, 0.18)',
    composerInputBg: 'rgba(255,255,255,0.98)',
    composerInputText: '#14532D',
    composerInputBorder: 'rgba(5, 150, 105, 0.22)',
    composerAttachIcon: '#059669',
    composerInputPlaceholder: 'rgba(20,83,45,0.45)',
  },
  paper: {
    id: 'paper',
    label: 'Paper',
    threadGradient: ['#FAFAF9', '#F5F5F4', '#E7E5E4', '#D6D3D1'],
    mineBubble: [colors.primary, '#57534E', colors.secondary],
    themBubble: ['#FFFFFF', '#FAFAF9', '#F5F5F4'],
    themBubbleBorder: 'rgba(68, 64, 60, 0.12)',
    textMine: '#FFFFFF',
    textThem: '#292524',
    editedMine: 'rgba(255,255,255,0.75)',
    editedThem: '#78716C',
    metaTimeMine: 'rgba(255,255,255,0.72)',
    metaTimeThem: '#78716C',
    metaTick: 'rgba(255,255,255,0.88)',
    metaRead: '#E7E5E4',
    composerBg: 'rgba(255,255,255,0.98)',
    composerBorder: 'rgba(68, 64, 60, 0.18)',
    sendActive: [colors.primary, colors.secondary],
    headerHairline: 'rgba(68, 64, 60, 0.12)',
    composerInputBg: 'rgba(255,255,255,0.98)',
    composerInputText: '#292524',
    composerInputBorder: 'rgba(68, 64, 60, 0.15)',
    composerAttachIcon: colors.primary,
    composerInputPlaceholder: 'rgba(41,37,36,0.45)',
  },
};

/** Stable UI order for preset picker grids */
export const CHAT_APPEARANCE_PRESET_ORDER: ChatAppearancePresetId[] = [
  'default',
  'midnight',
  'ocean',
  'sunset',
  'forest',
  'paper',
];

export const DEFAULT_CHAT_APPEARANCE: ChatAppearanceState = {
  presetId: 'default',
  backgroundImageUri: null,
  fontScale: 'm',
  fontEmphasis: 'normal',
};

export function fontSizeFromScale(scale: ChatFontScale): number {
  if (scale === 's') return 15;
  if (scale === 'l') return 18;
  return 16;
}

export function fontWeightFromEmphasis(e: ChatFontEmphasis): '400' | '700' {
  return e === 'bold' ? '700' : '400';
}

export async function loadChatAppearance(): Promise<ChatAppearanceState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CHAT_APPEARANCE };
    const parsed = JSON.parse(raw) as Partial<ChatAppearanceState>;
    return {
      ...DEFAULT_CHAT_APPEARANCE,
      ...parsed,
      presetId: parsed.presetId ?? DEFAULT_CHAT_APPEARANCE.presetId,
      fontScale: parsed.fontScale ?? DEFAULT_CHAT_APPEARANCE.fontScale,
      fontEmphasis: parsed.fontEmphasis ?? DEFAULT_CHAT_APPEARANCE.fontEmphasis,
      backgroundImageUri:
        typeof parsed.backgroundImageUri === 'string' ? parsed.backgroundImageUri : null,
    };
  } catch {
    return { ...DEFAULT_CHAT_APPEARANCE };
  }
}

export async function saveChatAppearance(state: ChatAppearanceState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function presetForState(state: ChatAppearanceState): ChatAppearancePreset {
  return CHAT_APPEARANCE_PRESETS[state.presetId] ?? CHAT_APPEARANCE_PRESETS.default;
}

export type ResolvedChatBubbleTheme = {
  mineBubble: [string, string, string];
  themBubble: [string, string, string];
  themBubbleBorder: string;
  textMine: string;
  textThem: string;
  editedMine: string;
  editedThem: string;
  metaTimeMine: string;
  metaTimeThem: string;
  metaTick: string;
  metaRead: string;
  fontSize: number;
  fontWeight: '400' | '700';
};

export function resolveBubbleTheme(preset: ChatAppearancePreset, state: ChatAppearanceState): ResolvedChatBubbleTheme {
  return {
    mineBubble: preset.mineBubble,
    themBubble: preset.themBubble,
    themBubbleBorder: preset.themBubbleBorder,
    textMine: preset.textMine,
    textThem: preset.textThem,
    editedMine: preset.editedMine,
    editedThem: preset.editedThem,
    metaTimeMine: preset.metaTimeMine,
    metaTimeThem: preset.metaTimeThem,
    metaTick: preset.metaTick,
    metaRead: preset.metaRead,
    fontSize: fontSizeFromScale(state.fontScale),
    fontWeight: fontWeightFromEmphasis(state.fontEmphasis),
  };
}
