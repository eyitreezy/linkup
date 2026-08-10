/**

 * Inline card when the viewer needs a location for plan distances.

 */

import { LocationSearchField } from '@/components/location/LocationSearchField';

import { Button } from '@/components/Button';

import { colors, radius, spacing, fonts } from '@/constants/theme';

import type { LocationSuggestion } from '@/lib/location/locationGeocode';

import { Ionicons } from '@expo/vector-icons';

import { useState } from 'react';

import { StyleSheet, Text, View } from 'react-native';



type Props = {

  onAllow: () => void;

  onNotNow: () => void;

  allowBusy?: boolean;

  fixFailedHint?: string | null;

  onOpenSettings?: () => void;

  permissionGranted?: boolean;

  showManualPicker?: boolean;

  onPickManualLocation?: (suggestion: LocationSuggestion) => void;

};



export function PlansLocationPrompt({

  onAllow,

  onNotNow,

  allowBusy = false,

  fixFailedHint,

  onOpenSettings,

  permissionGranted = false,

  showManualPicker = false,

  onPickManualLocation,

}: Props) {

  const [manualQuery, setManualQuery] = useState('');



  return (

    <View style={styles.card} accessibilityViewIsModal>

      <View style={styles.row}>

        <View style={styles.iconCircle}>

          <Ionicons name="navigate-outline" size={22} color={colors.primary} />

        </View>

        <View style={styles.copy}>

          <Text style={styles.title}>

            {permissionGranted

              ? 'Use your location to see plan distances'

              : 'Enable location to see plans near you'}

          </Text>

          <Text style={styles.body}>

            We use your approximate area to sort and show relevant plans. You can change this anytime

            in settings.

          </Text>

          {fixFailedHint ? <Text style={styles.fixFailed}>{fixFailedHint}</Text> : null}

        </View>

      </View>



      {showManualPicker && onPickManualLocation ? (

        <View style={styles.manualPicker}>

          <Text style={styles.manualLabel}>Or search for your city</Text>

          <LocationSearchField

            label="Your area"

            placeholder="e.g. Lagos, Abuja, Kano"

            value={manualQuery}

            onChangeText={setManualQuery}

            onSelectSuggestion={(suggestion) => {

              setManualQuery(suggestion.label);

              onPickManualLocation(suggestion);

            }}

          />

        </View>

      ) : null}



      <View style={styles.btns}>

        <Button

          title={permissionGranted ? 'Use my location' : 'Allow'}

          onPress={onAllow}

          loading={allowBusy}

          disabled={allowBusy}

          fullWidth

          style={styles.allow}

        />

        {onOpenSettings ? (

          <Button

            title="Open settings"

            variant="secondary"

            onPress={onOpenSettings}

            disabled={allowBusy}

            fullWidth

          />

        ) : null}

        <Button title="Not now" variant="ghost" onPress={onNotNow} disabled={allowBusy} fullWidth />

      </View>

    </View>

  );

}



const styles = StyleSheet.create({

  card: {

    marginHorizontal: spacing.md,

    marginBottom: spacing.md,

    padding: spacing.md,

    borderRadius: radius.lg,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.border,

    shadowColor: '#0F172A',

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.06,

    shadowRadius: 8,

    elevation: 2,

  },

  row: { flexDirection: 'row', gap: spacing.md },

  iconCircle: {

    width: 44,

    height: 44,

    borderRadius: 22,

    backgroundColor: 'rgba(94, 82, 255, 0.12)',

    alignItems: 'center',

    justifyContent: 'center',

  },

  copy: { flex: 1 },

  title: { fontSize: 16, fontWeight: '800',

    fontFamily: fonts.bold, color: colors.text, marginBottom: 6 },

  body: { fontSize: 13, color: colors.textMuted, lineHeight: 19, fontFamily: fonts.regular, },

  fixFailed: {

    marginTop: 8,

    fontSize: 13,

    fontWeight: '700',

    color: colors.warning,

    lineHeight: 18,

  },

  manualPicker: {

    marginTop: spacing.md,

    zIndex: 30,

  },

  manualLabel: {

    fontSize: 12,

    fontWeight: '800',

    fontFamily: fonts.bold,

    color: colors.text,

    textTransform: 'uppercase',

    letterSpacing: 0.6,

    marginBottom: spacing.xs,

  },

  btns: { marginTop: spacing.md, gap: spacing.sm },

  allow: { marginBottom: 0 },

});


