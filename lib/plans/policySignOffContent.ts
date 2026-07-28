/**
 * POLICY DELIVERY MOMENTS - GROUP PLANS (ANNEXURE B)
 *
 * 1. ONBOARDING (existing)
 *    Terms of Use - nature of platform, eligibility, escrow, contact policy
 *    Privacy & NDPR Consent - data collection, storage, user rights
 *
 * 2. FIRST GROUP PLAN INTERACTION (GroupPlanPolicyGate)
 *    Full Group Plan rules: confirmation window, Exigency process,
 *    all 5 outcomes, 50% floor, fund storage limit, host cancellation,
 *    host no-show, platform fee. Signed once per policy version.
 *
 * 3. ESCROW INITIATION - BEFORE CHECKOUT (EscrowPolicySignOffModal)
 *    Per-pattern cancellation matrix, no-show consequences, 50% floor,
 *    platform fee. Signed once per plan per user.
 *
 * 4. FIRST MEETUP BETWEEN TWO PARTIES (SafetyCaveatInterstitial)
 *    Safety recommendation: public space for first meetup.
 *    Acknowledged once per pair.
 *
 * 5. MEETUP TIME - T+0 push notification
 * 6. T+12H POST MEETUP push notification
 * 7. T+23H POST MEETUP push notification
 * 8. DISPUTE VIDEO CAPTURE NDPR consent
 * 9. EXIGENCY EVIDENCE UPLOAD NDPR consent
 */

export type EscrowPatternKey = 'A' | 'B' | 'C';

export type PolicySection = {
  heading: string;
  paragraphs: string[];
};

export const ESCROW_POLICY_BY_PATTERN: Record<EscrowPatternKey, PolicySection[]> = {
  A: [
    {
      heading: 'How your escrow works',
      paragraphs: [
        'Your contribution is held securely in escrow until the meetup is confirmed. If the meetup is confirmed by both parties or 24 hours pass without a dispute, funds are released back to your LinkUp wallet minus the platform fee.',
      ],
    },
    {
      heading: 'Cancellation - Host',
      paragraphs: [
        'If you cancel this plan, the following applies to your contribution:',
        '72+ hours before meetup: full refund to you',
        '48-72 hours before: 80% refund. You forfeit 20%.',
        '24-48 hours before: 70% refund. You forfeit 30%.',
        'Within 24 hours: 60% refund. You forfeit 40%.',
        'No cancellation, no-show (with evidence): 65% refund',
        'No cancellation, no-show (no contact): 50% refund',
        'The forfeited portion is distributed as a Goodwill Credit to the Guest as compensation for the disruption.',
        'The guest has no financial contribution in this plan and has no financial consequence for cancelling or not showing up. A no-show flag is recorded on the guest account.',
      ],
    },
    {
      heading: 'The 50% financial floor',
      paragraphs: ['You will never forfeit more than 50% of your contribution in any scenario.'],
    },
    {
      heading: 'Platform fee',
      paragraphs: [
        'A 5% platform fee applies. Refund amounts shown above are net of this fee.',
      ],
    },
  ],
  B: [
    {
      heading: 'How your escrow works',
      paragraphs: [
        "Both you and your meetup partner have contributed to escrow. Each party's contribution is tracked separately and returned to the contributor on confirmed completion, minus the platform fee.",
      ],
    },
    {
      heading: 'Cancellation - either party',
      paragraphs: [
        'Whichever party cancels, the following applies to their own contribution:',
        '72+ hours before meetup: full refund to the cancelling party',
        '48-72 hours before: 80% refund. 20% goes to the other party.',
        '24-48 hours before: 70% refund. 30% goes to the other party.',
        'Within 24 hours: 60% refund. 40% goes to the other party.',
        'No-show (with evidence): 65% refund. 35% goes to the other party.',
        'No-show (no contact): 50% refund. 50% goes to the other party.',
        "The non-cancelling party always receives their own contribution back in full, plus a share of the cancelling party's forfeiture as compensation.",
      ],
    },
    {
      heading: 'The 50% financial floor',
      paragraphs: [
        'Neither party will ever forfeit more than 50% of their own contribution.',
      ],
    },
    {
      heading: 'Platform fee',
      paragraphs: ['A 5% platform fee applies to each contribution separately.'],
    },
  ],
  C: [
    {
      heading: 'How your escrow works',
      paragraphs: [
        'You have funded this plan in full. Your payment is held in escrow and released automatically to the host 24 hours after the meetup time, unless you raise a dispute before that window closes.',
      ],
    },
    {
      heading: 'Cancellation by you (Guest)',
      paragraphs: [
        'If you cancel before the meetup, the following applies to your payment:',
        '72+ hours before meetup: full refund to you',
        '48-72 hours before: 80% refund to you',
        '24-48 hours before: 70% refund to you',
        'Within 24 hours: 60% refund to you',
        'The host receives the forfeited portion as compensation.',
      ],
    },
    {
      heading: 'Cancellation by Host',
      paragraphs: [
        'If the host cancels, you receive a full refund of your payment. In late cancellation bands (within 48 hours), you also receive a Goodwill Credit as compensation for the disruption.',
      ],
    },
    {
      heading: 'No-show - Host',
      paragraphs: [
        'If the host does not show up, your payment is not released. You have 24 hours from the scheduled meetup time to raise a dispute. The automatic release is cancelled pending dispute resolution.',
      ],
    },
    {
      heading: 'No-show - you (Guest)',
      paragraphs: [
        'If you do not show up, your payment is treated as timing-bound:',
        '72+ hours before meetup: treated as early cancellation with full refund',
        '48-72 hours: 80% refund',
        '24-48 hours: 70% refund',
        'Day-of or no contact: 60% refund minimum',
      ],
    },
    {
      heading: 'The 50% financial floor',
      paragraphs: [
        'You will never lose more than 50% of your payment in any scenario except timing-bound no-show or cancellation bands described above.',
      ],
    },
    {
      heading: 'Platform fee',
      paragraphs: ['A 5% platform fee is deducted from disbursement to the host.'],
    },
  ],
};

export const GROUP_PLAN_POLICY_SECTIONS: PolicySection[] = [
  {
    heading: 'What is a Group Plan',
    paragraphs: [
      'A Group Plan is a meetup organised by a Host for 5 or more people (including the Host). Every member (Host and all Guests) contributes to a shared escrow pool before the meetup is confirmed.',
    ],
  },
  {
    heading: 'Minimum members',
    paragraphs: [
      'A Group Plan requires at least 5 confirmed members (Host + 4 Guests) before escrow is activated. If the minimum is not reached 48 hours before the scheduled meetup, the Host is notified and can extend registration, proceed as a smaller private group, or cancel. All contributions are fully refunded if the group does not reach minimum.',
    ],
  },
  {
    heading: 'After the meetup - confirmation window',
    paragraphs: [
      'When the scheduled meetup time arrives, the Host taps "Confirm Group Meetup Completed." Each Guest then has 1 hour from the Host\'s confirmation to confirm their own attendance.',
      'If you do not confirm within 1 hour, your contribution is withheld (not forfeited) while the system waits for your Exigency Report.',
    ],
  },
  {
    heading: 'The Exigency Report',
    paragraphs: [
      'If you could not attend or arrived late, you must submit an Exigency Report within 24 hours of the scheduled meetup time. This is your opportunity to explain what happened. The report takes 5 minutes and you can attach supporting evidence.',
    ],
  },
  {
    heading: 'What happens based on your report',
    paragraphs: [
      'If you arrived late but attended: All withheld funds go to the Host as normal. No refund to you.',
      'If you had a genuine emergency (illness, accident): 100% of your withheld contribution is refunded to you. The Host receives Goodwill Credits for managing the disruption. Review takes up to 72 hours. Medical evidence strongly recommended.',
      'If your report is fairly satisfactory: 80% refund to you. 20% released to the Host. Review takes up to 48 hours.',
      'If your report is unsatisfactory: 70% refund to you. 30% released to the Host. Review takes up to 48 hours.',
      'If you do not submit a report within 24 hours: This is applied automatically with no review. 50% of your contribution is returned to you. 50% is released to the Host as compensation.',
    ],
  },
  {
    heading: 'The 50% financial floor',
    paragraphs: [
      "In every scenario (including the automatic outcome) you will receive back at least 50% of your contribution. LinkUp's policy is that nobody loses all their money on the platform.",
    ],
  },
  {
    heading: 'Fund storage limit',
    paragraphs: [
      'Your contribution cannot be held in escrow for longer than 1 calendar month. All Group Plans must be scheduled within 1 month of the escrow activation date.',
    ],
  },
  {
    heading: 'Host cancellation',
    paragraphs: [
      "Only the Host can cancel a Group Plan. If the Host cancels, all Guest contributions are refunded in full. The Host's own contribution is subject to timing-based penalties (up to 40% forfeited in the final 24 hours).",
    ],
  },
  {
    heading: 'No-show - Host',
    paragraphs: [
      'If the Host does not attend and no-show evidence is submitted by at least 2 Guests, the Host forfeits 50% of their own contribution. All Guest contributions are refunded in full with Goodwill Credits added.',
    ],
  },
  {
    heading: 'Platform fee',
    paragraphs: [
      'A 5% platform fee is included in your contribution amount and displayed clearly at the point of joining. The fee is retained in all scenarios except a full group no-show where no meetup occurred at all.',
    ],
  },
  {
    heading: 'Acknowledgement',
    paragraphs: [
      'By continuing, you confirm that you have read and understood these rules. You will not be able to claim ignorance of the Exigency Report process or the 24-hour submission window after signing this policy.',
    ],
  },
];

export function normalizeEscrowPattern(
  pattern: string | null | undefined
): EscrowPatternKey {
  if (pattern === 'B' || pattern === 'C') return pattern;
  return 'A';
}

export const VIDEO_CAMERA_PRE_PERMISSION =
  'LinkUp needs camera access to record your dispute evidence video. Your recording is stored securely and is only reviewed by the LinkUp dispute team. You can withdraw consent at any time by contacting support, which will remove your stored recordings.';

export const VIDEO_NDPR_CONSENT =
  'Your video is recorded live and tied to your verified LinkUp identity. It is stored securely and reviewed only by the LinkUp dispute team in connection with this specific dispute. It is not used for any other purpose and is not shared with third parties. By recording and submitting this video, you consent to LinkUp processing this recording as evidence under our Privacy Policy and the Nigeria Data Protection Regulation (NDPR).';

export const EXIGENCY_EVIDENCE_NDPR =
  'If you upload supporting documents such as a medical certificate or hospital record, these are stored securely and accessed only by the LinkUp review team for the purpose of assessing your Exigency Report. Documents are not shared with other users, including the Host. By uploading, you consent to LinkUp processing this document under the Nigeria Data Protection Regulation (NDPR). You may request removal of your documents after your report is resolved by contacting support.';
