import { Avatar } from '@/components/Avatar';
import { Input, onboardingInputShadow } from '@/components/Input';
import { APP_CTA_GRADIENT } from '@/constants/gradients';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import {
  cancelInvitation,
  fetchPlanInvitations,
  searchUsersForInvitation,
  sendInvitationByEmail,
  sendInvitationToUser,
  type InvitationSearchResult,
  type PlanInvitationRow,
  type PlanInviteDetails,
} from '@/lib/plans/planInvitations';
import { invitationSearchAlreadyMemberLabel } from '@/lib/plans/invitationSearchMemberLabel';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FOOTER_BTN_HEIGHT = 50;
const FOOTER_FIELD_GAP = 20;
const SHEET_BOTTOM_INSET = 20;
/** Spacing above Find on LinkUp / Invite by email section headers. */
const SECTION_TOP_GAP = 25;

type Props = {
  planId: string;
  planDetails: PlanInviteDetails;
  availableSlots: number;
  onClose: () => void;
  visible: boolean;
  onSlotsChanged?: () => void;
};

const STATUS_BADGES: Record<
  PlanInvitationRow['status'],
  { label: string; bg: string; color: string }
> = {
  pending: { label: 'Pending', bg: 'rgba(232, 144, 8, 0.12)', color: '#92400E' },
  accepted: { label: 'Accepted', bg: 'rgba(14, 168, 114, 0.12)', color: '#047857' },
  declined: { label: 'Declined', bg: 'rgba(232, 56, 56, 0.12)', color: '#B91C1C' },
  expired: { label: 'Expired', bg: 'rgba(148, 163, 184, 0.15)', color: colors.textMuted },
  cancelled: { label: 'Cancelled', bg: 'rgba(148, 163, 184, 0.15)', color: colors.textMuted },
};

function UserSearchRow({
  user,
  onInvite,
  disabled,
  inviting,
}: {
  user: InvitationSearchResult;
  onInvite: () => void;
  disabled: boolean;
  inviting: boolean;
}) {
  const name = user.display_name?.trim() || 'LinkUp member';
  const username = user.username?.trim();

  return (
    <View style={styles.userRow}>
      <Avatar uri={user.avatar_url} name={name} size={40} />
      <View style={styles.userCopy}>
        <Text style={styles.userName} numberOfLines={1}>
          {name}
        </Text>
        {!user.already_member && username ? (
          <Text style={styles.userMetaMuted} numberOfLines={1}>
            @{username}
          </Text>
        ) : !user.already_member && user.is_kyc_verified ? (
          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.userMeta}>Verified</Text>
          </View>
        ) : !user.already_member ? (
          <Text style={styles.userMetaMuted}>Not verified yet</Text>
        ) : null}
      </View>
      {user.already_member ? (
        <Text style={styles.memberBadge}>
          {invitationSearchAlreadyMemberLabel(user.gender)}
        </Text>
      ) : user.already_invited ? (
        <Text style={styles.invitedBadge}>Invited</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onInvite}
          disabled={disabled || inviting || user.already_member}
          style={({ pressed }) => [
            styles.inviteBtn,
            (disabled || inviting || user.already_member) && styles.inviteBtnDisabled,
            pressed && !disabled && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.inviteBtnLabel}>{inviting ? 'Sending…' : 'Invite'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function SentInvitationRow({
  invitation,
  onCancel,
}: {
  invitation: PlanInvitationRow;
  onCancel: () => void;
}) {
  const badge = STATUS_BADGES[invitation.status] ?? STATUS_BADGES.pending;
  const label =
    invitation.invitee?.display_name?.trim() ||
    invitation.invitee_email ||
    'Invited user';
  const canCancel = invitation.status === 'pending';

  return (
    <View style={styles.sentRow}>
      <View style={styles.sentLeft}>
        <Avatar uri={invitation.invitee?.avatar_url} name={label} size={28} />
        <Text style={styles.sentName} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.sentActions}>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusBadgeLabel, { color: badge.color }]}>{badge.label}</Text>
        </View>
        {canCancel ? (
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelLink}>
            <Text style={styles.cancelLinkLabel}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SentInvitationsBlock({
  invitations,
  onCancel,
}: {
  invitations: PlanInvitationRow[];
  onCancel: (id: string) => void;
}) {
  if (invitations.length === 0) return null;
  return (
    <View style={styles.sentSection}>
      <Text style={styles.sentSectionTitle}>Sent invitations</Text>
      {invitations.map((inv) => (
        <SentInvitationRow
          key={inv.id}
          invitation={inv}
          onCancel={() => onCancel(inv.id)}
        />
      ))}
    </View>
  );
}

function SearchEmptyState({ query, isSearching }: { query: string; isSearching: boolean }) {
  if (isSearching || query.trim().length < 2) return null;
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyBody}>No users found matching that search.</Text>
    </View>
  );
}

export function InviteGuestsSheet({
  planId,
  planDetails,
  availableSlots,
  onClose,
  visible,
  onSlotsChanged,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const sheetMaxHeight = Math.min(winH * 0.88, 640);
  const bottomPad = Math.max(insets.bottom, SHEET_BOTTOM_INSET);

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'email'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InvitationSearchResult[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [sentInvitations, setSentInvitations] = useState<PlanInvitationRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  const hasSearchResults = activeTab === 'search' && searchResults.length > 0;
  /** Results list fills remaining space; chrome stays pinned. */
  const resultsLayout = hasSearchResults;
  /** Expand sheet while typing or showing results so the field stays above the keyboard. */
  const expandSheet = keyboardOpen || resultsLayout;

  const refreshInvitations = useCallback(async () => {
    try {
      const updated = await fetchPlanInvitations(planId);
      setSentInvitations(updated);
      onSlotsChanged?.();
    } catch {
      setSentInvitations([]);
    }
  }, [planId, onSlotsChanged]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchUsersForInvitation(searchQuery.trim(), planId);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, planId]);

  useEffect(() => {
    if (visible) {
      setActiveTab('search');
      setSearchQuery('');
      setSearchResults([]);
      setEmailInput('');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    void refreshInvitations();
  }, [visible, refreshInvitations]);

  useEffect(() => {
    if (!visible) {
      Keyboard.dismiss();
      setKeyboardOpen(false);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const subHide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [visible]);

  const switchTab = useCallback((tab: 'search' | 'email') => {
    Keyboard.dismiss();
    setActiveTab(tab);
  }, []);

  const handleSendToUser = useCallback(
    async (userId: string) => {
      if (availableSlots <= 0) return;
      const target = searchResults.find((r) => r.user_id === userId);
      if (target?.already_member) return;
      setIsSending(true);
      setInvitingUserId(userId);
      try {
        await sendInvitationToUser(planId, userId, planDetails);
        await refreshInvitations();
        setSearchResults((prev) =>
          prev.map((r) => (r.user_id === userId ? { ...r, already_invited: true } : r))
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'NO_SLOTS') {
          Alert.alert(
            'No slots available',
            'Slots free up when invitations expire or are declined.'
          );
        } else if (msg === 'ALREADY_INVITED') {
          Alert.alert('Already invited', 'This person already has an active invitation.');
        } else {
          Alert.alert('Could not send invitation', 'Please try again.');
        }
      } finally {
        setIsSending(false);
        setInvitingUserId(null);
      }
    },
    [availableSlots, planDetails, planId, refreshInvitations, searchResults]
  );

  const handleSendByEmail = async () => {
    const email = emailInput.trim();
    if (!email || availableSlots <= 0) return;
    setIsSending(true);
    try {
      await sendInvitationByEmail(planId, email, planDetails);
      setEmailInput('');
      await refreshInvitations();
    } catch {
      Alert.alert('Could not send invitation', 'Please check the email and try again.');
    } finally {
      setIsSending(false);
    }
  };

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleCancelInvitation = useCallback(
    (invitationId: string) => {
      void (async () => {
        try {
          await cancelInvitation(invitationId);
          await refreshInvitations();
        } catch {
          Alert.alert('Could not cancel', 'Please try again.');
        }
      })();
    },
    [refreshInvitations]
  );

  /** Keep sheet content below the status bar / cutout when the keyboard is open. */
  const keyboardTopReserve = Math.max(insets.top, spacing.md) + SECTION_TOP_GAP;
  const sheetTopPad = keyboardOpen ? spacing.md : spacing.lg;

  const footerButtons = (
    <View style={styles.actionRow}>
      {activeTab === 'email' ? (
        <Pressable
          accessibilityRole="button"
          disabled={isSending || !emailInput.trim() || availableSlots <= 0}
          onPress={() => void handleSendByEmail()}
          style={({ pressed }) => [
            styles.sheetBtnOuter,
            styles.sheetBtnPrimaryShadow,
            (isSending || !emailInput.trim() || availableSlots <= 0) && styles.sheetBtnDisabled,
            pressed &&
              !isSending &&
              emailInput.trim() &&
              availableSlots > 0 &&
              styles.sheetBtnPressed,
          ]}
        >
          <LinearGradient
            colors={[...APP_CTA_GRADIENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sheetBtnPrimary}
          >
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.sheetBtnPrimaryTxt} numberOfLines={1}>
                Send invitation
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [
          styles.sheetBtnOuter,
          activeTab === 'search' && styles.sheetBtnOuterFull,
          pressed && styles.sheetBtnPressed,
        ]}
      >
        <LinearGradient
          colors={[...APP_CTA_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sheetBtnSecondaryBorder}
        >
          <View style={styles.sheetBtnSecondaryInner}>
            <Text style={styles.sheetBtnSecondaryTxt} numberOfLines={1}>
              Close
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );

  const slotsAndTabs = (
    <>
      <View style={[styles.slotsCard, availableSlots <= 0 && styles.slotsCardFull]}>
        <View style={styles.slotsCardHeader}>
          <LinearGradient
            colors={
              availableSlots > 0
                ? [colors.primary, '#8B84FF', colors.secondary]
                : ['#F59E0B', '#FBBF24', '#F97316']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.slotsIconGradient}
          >
            <Ionicons
              name={availableSlots > 0 ? 'people-outline' : 'alert-circle-outline'}
              size={20}
              color="#FFFFFF"
            />
          </LinearGradient>
          <View style={styles.slotsTitleBlock}>
            <Text
              style={[styles.slotsKicker, availableSlots <= 0 && styles.slotsKickerWarning]}
            >
              {availableSlots > 0 ? 'Guest capacity' : 'At capacity'}
            </Text>
            <Text style={styles.slotsTitle}>
              {availableSlots > 0
                ? `${availableSlots} slot${availableSlots === 1 ? '' : 's'} available`
                : 'No slots available'}
            </Text>
          </View>
        </View>
        {availableSlots <= 0 ? (
          <Text style={styles.slotsBody}>
            Slots free up when invitations expire or are declined.
          </Text>
        ) : null}
      </View>

      <View style={styles.segmentTrackWrap}>
        <View style={styles.segmentTrack}>
          <Pressable
            onPress={() => switchTab('search')}
            style={({ pressed }) => [styles.segment, pressed && styles.segmentPressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'search' }}
          >
            {activeTab === 'search' ? (
              <LinearGradient
                colors={[...APP_CTA_GRADIENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.segmentFill}
              />
            ) : null}
            <Text
              style={[styles.segmentLabel, activeTab === 'search' && styles.segmentLabelOn]}
              numberOfLines={1}
            >
              Find on LinkUp
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchTab('email')}
            style={({ pressed }) => [styles.segment, pressed && styles.segmentPressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'email' }}
          >
            {activeTab === 'email' ? (
              <LinearGradient
                colors={[...APP_CTA_GRADIENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.segmentFill}
              />
            ) : null}
            <Text
              style={[styles.segmentLabel, activeTab === 'email' && styles.segmentLabelOn]}
              numberOfLines={1}
            >
              Invite by email
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );

  const fixedFieldBlock =
    activeTab === 'search' ? (
      <View style={styles.fixedFields}>
        <Text style={styles.fieldLabel} numberOfLines={1}>
          Find members
        </Text>
        <Input
          variant="onboardingFlat"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, username or phone"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.fieldInput}
        />
        {isSearching ? <Text style={styles.searchingLabel}>Searching…</Text> : null}
        {!hasSearchResults ? (
          <SearchEmptyState query={searchQuery} isSearching={isSearching} />
        ) : null}
      </View>
    ) : (
      <View style={styles.fixedFields}>
        <Text style={styles.fieldLabel} numberOfLines={1}>
          Guest email
        </Text>
        <Input
          variant="onboardingFlat"
          value={emailInput}
          onChangeText={setEmailInput}
          placeholder="Enter email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          style={styles.fieldInput}
        />
      </View>
    );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={dismissKeyboard}
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
        />
        <View
          style={[
            styles.sheet,
            {
              maxHeight: sheetMaxHeight,
              paddingBottom: bottomPad,
              paddingTop: sheetTopPad,
            },
            // KeyboardAvoidingView already shrinks available height — fill that area
            // and reserve top space so headers sit at/below the safe content line.
            keyboardOpen && {
              flex: 1,
              marginTop: keyboardTopReserve,
              maxHeight: undefined,
            },
            expandSheet && !keyboardOpen && { height: sheetMaxHeight },
            expandSheet && styles.sheetExpanded,
          ]}
        >
          <View style={styles.sheetHeader}>
            {!keyboardOpen ? <View style={styles.handle} /> : null}
            {!keyboardOpen ? (
              slotsAndTabs
            ) : (
              <Text style={styles.keyboardTabHint} numberOfLines={1}>
                {activeTab === 'search' ? 'Find on LinkUp' : 'Invite by email'}
              </Text>
            )}
          </View>

          {fixedFieldBlock}

          {resultsLayout ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.user_id}
              style={styles.resultsList}
              contentContainerStyle={styles.resultsListContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              renderItem={({ item: user }) => (
                <UserSearchRow
                  user={user}
                  onInvite={() => void handleSendToUser(user.user_id)}
                  disabled={
                    user.already_invited || user.already_member || availableSlots <= 0
                  }
                  inviting={isSending && invitingUserId === user.user_id}
                />
              )}
            />
          ) : (
            <ScrollView
              style={styles.defaultScroll}
              contentContainerStyle={styles.defaultScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <SentInvitationsBlock
                invitations={sentInvitations}
                onCancel={handleCancelInvitation}
              />
            </ScrollView>
          )}

          <View style={styles.sheetFooter}>{footerButtons}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
    }),
  },
  sheetExpanded: {
    flexDirection: 'column',
  },
  sheetHeader: {
    paddingBottom: spacing.xs,
    flexShrink: 0,
  },
  keyboardTabHint: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: -0.1,
    marginBottom: spacing.md,
    includeFontPadding: false,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  slotsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.14)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#4C1D95',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.09,
        shadowRadius: 20,
      },
      android: { elevation: 3 },
    }),
  },
  slotsCardFull: {
    borderColor: 'rgba(245, 158, 11, 0.28)',
    backgroundColor: '#FFFBF5',
  },
  slotsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  slotsIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotsTitleBlock: { flex: 1, minWidth: 0 },
  slotsKicker: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  slotsKickerWarning: {
    color: colors.warning,
  },
  slotsTitle: {
    fontSize: 19,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  slotsBody: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    letterSpacing: -0.15,
    fontWeight: '600',
    fontFamily: fonts.medium,
  },
  fixedFields: {
    flexShrink: 0,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
    includeFontPadding: false,
  },
  fieldInput: onboardingInputShadow,
  searchingLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  segmentTrackWrap: {
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(94, 82, 255, 0.1)',
    borderRadius: radius.button,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.18)',
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    overflow: 'hidden',
    position: 'relative',
  },
  segmentFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.button,
  },
  segmentPressed: { opacity: 0.92 },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    zIndex: 1,
  },
  segmentLabelOn: {
    color: '#fff',
    fontWeight: '800',
    fontFamily: fonts.bold,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resultsList: {
    flex: 1,
    minHeight: 0,
  },
  resultsListContent: {
    flexGrow: 0,
    paddingBottom: spacing.xs,
  },
  defaultScroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  defaultScrollContent: {
    flexGrow: 0,
  },
  sheetFooter: {
    width: '100%',
    flexShrink: 0,
    marginTop: FOOTER_FIELD_GAP,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(94, 82, 255, 0.1)',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  emptyBody: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  userCopy: { flex: 1, minWidth: 0 },
  userName: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userMeta: {
    fontSize: 12,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.success,
  },
  userMetaMuted: {
    fontSize: 12,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.textMuted,
  },
  invitedBadge: {
    fontSize: 12,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.textMuted,
  },
  memberBadge: {
    flexShrink: 1,
    maxWidth: 128,
    fontSize: 11,
    fontFamily: fonts.bold,
    fontWeight: '800',
    color: '#92400E',
    textAlign: 'right',
    lineHeight: 15,
  },
  inviteBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  inviteBtnDisabled: {
    opacity: 0.45,
  },
  inviteBtnLabel: {
    color: '#fff',
    fontSize: 12,
    fontFamily: fonts.bold,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  sheetBtnOuter: {
    flex: 1,
    minWidth: 0,
    height: FOOTER_BTN_HEIGHT,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  sheetBtnOuterFull: {
    flex: 1,
    minWidth: 0,
  },
  sheetBtnPrimaryShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#5E52FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  sheetBtnPrimary: {
    flex: 1,
    height: FOOTER_BTN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sheetBtnPrimaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  sheetBtnSecondaryBorder: {
    flex: 1,
    height: FOOTER_BTN_HEIGHT,
    borderRadius: radius.button,
    padding: 1.5,
  },
  sheetBtnSecondaryInner: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.button - 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sheetBtnSecondaryTxt: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  sheetBtnDisabled: { opacity: 0.5 },
  sheetBtnPressed: { opacity: 0.92 },
  sentSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sentSectionTitle: {
    fontSize: 11,
    fontFamily: fonts.bold,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: spacing.sm,
  },
  sentLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sentName: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.text,
  },
  sentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  statusBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    fontWeight: '800',
  },
  cancelLink: { padding: spacing.xs },
  cancelLinkLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    fontWeight: '600',
    color: colors.primary,
  },
});
