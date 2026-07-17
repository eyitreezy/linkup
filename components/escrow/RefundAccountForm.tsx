import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors, radius, spacing, fonts } from '@/constants/theme';
import {
  fetchNigerianBanks,
  maskAccountNumber,
  savePaymentAccount,
  verifyBankAccount,
} from '@/lib/escrow/virtualAccountPayment';
import type { DbNigerianBank, DbUserPaymentAccount } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

export type RefundAccountResult =
  | { mode: 'saved'; accountId: string }
  | {
      mode: 'one_time';
      bankCode: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
    };

type Props = {
  userId: string;
  savedAccount: DbUserPaymentAccount | null;
  onComplete: (result: RefundAccountResult) => void | Promise<void>;
  busy?: boolean;
  submitLabel?: string;
  allowOneTime?: boolean;
};

function PrefSwitch({ value, onValueChange, disabled }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: 'rgba(26, 29, 38, 0.14)', true: colors.primary }}
      thumbColor={Platform.OS === 'android' ? (value ? '#5EEAD4' : '#F3F4F6') : undefined}
      ios_backgroundColor="rgba(26, 29, 38, 0.14)"
    />
  );
}

export function RefundAccountForm({
  userId,
  savedAccount,
  onComplete,
  busy = false,
  submitLabel = 'Generate payment account',
  allowOneTime = true,
}: Props) {
  const [useDifferent, setUseDifferent] = useState(!savedAccount);
  const [banks, setBanks] = useState<DbNigerianBank[]>([]);
  const [bankQuery, setBankQuery] = useState('');
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<DbNigerianBank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saveForFuture, setSaveForFuture] = useState(true);
  const [formBusy, setFormBusy] = useState(false);
  const [banksLoading, setBanksLoading] = useState(true);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [sandboxHint, setSandboxHint] = useState<string | null>(null);

  useEffect(() => {
    setBanksLoading(true);
    setBanksError(null);
    setSandboxHint(null);
    void fetchNigerianBanks()
      .then((result) => {
        setBanks(result.banks);
        setSandboxHint(result.sandboxHint);
        if (result.banks.length === 0) {
          setBanksError('Could not load banks. Please refresh and try again.');
        }
      })
      .catch(() => {
        setBanksError('Could not load banks. Please refresh and try again.');
      })
      .finally(() => setBanksLoading(false));
  }, []);

  useEffect(() => {
    if (consent) setSaveForFuture(true);
  }, [consent]);

  const filteredBanks = useMemo(() => {
    const q = bankQuery.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => b.bank_name.toLowerCase().includes(q));
  }, [banks, bankQuery]);

  useEffect(() => {
    if (accountNumber.length !== 10 || !selectedBank) {
      setAccountName(null);
      setVerifyError(null);
      return;
    }

    let cancelled = false;
    setVerifying(true);
    setVerifyError(null);
    setAccountName(null);

    void verifyBankAccount(accountNumber, selectedBank.bank_code, selectedBank.bank_name)
      .then((result) => {
        if (cancelled) return;
        setAccountName(result.account_name);
      })
      .catch((e) => {
        if (cancelled) return;
        setVerifyError(
          e instanceof Error
            ? e.message
            : 'Could not verify this account. Please check that the account number belongs to the selected bank and try again.'
        );
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountNumber, selectedBank]);

  async function handleUseSaved() {
    if (!savedAccount) return;
    await onComplete({ mode: 'saved', accountId: savedAccount.id });
  }

  async function handleSubmit(save: boolean) {
    if (!selectedBank || !accountName || accountNumber.length !== 10) return;
    if (save && !consent) return;

    setFormBusy(true);
    try {
      if (save) {
        const saved = await savePaymentAccount({
          userId,
          bankCode: selectedBank.bank_code,
          bankName: selectedBank.bank_name,
          accountNumber,
          accountName,
        });
        await onComplete({ mode: 'saved', accountId: saved.id });
      } else {
        await onComplete({
          mode: 'one_time',
          bankCode: selectedBank.bank_code,
          bankName: selectedBank.bank_name,
          accountNumber,
          accountName,
        });
      }
    } finally {
      setFormBusy(false);
    }
  }

  const off = busy || formBusy;
  const canProceed = !!accountName && accountNumber.length === 10 && consent && !verifying;

  if (savedAccount && !useDifferent) {
    return (
      <View style={styles.stack}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Refund account</Text>
          <Text style={styles.bankName}>{savedAccount.bank_name}</Text>
          <Text style={styles.accountName}>{savedAccount.account_name}</Text>
          <Text style={styles.masked}>{maskAccountNumber(savedAccount.account_number)}</Text>
          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.verifiedTxt}>Verified</Text>
          </View>
        </View>
        <Button title={off ? 'Please wait…' : 'Use this account'} onPress={() => void handleUseSaved()} disabled={off} gradient pill fullWidth />
        <Pressable onPress={() => setUseDifferent(true)} disabled={off} style={styles.linkBtn}>
          <Text style={styles.linkTxt}>Use a different account</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {savedAccount ? (
        <Pressable onPress={() => setUseDifferent(false)} disabled={off} style={styles.linkBtn}>
          <Text style={styles.linkTxt}>Back to saved account</Text>
        </Pressable>
      ) : null}

      {sandboxHint ? (
        <View style={styles.sandboxBanner}>
          <Text style={styles.sandboxTxt}>{sandboxHint}</Text>
        </View>
      ) : null}

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Bank</Text>
        {banksLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingTxt}>Loading banks…</Text>
          </View>
        ) : banksError ? (
          <Text style={styles.errorTxt}>{banksError}</Text>
        ) : (
          <Pressable
            onPress={() => setBankModalOpen(true)}
            style={({ pressed }) => [styles.bankTrigger, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Select bank"
          >
            <Text style={selectedBank ? styles.bankTriggerValue : styles.bankTriggerPlaceholder}>
              {selectedBank?.bank_name ?? 'Select a bank'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Account number</Text>
        <Input
          variant="onboardingFlat"
          value={accountNumber}
          onChangeText={(text) => setAccountNumber(text.replace(/\D/g, '').slice(0, 10))}
          placeholder={sandboxHint ? 'e.g. 0690000032 (test account)' : '10-digit account number'}
          keyboardType="number-pad"
          maxLength={10}
        />
      </View>

      <View style={styles.verifySlot}>
        {verifying ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingTxt}>Verifying account…</Text>
          </View>
        ) : accountName ? (
          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.accountName}>{accountName}</Text>
          </View>
        ) : verifyError ? (
          <Text style={styles.errorTxt}>{verifyError}</Text>
        ) : null}
      </View>

      {accountName ? (
        <>
          <Pressable
            onPress={() => setConsent(!consent)}
            style={({ pressed }) => [styles.consentCard, pressed && styles.pressed]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
          >
            <View style={[styles.checkbox, consent && styles.checkboxOn]}>
              {consent ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
            </View>
            <Text style={styles.consentTxt}>
              I agree to LinkUp storing my bank account details for refund processing. I can remove these in
              Settings at any time.
            </Text>
          </Pressable>

          <View style={styles.saveRow}>
            <Text style={styles.saveLabel}>Save for future refunds</Text>
            <PrefSwitch value={saveForFuture} onValueChange={setSaveForFuture} disabled={!consent} />
          </View>
        </>
      ) : null}

      <Button
        title={off ? 'Please wait…' : submitLabel}
        onPress={() => void handleSubmit(saveForFuture && consent)}
        disabled={!canProceed || off}
        loading={off}
        gradient
        pill
        fullWidth
      />

      {accountName && consent && allowOneTime ? (
        <Pressable onPress={() => void handleSubmit(false)} disabled={off} style={styles.linkBtn}>
          <Text style={styles.linkTxt}>Use once (do not save)</Text>
        </Pressable>
      ) : null}

      <Modal visible={bankModalOpen} animationType="slide" transparent onRequestClose={() => setBankModalOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setBankModalOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select bank</Text>
            <TextInput
              value={bankQuery}
              onChangeText={setBankQuery}
              placeholder="Search banks..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoFocus
            />
            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => item.bank_code}
              keyboardShouldPersistTaps="handled"
              style={styles.bankList}
              ListEmptyComponent={
                bankQuery.length > 0 ? (
                  <Text style={styles.emptyTxt}>No banks found matching "{bankQuery}"</Text>
                ) : null
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelectedBank(item);
                    setBankQuery('');
                    setBankModalOpen(false);
                  }}
                  style={({ pressed }) => [styles.bankRow, pressed && styles.pressed]}
                >
                  <Text style={styles.bankRowTxt}>{item.bank_name}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bankName: {
    marginTop: spacing.xs,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  masked: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  verifiedTxt: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.success,
  },
  linkBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  linkTxt: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  sandboxBanner: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: '#FFFBEB',
    padding: spacing.md,
  },
  sandboxTxt: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: '#78350F',
    lineHeight: 20,
  },
  fieldBlock: { gap: spacing.xs },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bankTrigger: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#D8DCE6',
    backgroundColor: '#F8F9FC',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankTriggerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  bankTriggerPlaceholder: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  loadingTxt: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  errorTxt: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.danger,
    lineHeight: 20,
  },
  verifySlot: { minHeight: 28 },
  consentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(94, 82, 255, 0.12)',
    padding: spacing.md,
  },
  checkbox: {
    marginTop: 2,
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(94, 82, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxOn: {
    borderWidth: 0,
    backgroundColor: colors.primary,
  },
  consentTxt: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
    lineHeight: 21,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#D8DCE6',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  saveLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.bold,
    color: colors.text,
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    maxHeight: '78%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 29, 38, 0.14)',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D8DCE6',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  bankList: { flexGrow: 0 },
  bankRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 29, 38, 0.08)',
  },
  bankRowTxt: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.text,
  },
  emptyTxt: {
    textAlign: 'center',
    paddingVertical: spacing.lg,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  pressed: { opacity: 0.92 },
});
