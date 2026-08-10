"""Launch QA test case definitions — Mobile (Part A) and Web (Part B), sequential suites."""

from __future__ import annotations

from typing import TypedDict


class QaCase(TypedDict):
    title: str
    priority: str
    preconditions: str
    steps: list[str]
    expected: str


class QaSection(TypedDict):
    name: str
    cases: list[QaCase]


def c(title: str, priority: str, preconditions: str, steps: list[str], expected: str) -> QaCase:
    return {
        "title": title,
        "priority": priority,
        "preconditions": preconditions,
        "steps": steps,
        "expected": expected,
    }


# ---------------------------------------------------------------------------
# PART A — LINKUP MOBILE (iOS / Android)
# Execute TC-M-001 through TC-M-NNN in order for launch sign-off.
# ---------------------------------------------------------------------------

MOBILE_SECTIONS: list[QaSection] = [
    {
        "name": "A1. Authentication & Account Access",
        "cases": [
            c(
                "Cold start splash and session bootstrap",
                "Critical",
                "Fresh install or logged out; LinkUp mobile build installed.",
                ["Force-quit app.", "Launch LinkUp.", "Wait for bootstrap."],
                "Splash shows brand; routes to login or main tabs within ~5s; no crash.",
            ),
            c(
                "Email signup with confirmation email",
                "Critical",
                "Unused email; Supabase confirm-email ON; SMTP configured.",
                ["Open Sign up.", "Enter name, email, password.", "Accept privacy consent.", "Submit."],
                "Check-email message shown; confirmation email received; no session until confirmed.",
            ),
            c(
                "Email confirmation deep link (linkup://auth/callback)",
                "Critical",
                "Signup completed; app installed on same device.",
                ["Tap Confirm in email."],
                "App opens; session established; routes to onboarding or Discover.",
            ),
            c(
                "Resend verification email cooldown",
                "High",
                "Account awaiting email confirmation.",
                ["Tap Resend.", "Tap Resend again immediately."],
                "Second attempt blocked with cooldown (~60s).",
            ),
            c(
                "Email/password login",
                "Critical",
                "Confirmed account.",
                ["Log in with valid credentials."],
                "Session created; routed per onboarding_status.",
            ),
            c(
                "Google OAuth sign-in",
                "High",
                "Google provider enabled; device has Google account.",
                ["Tap Continue with Google.", "Complete consent."],
                "Session established; correct post-auth route.",
            ),
            c(
                "Forgot password and reset",
                "High",
                "Registered email.",
                ["Forgot password → enter email.", "Open reset link.", "Set new password.", "Log in."],
                "Reset email received; new password works.",
            ),
            c(
                "Invalid login shows error",
                "High",
                "Confirmed account exists.",
                ["Enter wrong password.", "Submit."],
                "Clear error; no session.",
            ),
            c(
                "Signup blocked without privacy consent",
                "High",
                "On signup screen.",
                ["Fill fields without consent checkbox.", "Submit."],
                "Blocked with consent required message.",
            ),
            c(
                "Sign out and session cleared",
                "High",
                "Logged in.",
                ["Profile → Sign out → confirm."],
                "Returned to auth; protected routes blocked.",
            ),
        ],
    },
    {
        "name": "A2. Onboarding & Profile Setup",
        "cases": [
            c(
                "Complete 5-step onboarding wizard",
                "Critical",
                "New user post-signup; onboarding_status pending.",
                [
                    "Step 1: name, DOB 18+, 3+ photos, intro video, adult toggle.",
                    "Step 2: bio, interests, languages, intent, 1–2 prompts.",
                    "Step 3: location, preferences, radius.",
                    "Step 4: safety tips.",
                    "Step 5: Finish & Go to Discover.",
                ],
                "onboarding_status complete; lands on Discover tab.",
            ),
            c(
                "Finish blocked when photos removed after revisiting steps",
                "Critical",
                "On preview step; previously valid profile.",
                [
                    "Edit from step 1.",
                    "Remove photos below minimum.",
                    "Return to preview.",
                    "Tap Finish & Go to Discover.",
                ],
                "Blocked; navigates to step 0; highlights photos; friendly validation message; status stays pending.",
            ),
            c(
                "Resume onboarding mid-wizard",
                "High",
                "Partial onboarding saved.",
                ["Kill app.", "Relaunch.", "Continue wizard."],
                "Resumes at saved step with draft intact.",
            ),
            c(
                "18+ age gate",
                "Critical",
                "On step 1 birthday.",
                ["Enter DOB under 18.", "Continue."],
                "Blocked with age requirement.",
            ),
            c(
                "Primary photo selection persists",
                "Medium",
                "Multiple photos uploaded.",
                ["Set primary photo.", "Complete onboarding.", "View profile."],
                "Primary shown on profile and discovery card.",
            ),
            c(
                "Africa-only location search in onboarding",
                "High",
                "On step 3 location.",
                ["Search non-African city (e.g. Paris).", "Search African city/venue (e.g. Lagos mall)."],
                "Non-Africa rejected or absent; African places resolve with coordinates.",
            ),
            c(
                "Save as draft keeps pending status",
                "High",
                "On preview step.",
                ["Tap Save as draft.", "Confirm."],
                "Draft saved; onboarding_status pending; tabs still gated.",
            ),
            c(
                "Skip onboarding path",
                "Medium",
                "Any onboarding step.",
                ["Tap Skip.", "Confirm skip."],
                "onboarding_status skipped; can access app per policy.",
            ),
            c(
                "Invitation token after signup routes to invitation",
                "High",
                "Signup URL included invitation_token.",
                ["Complete onboarding publish."],
                "Routes to /plan/[id]/invitation/[invitationId] when link valid.",
            ),
        ],
    },
    {
        "name": "A3. Discover Feed & Search",
        "cases": [
            c("Discover tab loads plan feed", "Critical", "Logged in; plans exist.", ["Open Discover."], "Cards load with media, title, host actions."),
            c("Swipe right (interest) on plan", "High", "Plan in feed.", ["Swipe right / like."], "Interest recorded; card advances."),
            c("Swipe left hide and undo", "Medium", "Plan in feed.", ["Swipe left.", "Tap Undo."], "Hidden then restored."),
            c("List display mode toggle", "Medium", "On Discover.", ["Filters → List → Apply."], "List layout shown."),
            c("Apply feed filters (distance, price, mood, verified)", "High", "On Discover.", ["Open Filters.", "Set filters.", "Apply."], "Feed respects filters."),
            c("Search plans by keyword", "High", "Plans in feed.", ["Enter search query."], "Matching plans shown."),
            c("Open plan detail from card", "Critical", "Plan in feed.", ["Tap card."], "Meetup details opens."),
            c("Open host public profile from card", "High", "Plan in feed.", ["Tap host avatar."], "Public profile opens."),
            c("Unverified user KYC banner on Discover", "High", "Unverified user.", ["Open Discover."], "KYC banner with path to verification."),
            c("Unverified user blocked from create plan FAB", "Critical", "Unverified user.", ["Tap + Create."], "Verification hard gate; create blocked."),
            c("Mood timeline carousel and mood filter", "High", "Mood plans exist.", ["Open mood filter/pills.", "Select mood plan."], "Mood plans filtered; countdown/reach visible."),
            c("Mood reach filter (20km widest tier)", "High", "Gold host mood plan; viewer within/outside 20km.", ["View feed as nearby vs far viewer."], "Plan visible only within stamped mood reach."),
            c("Mood plan nearby push notification", "High", "Push enabled; viewer within reach.", ["Host publishes mood plan."], "Push received; tap opens Discover; no duplicate."),
            c("Location prompt and GPS for feed ranking", "High", "Location permission.", ["Grant/deny location.", "Observe feed."], "Ranking uses viewer origin; prompt if missing."),
            c("Save/bookmark plan (premium gate if applicable)", "High", "Eligible tier.", ["Save plan from card/detail."], "Plan appears in Saved tab."),
            c("Premium paywall for gated discover feature", "High", "Free user.", ["Trigger advanced filter or undo swipe."], "Paywall modal; upgrade path works."),
            c("Privacy re-consent banner", "High", "Re-consent required flag.", ["Open Discover."], "Banner shown; accept restores full access."),
            c("First-session modals (Silver welcome, soft KYC)", "Medium", "Eligible new session.", ["Open Discover after qualifying event."], "Modals show once; dismissible."),
            c("Group plan visible during host payment", "High", "Group plan awaiting_payment.", ["Browse Discover as guest."], "Group plan visible; non-group awaiting_payment hidden."),
        ],
    },
    {
        "name": "A4. Meetr Explorer",
        "cases": [
            c("Meetr grid loads meet types", "High", "Logged in.", ["Open Meetr tab."], "Category tiles load."),
            c("Browse plans filtered by meet type", "High", "Meet types available.", ["Tap meet type."], "Discover shows filtered plans."),
            c("Custom meet type pending state", "Medium", "Pending custom type submitted.", ["Tap pending tile."], "Pending state; not selectable until approved."),
            c("Submit custom meet type from create flow", "High", "Verified user creating plan.", ["Submit custom meet type."], "Pending admin review; notification to admin."),
        ],
    },
    {
        "name": "A5. Saved Plans & Offers",
        "cases": [
            c("Saved tab lists bookmarked plans", "High", "Saved plans exist.", ["Open Saved tab."], "Correct plans listed."),
            c("Remove saved plan", "Medium", "Saved plan exists.", ["Unsave from Saved or detail."], "Removed from list."),
            c("Offers tab sent/received segments", "High", "User has offers.", ["Open Offers.", "Switch sent/received."], "Correct offers and statuses."),
            c("Counter-offer from Offers/negotiate", "High", "Pending offer.", ["Open thread.", "Submit counter."], "Counter recorded; other party notified."),
            c("Accept offer navigates to agreement", "Critical", "Host with acceptable offer.", ["Accept offer."], "Agreement screen opens."),
            c("Unverified guest blocked from sending offer", "High", "Unverified guest.", ["Attempt offer on plan."], "Verification gate shown."),
        ],
    },
    {
        "name": "A6. Plan Creation (Standard, Mood, Group)",
        "cases": [
            c("Verified user creates standard paid plan", "Critical", "Verified user.", ["Create → commitment → details → publish."], "Plan published; visible in feed."),
            c("Create mood plan with window and reach", "Critical", "Verified user; tier allows mood.", ["Enable mood plan.", "Set schedule/location.", "Publish."], "Mood plan published; mood_reach stamped from tier."),
            c("Create group plan with minimum members", "Critical", "Verified user; group host permission.", ["Enable group plan.", "Complete GroupPlanPolicyGate.", "Set min members ≥5.", "Publish."], "Group plan published; member badge shown."),
            c("Escrow pattern A/B/C selection", "High", "Creating paid plan.", ["Select each pattern in turn (separate tests)."], "Pattern saved; agreement/escrow reflects pattern."),
            c("Visibility options (public, radius, friends, tier)", "High", "Premium tiers available.", ["Set each visibility type."], "Visibility respected in discover filtering."),
            c("Africa-only location on plan create", "High", "On plan location step.", ["Search non-Africa and Africa venue."], "Africa only in suggestions; coords valid on select."),
            c("Verification gate blocks unverified publish", "Critical", "Unverified user.", ["Attempt publish."], "Hard gate; publish blocked."),
            c("Premium gate for group host / mood hours", "High", "Free vs Gold accounts.", ["Attempt gated option."], "Paywall or permission error per tier."),
            c("Publish success screen and navigation", "Medium", "Plan created.", ["Complete publish."], "Success screen; link to plan detail."),
            c("Save plan as draft from plan-management", "High", "Creator with draft.", ["Save draft.", "Resume edit."], "Draft persists in plan-management."),
        ],
    },
    {
        "name": "A7. Plan Detail, Share & Lifecycle",
        "cases": [
            c("Meetup details meta cards (When, Where, Price, App fee, Created)", "High", "Published plan.", ["Open /plan/[id]."], "All meta rows render; Created date shown."),
            c("Express interest / make offer CTA", "Critical", "Guest on open plan.", ["Tap make offer / interest."], "Negotiation or interest flow opens."),
            c("Plan share (WhatsApp, copy link)", "High", "Published plan.", ["Open share.", "Copy link / share sheet."], "Link copies; share targets work."),
            c("Invite guests sheet (group)", "High", "Group host.", ["Open invite.", "Send invitation."], "Invitation created; email/push to guest."),
            c("Join request flow (guest)", "High", "Group plan open slots.", ["Submit join request."], "Host notified; request pending."),
            c("Manage join requests (host)", "High", "Pending requests.", ["Open /plan/[id]/requests.", "Approve/decline."], "Status updates; guest notified."),
            c("Plan invitation accept screen", "Critical", "Valid invitation link.", ["Open /plan/[id]/invitation/[id].", "Accept."], "Routes to agreement or detail per state."),
            c("Plan boost controls (24h/72h quotas)", "Medium", "Eligible tier.", ["Apply boost."], "Boosted badge; quota decremented."),
            c("Extend mood plan (Gold+)", "Medium", "Eligible mood plan.", ["Tap extend."], "TTL extended once per policy."),
            c("Host cancel group plan modal", "Critical", "Group host.", ["Cancel group plan.", "Confirm terms."], "Guests refunded; notifications sent."),
            c("Guest opt-out >48h before meetup", "High", "Group guest.", ["Opt out on detail."], "Refund per policy; host notified."),
            c("Minimum membership action screen", "Critical", "T-48h below minimum.", ["Open /plan/[id]/minimum-action.", "Test extend/proceed/cancel."], "Each host action works per Annexure B."),
            c("Group meetup completion (host confirm)", "Critical", "Group plan meetup passed.", ["Host confirms group meetup completed."], "Guests enter confirm window."),
            c("Report plan/user from detail", "High", "Any viewer.", ["Open report sheet.", "Submit."], "Report recorded."),
            c("Cancellation matrix display on detail/agreement", "High", "Paid plan.", ["View Section 7.4 / cancellation summary."], "Matrix matches DB for plan pattern."),
        ],
    },
    {
        "name": "A8. Negotiation",
        "cases": [
            c("Negotiation thread loads history", "Critical", "Active negotiation.", ["Open /plan/[id]/negotiate."], "Offers and counters shown in order."),
            c("Make initial offer", "Critical", "Verified guest.", ["Submit offer amount/message."], "Offer created; host notified."),
            c("Host counter-offer", "High", "Pending offer.", ["Submit counter."], "Counter recorded; statuses updated."),
            c("Accept offer → agreement", "Critical", "Acceptable offer.", ["Accept."], "Agreement screen opens with correct amounts."),
            c("Decline offer", "High", "Pending offer.", ["Decline."], "Offer declined; parties notified."),
            c("Mood plan negotiation window expiry", "High", "Near mood window end.", ["Wait for expiry or simulate."], "Negotiation blocked after window."),
        ],
    },
    {
        "name": "A9. Agreement & Policy Gates",
        "cases": [
            c("Agreement shows gross payment amounts", "Critical", "Paid plan; escrow exists.", ["Open agreement.", "Compare preview to checkout."], "Gross amounts consistent (budget + platform fee)."),
            c("Both parties must confirm before payment", "High", "One party confirmed only.", ["Attempt pay.", "Second confirms.", "Pay."], "Payment blocked until both confirm."),
            c("Pre-agreement fullscreen legal review", "High", "First agreement for plan.", ["Open pre-agreement modal.", "Acknowledge."], "Gate clears; proceed allowed."),
            c("Escrow policy sign-off modal (Annexure B #3)", "Critical", "Before first escrow payment.", ["Proceed to pay.", "Sign policy modal."], "Pattern-specific matrix; blocks until signed."),
            c("Free plan mutual confirm path", "High", "Free plan.", ["Both confirm on agreement."], "Plan activates without escrow."),
            c("High-value escrow notice", "High", "Amount above threshold.", ["View agreement/escrow."], "Notice shown; tier/KYC gates if applicable."),
            c("Proceed to secure payment → escrow detail", "Critical", "Payer confirmed.", ["Tap pay.", "Land on /escrow/[id]."], "Correct gross Your share; fund CTA visible."),
            c("Go to chat from agreement after active", "High", "Plan active.", ["Tap Go to chat."], "Routes to plan DM or group thread."),
        ],
    },
    {
        "name": "A10. Escrow & Card Payments",
        "cases": [
            c("Fund escrow via Flutterwave card", "Critical", "Pending escrow; Flutterwave test keys.", ["Choose card.", "Complete checkout."], "Leg funded; plan progresses when all legs done."),
            c("Escrow detail status and split breakdown", "High", "Active/pending escrow.", ["Open /escrow/[id]."], "Status, amounts, counterparty, next actions visible."),
            c("Pattern B split — gross per leg", "High", "Pattern B plan.", ["Review host and guest escrow screens."], "Each leg shows correct gross."),
            c("Pattern C guest-funded escrow", "High", "Pattern C; Tier 2 KYC guest.", ["Guest funds.", "Host not payer."], "Guest leg funds; host path correct."),
            c("Group split dynamic breakdown", "High", "Group plan escrow.", ["Review group breakdown card."], "Host share matches guest commitments."),
            c("Safety caveat interstitial (Annexure B #4)", "High", "First funded meetup with new pair.", ["Fund escrow.", "View interstitial."], "Shown once per pair; acknowledge required."),
            c("Open escrow payment dispute modal", "High", "Funded escrow with issue.", ["Open dispute from escrow."], "Escrow dispute created; funds held."),
            c("Goodwill credits applied at checkout", "Medium", "User with goodwill balance.", ["Fund with goodwill eligible."], "Goodwill applied; ledger updated."),
            c("Verify payment after Flutterwave redirect", "High", "Card payment initiated.", ["Complete payment.", "Return to app."], "Escrow marked funded."),
            c("Mood deadline banner on escrow", "Medium", "Mood plan escrow.", ["Open escrow near mood expiry."], "Deadline banner accurate."),
        ],
    },
    {
        "name": "A11. Bank Transfer & Refund Account",
        "cases": [
            c("Payment method selector (card vs bank transfer)", "Critical", "Payer on pending escrow.", ["Tap fund.", "Review modal.", "Select each method."], "Card → Flutterwave; bank → bank-transfer route."),
            c("Refund account — saved account", "High", "Default saved account.", ["Choose bank transfer.", "Use saved account."], "Virtual account generated."),
            c("Verify new Nigerian bank account (NUBAN)", "Critical", "No saved account.", ["Select bank.", "Enter 10-digit account.", "Verify name."], "Account name resolves; errors on invalid."),
            c("NDPR consent required for refund account", "High", "New account form.", ["Attempt without consent.", "Check consent and retry."], "Blocked until consent checked."),
            c("Virtual account screen — copy and amount", "High", "VA issued.", ["Review bank, account number, gross amount.", "Copy account."], "Details correct; copy works."),
            c("Virtual account expiry and regenerate", "High", "VA expired.", ["Wait for expiry.", "Generate new."], "Returns to refund step; new VA issued."),
            c("Auto-confirm after exact bank transfer", "Critical", "VA issued; webhook/test transfer.", ["Transfer exact gross amount."], "Escrow funded; user notified."),
            c("Non-payer blocked from bank transfer route", "High", "Non-payer user.", ["Deep link to bank-transfer."], "Blocked or redirected."),
        ],
    },
    {
        "name": "A12. Wallet, Disbursement & Withdrawals",
        "cases": [
            c("Wallet balance, ledger, and goodwill", "High", "User with activity.", ["Open /wallet."], "Balance, goodwill, ledger render correctly."),
            c("Pending disbursement queue after meetup confirm", "High", "Confirmed meetup pending payout.", ["Open wallet after confirm."], "Pending item with amount and countdown."),
            c("Withdraw to verified bank account", "Critical", "Withdrawable balance; bank on file.", ["Tap Withdraw.", "Enter amount.", "Confirm."], "Withdrawal initiated; notification sent."),
            c("Withdraw validation (min/max/balance)", "High", "Known wallet balance.", ["Try invalid then valid amount."], "Validation errors; valid proceeds."),
            c("Refund account from wallet/bank-transfer path", "High", "No saved account.", ["Add account via wallet or escrow path."], "Account saved for refunds/withdrawals."),
            c("Goodwill non-withdrawable", "Medium", "User with goodwill.", ["Review withdrawable vs total."], "Goodwill excluded from withdrawable."),
            c("Post-cancel refund appears in wallet", "High", "Group cancel or opt-out refund.", ["Complete cancel/opt-out.", "Open wallet."], "Credit and ledger entry correct."),
        ],
    },
    {
        "name": "A13. Meetup Confirmation",
        "cases": [
            c("1:1 meetup confirm — Yes attended", "Critical", "T+12h confirm window; paid plan.", ["Open /plan/[id]/confirm.", "Tap Yes."], "Confirmed; disbursement queued."),
            c("1:1 meetup confirm — report problem", "Critical", "On confirm screen.", ["Tap No / report problem."], "Routes to plan dispute video flow."),
            c("Meetup confirm push deep link", "High", "Push enabled.", ["Tap meetup_confirm notification."], "Opens /plan/[id]/confirm."),
            c("Auto-confirm after 24h no dispute", "High", "No action in window.", ["Wait/simulate auto-confirm."], "Funds released per policy."),
            c("Go to wallet after confirm", "High", "Just confirmed.", ["Tap Go to wallet."], "Wallet shows updated balance/queue."),
            c("Group guest confirm after host confirmed", "Critical", "Group guest in window.", ["Confirm attendance."], "Guest confirmed; disbursement path starts."),
            c("Group guest exigency path from confirm", "High", "Group guest on confirm.", ["Tap Submit Exigency Report."], "Routes to /plan/[id]/exigency."),
        ],
    },
    {
        "name": "A14. Group Plans (Annexure B)",
        "cases": [
            c("Group plan policy gate on first create", "Critical", "User never signed group policy.", ["Enable group on create.", "Sign GroupPlanPolicyModal."], "Blocks until scrolled and signed."),
            c("Group policy gate skipped after prior sign", "High", "Policy already signed.", ["Create another group plan."], "Modal skipped."),
            c("Member count badge and guest panel", "High", "Partial group membership.", ["Open plan detail."], "Count vs minimum shown; guest list accurate."),
            c("Host confirms group meetup completed", "Critical", "Meetup passed.", ["Host confirms on detail."], "Guests notified; confirm window opens."),
            c("Guest opt-out triggers minimum cancel edge case", "High", "Near minimum members.", ["Guest opts out."], "Auto-cancel if below minimum; all refunded."),
            c("Host group cancellation penalty terms", "Critical", "Host cancels group.", ["Review penalty/refund copy.", "Confirm."], "Platform fee refund copy correct; guests refunded."),
            c("Countdown banners on plan detail", "Medium", "Approaching deadlines.", ["View at T-48h, meetup, post-meetup."], "Contextual banners accurate."),
            c("Platform fee refund messaging", "Medium", "Host cancel flow.", ["Review modal copy."], "Matches platformFeeRefundCopy rules."),
        ],
    },
    {
        "name": "A15. Exigency Reports",
        "cases": [
            c("Submit exigency on group plan", "Critical", "Group guest in confirm window.", ["Complete exigency wizard.", "Submit."], "Report created; admin notified."),
            c("Exigency evidence with NDPR consent", "High", "On evidence step.", ["Attach evidence.", "Accept NDPR.", "Submit."], "Evidence uploaded; consent recorded."),
            c("Exigency blocked on 1:1 plan", "High", "Standard plan ID.", ["Navigate to /plan/[id]/exigency."], "Blocked or redirected."),
            c("Exigency success screen", "Medium", "Report submitted.", ["Complete flow."], "Success confirmation shown."),
            c("Exigency outcome wallet notification", "High", "After admin/auto outcome.", ["Tap notification."], "Opens wallet with explanation."),
        ],
    },
    {
        "name": "A16. Disputes & Safety",
        "cases": [
            c("Disputes hub — plan and escrow tabs", "High", "User with disputes.", ["Open /disputes."], "Both types listed with status."),
            c("Plan no-show dispute — video + NDPR", "Critical", "Eligible dispute.", ["Record video.", "Accept NDPR.", "Submit."], "Video uploaded; dispute created."),
            c("Chat log consent — grant", "High", "After video step.", ["Grant chat access."], "Consent recorded for admin."),
            c("Chat log consent — deny", "High", "After video step.", ["Decline chat access."], "Dispute submitted without logs."),
            c("Dispute detail view", "High", "Existing dispute.", ["Open /dispute/[planId]/detail."], "Status, evidence, next steps visible."),
            c("Report user from chat/plan", "High", "Any context.", ["Submit report."], "Report recorded."),
        ],
    },
    {
        "name": "A17. Reviews & Ratings",
        "cases": [
            c("Submit review after review_unlock_at", "Critical", "Window open.", ["Open /plan/[id]/review.", "Submit ratings."], "Review saved; duplicate blocked."),
            c("Host rating badge on Discover", "Medium", "Rated host plan.", ["View discover card."], "Badge shows average and count."),
            c("Profile ratings on own profile tab", "High", "User with reviews.", ["Open Profile tab."], "Aggregated scores and list visible."),
            c("Public profile reviews", "Medium", "Member with reviews.", ["Open /user/[id]."], "Reviews listed per policy."),
            c("Report a review", "High", "Review on public profile.", ["Report review."], "Report queued for moderation."),
            c("review_request notification deep link", "High", "Notification received.", ["Tap notification."], "Opens /plan/[id]/review."),
        ],
    },
    {
        "name": "A18. Messaging & Chat",
        "cases": [
            c("Messages inbox loads threads", "Critical", "Has conversations.", ["Open Messages tab."], "List with preview, time, unread."),
            c("Send/receive text in DM", "High", "DM open; second account.", ["Send message."], "Delivered to recipient inbox."),
            c("Group chat thread and info", "High", "Group member.", ["Open group thread.", "Open group info."], "Messages deliver; member list accessible."),
            c("Chat from plan negotiation", "High", "Active negotiation.", ["Open chat from negotiate."], "Correct plan-linked thread."),
            c("Smart suggestions bar", "Medium", "Plan context in chat.", ["Tap suggestion chip."], "Inserts/sends suggested text."),
            c("Video message tap-to-play", "Medium", "Video attachment.", ["Tap video bubble."], "Plays without crash."),
            c("Push notification opens chat", "High", "Push enabled.", ["Receive message push.", "Tap."], "Correct thread opens."),
            c("Contact share policy block", "High", "Attempt restricted share.", ["Send blocked content pattern."], "ContactShareBlockedModal shown."),
            c("Chat safety report entry", "High", "Chat open.", ["Open safety/report."], "Report flow works."),
            c("Arrival nudge from group chat", "Medium", "Meetup day.", ["Tap arrival nudge."], "Partner notified."),
        ],
    },
    {
        "name": "A19. Live Location Sharing",
        "cases": [
            c("Share live location with NDPR consent", "High", "Plan chat open.", ["Tap share.", "Accept consent.", "Pick duration."], "Session starts; partner notified."),
            c("Partner views live location map", "High", "Partner sharing.", ["Open chat as counterparty."], "Map updates with partner pin."),
            c("Stop live location sharing", "High", "Currently sharing.", ["Stop sharing."], "Session ends for both."),
            c("Session auto-expiry", "Medium", "Short duration selected.", ["Wait for expiry."], "Sharing stops automatically."),
            c("live_location_started notification", "Medium", "Partner receives push.", ["Tap notification."], "Routes to plan or chat."),
        ],
    },
    {
        "name": "A20. Push Notifications & Deep Links",
        "cases": [
            c("Push token registration", "Critical", "Push permission granted.", ["Log in fresh.", "Check token sync."], "expo_push_token saved; push delivers."),
            c("Notification inbox and filters", "High", "Mixed notifications.", ["Open /notifications.", "Switch tabs."], "Filtered lists correct."),
            c("Offer notification → negotiate/agreement", "High", "Offer notification.", ["Tap."], "Correct plan/offer route."),
            c("Escrow funded notification → escrow", "High", "Escrow notification.", ["Tap."], "Opens /escrow/[id]."),
            c("group_minimum_not_met → minimum-action", "Critical", "Host notification.", ["Tap."], "Opens /plan/[id]/minimum-action."),
            c("meetup_confirm notifications → confirm", "High", "Confirm reminders.", ["Tap each type."], "Opens /plan/[id]/confirm."),
            c("disbursement/withdrawal → wallet", "High", "Wallet notifications.", ["Tap."], "Opens /wallet."),
            c("Admin-only notifications hidden from members", "Medium", "Admin-only type.", ["Open as regular user."], "Not visible."),
            c("Plan deep link (linkup://plan/...)", "High", "Shared plan link.", ["Open link on device."], "Plan detail opens."),
        ],
    },
    {
        "name": "A21. Profile, Settings & Privacy",
        "cases": [
            c("Edit profile (bio, photos, prompts)", "High", "Logged in.", ["Settings → Edit profile.", "Save."], "Changes visible on profile and discover."),
            c("Public user profile view", "High", "Other member.", ["Open /user/[id]."], "Public fields only; ratings if any."),
            c("Notification and visibility preferences", "High", "On settings.", ["Toggle push/email/visibility.", "Relaunch."], "Preferences persist."),
            c("Travel mode (Premium)", "High", "Gold+ user.", ["Set travel city.", "Browse Discover."], "Feed uses travel location."),
            c("Blocked users list and unblock", "High", "Blocked user exists.", ["View blocked list.", "Unblock."], "User unblocked; can interact again."),
            c("Privacy re-consent screen", "High", "Re-consent required.", ["Launch app.", "Accept."], "Access restored."),
            c("Delete account flow", "High", "Logged in.", ["Delete account.", "Confirm."], "Account deletion per policy; signed out."),
            c("Legal privacy policy page", "Medium", "Any user.", ["Open /legal/privacy-policy."], "Policy renders."),
            c(
                "Incognito browsing — Test 1: plan view suppression (Platinum)",
                "High",
                "[Testing Incognito Browsing] You need two test accounts: Account A (the Platinum user being tested) and Account B (the plan host / observer). Setup: Account A must be Platinum with incognito_browse_enabled = TRUE in their profile preferences (Settings → Privacy & safety → Incognito browsing).",
                [
                    "Account B creates a plan.",
                    "Account A (incognito on) views Account B's plan.",
                    "Account B opens the \"Who's interested\" screen for that plan.",
                ],
                "Account A does NOT appear in the list at all.",
            ),
            c(
                "Incognito browsing — Test 2: profile view suppression (Platinum)",
                "High",
                "[Testing Incognito Browsing] Account A is Platinum with incognito_browse_enabled = TRUE. Account B is the profile host / observer.",
                [
                    "Account A (incognito on) visits Account B's profile.",
                    "Check profile_views table directly in Supabase SQL editor: SELECT * FROM profile_views WHERE viewer_id = '<Account A user_id>' ORDER BY viewed_at DESC LIMIT 5",
                ],
                "No row inserted for Account A's visit.",
            ),
            c(
                "Incognito browsing — Test 3: confirm suppression vs UI-only hide (Platinum)",
                "High",
                "[Testing Incognito Browsing] Account A is Platinum with incognito_browse_enabled = TRUE. Account B has an active plan. Record Account A user_id and plan_id for DB checks.",
                [
                    "Disable incognito on Account A (Settings → Privacy & safety).",
                    "Account A views Account B's plan again.",
                    "Check plan_engagements: SELECT * FROM plan_engagements WHERE user_id = '<Account A>' AND plan_id = '<plan>'",
                    "Re-enable incognito on Account A.",
                    "Account A views Account B's plan again.",
                    "Re-run the plan_engagements query and compare row count / viewed_at.",
                ],
                "A row exists now (incognito off = recorded). Re-enable incognito, view the plan again — no new row added. Suppression is real, not UI-only.",
            ),
            c(
                "Profile view privacy — Test 1: profile view not recorded (Platinum)",
                "High",
                "[Testing Profile View Privacy] Setup: Account A must be Platinum with profile_view_privacy_enabled = TRUE but incognito_browse_enabled = FALSE. Account B is the profile host / observer.",
                [
                    "Account A visits Account B's profile.",
                    "Check profile_views: SELECT * FROM profile_views WHERE viewer_id = '<Account A>' ORDER BY viewed_at DESC LIMIT 5",
                ],
                "No row for this visit.",
            ),
            c(
                "Profile view privacy — Test 2: plan engagement IS still recorded (Platinum)",
                "High",
                "[Testing Profile View Privacy] Account A is Platinum with profile_view_privacy_enabled = TRUE and incognito_browse_enabled = FALSE. Account B has a published plan.",
                [
                    "Account A saves or views one of Account B's plans.",
                    "Check plan_engagements: SELECT * FROM plan_engagements WHERE user_id = '<Account A>'",
                ],
                "A row exists — plan engagement is NOT suppressed by profile view privacy.",
            ),
            c(
                "Profile view privacy — Test 3: confirm plan interest vs profile visit distinction (Platinum)",
                "High",
                "[Testing Profile View Privacy] Account A is Platinum with profile_view_privacy_enabled = TRUE and incognito_browse_enabled = FALSE. Account A has already viewed Account B's plan (engagement recorded). Account B is Gold+ host.",
                [
                    "Account B opens the interest screen for the plan Account A viewed.",
                    "Separately confirm whether Account B has any UI indicating Account A visited their profile page (profile views list / notification).",
                ],
                "Account A appears (because plan engagement was recorded). But Account B cannot see that Account A visited their profile page specifically.",
            ),
            c(
                "Masked activity — Test 1: recorded in DB but hidden from carousels (Platinum)",
                "High",
                "[Testing Masked Activity] Setup: Account A must be Platinum with masked_activity_enabled = TRUE. Account B has a published plan with engagement carousels visible to the host.",
                [
                    "Account A views Account B's plan.",
                    "Check plan_engagements directly in the database: SELECT * FROM plan_engagements WHERE user_id = '<Account A user_id>' AND plan_id = '<plan_id>'",
                    "As Account B, check if Account A appears in any engagement carousel in the UI.",
                ],
                "Row IS written (masked activity does not suppress recording). Account A does NOT appear in the carousel (filtered at render time).",
            ),
            c(
                "Masked activity — Test 2: presence indicator suppressed (Platinum)",
                "High",
                "[Testing Masked Activity] Account A is Platinum with masked_activity_enabled = TRUE and is actively using the app (online). Account B can view Account A's profile or a plan where presence is shown.",
                [
                    "Account A is actively using the app (online; keep foreground on mobile).",
                    "Account B views Account A's profile or a plan where presence is shown.",
                ],
                "Account A appears as offline / no presence indicator (masked activity suppresses the online chip).",
            ),
            c(
                "Masked activity — Test 3: confirm difference from incognito (Platinum)",
                "High",
                "[Testing Masked Activity] Account A is Platinum with masked_activity_enabled = TRUE and incognito_browse_enabled = FALSE. Account B is Gold+ host with a published plan.",
                [
                    "Account A (masked activity on, incognito OFF) views Account B's plan.",
                    "Check plan_engagements — confirm row IS written: SELECT * FROM plan_engagements WHERE user_id = '<Account A user_id>' AND plan_id = '<plan_id>'",
                    "Account B opens the raw interest screen (Gold+) for that plan.",
                    "Compare with engagement carousel surfaces on the same plan.",
                ],
                "plan_engagements row IS written. Account A MAY appear on the raw interest screen (depending on whether the filter is applied at that layer). Account A does NOT appear in engagement carousels. Key distinction: masked activity hides from carousels but the record exists — unlike incognito, which suppresses recording entirely.",
            ),
        ],
    },
    {
        "name": "A22. KYC & Identity Verification",
        "cases": [
            c("KYC hard gate on create plan", "Critical", "Unverified user.", ["Attempt create plan."], "VerificationHardGateModal; routes to /kyc."),
            c("Complete KYC wizard (ID + liveness)", "Critical", "User on /kyc.", ["Select ID.", "Capture docs.", "Record liveness.", "Submit."], "Submission pending; status updated."),
            c("KYC draft resume", "High", "Partial KYC.", ["Exit and return to /kyc."], "Draft restored."),
            c("Soft KYC prompt on Discover", "Medium", "Post-onboarding.", ["Dismiss prompt."], "Can browse; prompt may reappear."),
            c("Verified user passes offer/plan gates", "High", "KYC approved.", ["Create plan and send offer."], "Gates no longer block."),
            c("Verification status page", "Medium", "Any verification state.", ["Open /settings/verification."], "Status accurate."),
        ],
    },
    {
        "name": "A23. Premium & Subscriptions",
        "cases": [
            c("Subscription tiers page", "High", "Logged in.", ["Open /subscription."], "All tiers and features listed."),
            c("Flutterwave membership checkout", "High", "Test keys configured.", ["Select tier.", "Complete checkout."], "Subscription active; badge updated."),
            c("Subscription payment callback", "High", "Checkout initiated.", ["Complete payment.", "Return via callback."], "Tier activated."),
            c("Cancel subscription", "High", "Active subscription.", ["Cancel from subscription page."], "Status updated; access until period end."),
            c("Gold trial from Silver", "Medium", "Eligible Silver.", ["Activate Gold trial."], "7-day Gold active."),
            c("Permission-gated feature matrix smoke", "High", "Free, Silver, Gold, Platinum accounts.", ["Test bookmark, group host, pattern B/C, travel."], "Each gate matches tier permissions."),
            c("Trial banner and expiry notifications", "Medium", "Trial active.", ["Observe banner.", "Near expiry notification."], "Copy accurate; upgrade path works."),
        ],
    },
    {
        "name": "A24. Plan Management (Creator Hub)",
        "cases": [
            c("Plan management shelf sections", "High", "Creator with plans.", ["Open /settings/plan-management."], "All/active/mood/expired/drafts/archived sections load."),
            c("Search and sort creator plans", "Medium", "Multiple plans.", ["Search.", "Change sort."], "Results correct."),
            c("Edit published plan", "High", "Own published plan.", ["Edit title/schedule.", "Save."], "Changes persist in feed/detail."),
            c("Archive and unarchive plan", "High", "Active plan.", ["Archive.", "Unarchive."], "Status toggles correctly."),
            c("Delete draft plan", "High", "Draft exists.", ["Delete draft.", "Confirm."], "Removed from shelf."),
            c("Duplicate plan", "Low", "Existing plan.", ["Duplicate from shelf."], "New draft with copied fields."),
        ],
    },
    {
        "name": "A25. Invitations & Deep Links",
        "cases": [
            c("Plan invitation email link opens app", "Critical", "Invitation email received.", ["Tap link on device with app."], "Invitation screen opens."),
            c("Invitation accept → agreement routing", "High", "Accepted invitation.", ["Accept."], "Routes to agreement when payment required."),
            c("Auth next param preserved through signup", "High", "Unauthenticated invite link.", ["Sign up.", "Complete onboarding."], "Returns to intended plan route."),
        ],
    },
    {
        "name": "A26. Policy Modals & Compliance",
        "cases": [
            c("Group plan policy gate content (Annexure B #2)", "Critical", "First group interaction.", ["Read modal sections.", "Sign."], "Content matches policySignOffContent."),
            c("Escrow policy pattern-specific matrix (#3)", "Critical", "Patterns A, B, C.", ["Sign off each pattern plan."], "Correct matrix rows per pattern."),
            c("Safety caveat once per pair (#4)", "High", "New counterparty pair.", ["Fund twice with same pair."], "Interstitial once only."),
            c("Dispute video NDPR (#8)", "Critical", "Filing dispute.", ["Review consent copy."], "Consent required before submit."),
            c("Exigency evidence NDPR (#9)", "Critical", "Exigency with evidence.", ["Review consent."], "Consent required."),
        ],
    },
    {
        "name": "A27. Support",
        "cases": [
            c("Support home and quick topics", "High", "Logged in.", ["Open /support."], "Topics and create ticket CTA visible."),
            c("Create support ticket", "High", "Logged in.", ["Submit ticket with category."], "Confirmation shown; ticket in list."),
            c("Reply on existing ticket", "Medium", "Open ticket.", ["Send reply."], "Reply appended."),
            c("Payment disambiguation modal", "Medium", "Payment-related support entry.", ["Open disambiguation."], "Routes to correct help path."),
            c("Ticket detail from notification", "High", "Ticket update notification.", ["Tap."], "Opens /support/ticket/[id]."),
        ],
    },
    {
        "name": "A28. Admin (Mobile)",
        "cases": [
            c("Admin access control", "Critical", "Admin and non-admin.", ["Open /admin."], "Non-admin blocked; admin sees tabs."),
            c("KYC verify queue approve/reject", "Critical", "Pending KYC.", ["Admin → verify.", "Approve."], "User verified; Silver trial if applicable."),
            c("User reports moderation", "High", "Pending report.", ["Review and action."], "Report resolved."),
            c("Plan and escrow dispute queues", "High", "Open disputes.", ["Review plan_disputes tab."], "Can view evidence and resolve."),
            c("Meet types approval", "High", "Pending custom type.", ["Approve meet type."], "Active for users."),
            c("Support tickets admin", "High", "Open ticket.", ["Reply as admin."], "Member sees update."),
        ],
    },
    {
        "name": "A29. Mobile Platform & Reliability",
        "cases": [
            c("App background and resume", "Medium", "Logged in.", ["Background 30s.", "Resume."], "Session intact; no crash."),
            c("Pull to refresh Discover/Meetr", "Medium", "On feed.", ["Pull to refresh."], "Feed reloads."),
            c("Offline graceful error", "High", "Airplane mode.", ["Open Discover/Messages."], "Friendly error; no white screen."),
            c("Keyboard safe areas on forms", "Medium", "Onboarding/login forms.", ["Focus fields near bottom."], "Inputs not hidden by keyboard."),
            c("Android and iOS layout parity smoke", "High", "Same flows on both OS.", ["Run critical path on iOS and Android."], "No layout breaks or missing CTAs."),
        ],
    },
]

# ---------------------------------------------------------------------------
# PART B — LINKUP WEB (Browser)
# Execute TC-W-001 through TC-W-NNN in order for launch sign-off.
# ---------------------------------------------------------------------------

WEB_SECTIONS: list[QaSection] = [
    {
        "name": "B1. Authentication & Account Access",
        "cases": [
            c("Web login (email/password)", "Critical", "Browser; staging URL.", ["Open /login.", "Enter credentials.", "Submit."], "Session established; routed correctly."),
            c("Web signup with email confirmation", "Critical", "Unused email; SMTP on.", ["Complete /signup.", "Confirm email."], "Account confirmed; onboarding or discover."),
            c("Google OAuth on web", "High", "Google enabled.", ["Continue with Google on login/signup."], "Session created."),
            c("Forgot and reset password", "High", "Registered email.", ["Forgot password flow.", "Reset via email link."], "New password works on /login."),
            c("Auth callback and cookie session", "Critical", "OAuth or confirm link.", ["Complete /auth/callback."], "Session persisted on refresh."),
            c("Recovery route /auth/recovery", "High", "Recovery link.", ["Open recovery URL.", "Set password."], "Password updated."),
            c("Sign out clears session", "High", "Logged in.", ["Sign out from /profile."], "Protected routes redirect to login."),
            c("Privacy consent at signup", "High", "On signup.", ["Attempt without consent."], "Blocked until accepted."),
            c("Post-auth routing (onboarding vs discover)", "Critical", "New vs returning user.", ["Log in each type."], "Correct destination per onboarding_status."),
        ],
    },
    {
        "name": "B2. Onboarding & Profile Setup",
        "cases": [
            c("Complete web onboarding wizard", "Critical", "New user.", ["Complete all steps at /onboarding.", "Publish."], "onboarding_status complete; /discover loads."),
            c("Finish blocked when requirements invalid", "Critical", "On preview; remove required photos.", ["Finish onboarding."], "Validation error; navigates to failing step."),
            c("Profile media manager (photos + video)", "Critical", "On onboarding/edit.", ["Upload min photos and intro video."], "Media persists; meets minimums."),
            c("Prompt editor and tags", "High", "On onboarding.", ["Add interests, languages, prompts."], "Saved to profile."),
            c("Africa-only location search", "High", "Location step.", ["Search Paris vs Lagos venue."], "Africa-only suggestions; coords on select."),
            c("Invitation token after signup", "High", "Signup with invitation.", ["Complete onboarding."], "Routes to invitation screen."),
            c("Soft KYC modal queue after onboarding", "Medium", "First session.", ["Land on discover."], "Soft KYC modal shows per policy."),
        ],
    },
    {
        "name": "B3. Discover Feed & Search",
        "cases": [
            c("Discover page loads plan cards", "Critical", "Logged in; plans exist.", ["Open /discover."], "Cards with host media and CTAs."),
            c("Discover search and filters", "High", "On discover.", ["Search.", "Apply DiscoverFilterPanel."], "Results respect query/filters."),
            c("Mood filter and timeline carousel", "High", "Mood plans exist.", ["Use mood filter/timeline."], "Mood plans shown with countdown/reach."),
            c("Mood reach visibility (20km widest)", "High", "Gold mood plan; viewers at varied distance.", ["Browse as nearby/far user."], "Visibility matches mood_reach_km."),
            c("Save/bookmark plan", "High", "Eligible tier.", ["Bookmark from card."], "Appears on /plans saved list."),
            c("Plan card → plan detail", "Critical", "Plan in feed.", ["Click card."], "Opens /plan/[id]."),
            c("Host public profile from card", "High", "Plan in feed.", ["Click host."], "Opens /user/[id]."),
            c("KYC banner on discover", "High", "Unverified user.", ["Open /discover."], "Verification prompt visible."),
            c("Create plan entry (nav to /plan/create)", "Critical", "Verified user.", ["Click create plan."], "Create screen opens."),
            c("Travel mode affects discover ranking", "High", "Gold+ with travel set.", ["Set travel in /profile/travel.", "Browse discover."], "Feed uses travel origin."),
            c("Premium upgrade gate on discover", "High", "Free user.", ["Trigger gated filter/action."], "UpgradeGate modal; subscription path."),
            c("Privacy re-consent banner", "High", "Re-consent required.", ["Open discover."], "Banner blocks until accepted."),
            c("Incognito browse (Platinum)", "Medium", "Platinum user.", ["Enable incognito.", "Engage with plan."], "Engagement hidden from host per policy."),
        ],
    },
    {
        "name": "B4. Meetr Explorer",
        "cases": [
            c("Meetr page category grid", "High", "Logged in.", ["Open /meetr."], "Meet types displayed."),
            c("Filter discover by meet type", "High", "Catalog types.", ["Select type."], "Discover filtered."),
            c("Pending custom meet type state", "Medium", "Pending submission.", ["View pending tile."], "Pending indicator; not active."),
        ],
    },
    {
        "name": "B5. Saved Plans & Offers",
        "cases": [
            c("Saved plans at /plans", "High", "Bookmarked plans.", ["Open /plans."], "Saved list correct."),
            c("Offers dashboard /offers", "High", "Active offers.", ["Open /offers.", "Review sent/received."], "Statuses accurate."),
            c("Verification gate on offer actions", "High", "Unverified user.", ["Attempt offer action."], "VerificationGateDialog shown."),
            c("Accept offer → agreement", "Critical", "Acceptable offer.", ["Accept."], "Navigates to /plan/[id]/agreement."),
        ],
    },
    {
        "name": "B6. Plan Creation",
        "cases": [
            c("Create standard paid plan (/plan/create)", "Critical", "Verified host.", ["Complete CreatePlanScreen.", "Publish."], "Plan live in discover."),
            c("Create mood plan with reach stamp", "Critical", "Tier allows mood.", ["Enable mood fields.", "Publish."], "mood_reach set from tier."),
            c("Create group plan with policy gate", "Critical", "Group host permission.", ["Sign GroupPlanPolicyGate.", "Set min members.", "Publish."], "Group plan created."),
            c("Escrow patterns A/B/C on create", "High", "Paid plans.", ["Select each pattern."], "Pattern saved correctly."),
            c("Visibility and premium gates", "High", "Mixed tiers.", ["Test tier visibility options."], "Gates match permissions."),
            c("Africa-only plan location search", "High", "Location on create.", ["Search venues."], "Africa-only; POI suggestions work."),
            c("Verification gate blocks publish", "Critical", "Unverified.", ["Attempt publish."], "Blocked with gate."),
        ],
    },
    {
        "name": "B7. Plan Detail & Lifecycle",
        "cases": [
            c("Plan detail overview /plan/[id]", "Critical", "Published plan.", ["Open detail."], "Title, meta, CTAs render."),
            c("Meetup meta including Created date", "High", "Any plan.", ["Review meta cards."], "When/Where/Price/Created shown."),
            c("Plan share modal", "High", "Published plan.", ["Open PlanShareModal.", "Copy link."], "Link copies; share works."),
            c("Invite guests modal (group)", "High", "Group host.", ["Send invitation."], "Guest notified."),
            c("Join requests my/ host manage", "High", "Group plan.", ["Guest: /requests/my.", "Host: /plan/[id]/requests."], "Request flow works."),
            c("Plan invitation accept route", "Critical", "Valid invitation.", ["Open /plan/[id]/invitation/[id]."], "Accept routes correctly."),
            c("Plan boost on detail", "Medium", "Eligible tier.", ["Apply boost."], "Boosted state shown."),
            c("Extend mood plan", "Medium", "Gold+ host.", ["Extend mood TTL."], "Extension applied per rules."),
            c("Host cancel group plan modal", "Critical", "Group host.", ["Cancel with terms."], "Refunds and notifications sent."),
            c("Guest opt-out on detail", "High", "Guest >48h before meetup.", ["Opt out."], "Refund per policy."),
            c("Minimum-action page", "Critical", "Below minimum T-48h.", ["Open /plan/[id]/minimum-action."], "All three host actions work."),
            c("Group meetup completion section", "Critical", "Post-meetup.", ["Host confirms completion."], "Guest confirm window opens."),
            c("Cancellation summary card", "High", "Paid plan.", ["View cancellation summary."], "Matches DB matrix."),
            c("Plan creator edit modal", "High", "Own plan.", ["Edit and save."], "Changes persist."),
            c("Plan management archive/delete/duplicate", "High", "Creator on /plan-management.", ["Archive.", "Duplicate draft."], "Shelf actions work."),
        ],
    },
    {
        "name": "B8. Negotiation & Agreement",
        "cases": [
            c("Negotiation page /plan/[id]/negotiate", "Critical", "Active offer thread.", ["Open negotiate.", "Submit/counter."], "Thread updates in realtime."),
            c("Agreement page gross amounts", "Critical", "Paid plan.", ["Open /plan/[id]/agreement."], "Gross amounts match checkout."),
            c("Mutual confirmation before payment", "High", "One party confirmed.", ["Attempt pay before both confirm."], "Blocked until both confirm."),
            c("Pre-agreement review content inline", "High", "First agreement.", ["Review legal summary.", "Proceed."], "Gate satisfied."),
            c("Escrow policy sign-off modal", "Critical", "Before checkout.", ["Sign EscrowPolicySignOffModal."], "Pattern matrix shown; blocks until signed."),
            c("Proceed to secure payment", "Critical", "Confirmed payer.", ["proceedToSecurePayment."], "Lands on /escrow/[id]."),
            c("Free plan confirm path", "High", "Free plan.", ["Both confirm."], "Activates without escrow."),
        ],
    },
    {
        "name": "B9. Escrow & Payments",
        "cases": [
            c("Escrow detail /escrow/[id]", "Critical", "Pending escrow.", ["Open escrow page."], "Status, amounts, actions visible."),
            c("Flutterwave redirect checkout", "Critical", "Test keys.", ["Pay via redirect.", "Return."], "Payment verified; escrow funded."),
            c("Escrow callback page /escrow/callback", "Critical", "After redirect payment.", ["Land on callback."], "Routes to success/escrow state."),
            c("Bank transfer /escrow/[id]/bank-transfer", "Critical", "Bank transfer selected.", ["Complete refund account.", "Get VA."], "VA details correct."),
            c("Host share payment modal (group split)", "High", "Group host leg.", ["Open HostSharePaymentModal.", "Pay."], "Host share funded."),
            c("Pattern B/C escrow legs", "High", "Split plans.", ["Fund each leg."], "Amounts match pattern."),
            c("Safety caveat on first fund", "High", "New pair.", ["Fund escrow."], "SafetyCaveatInterstitial once."),
            c("High-value escrow modal", "High", "Above threshold.", ["Trigger high-value flow."], "Modal/notice; gates enforced."),
            c("Open escrow dispute modal", "High", "Funded escrow.", ["Open dispute."], "Escrow dispute created."),
            c("Goodwill at checkout", "Medium", "Goodwill balance.", ["Apply at payment."], "Discount applied correctly."),
            c("Payment flow matrix smoke (§10 doc)", "Critical", "Reference PAYMENT_FLOW_CONTENT_MATRIX.md.", ["For each plan kind × pattern × role: agreement → pay."], "Copy and amounts correct per cell."),
        ],
    },
    {
        "name": "B10. Wallet & Refund Account",
        "cases": [
            c("Wallet page /wallet", "Critical", "User with balance.", ["Open /wallet."], "Balance, ledger, goodwill shown."),
            c("Pending disbursement queue", "High", "Post-confirm payout.", ["View pending section."], "Items listed with status."),
            c("WalletWithdrawDialog", "Critical", "Withdrawable balance.", ["Withdraw to bank."], "disburse-wallet succeeds."),
            c("Refund account settings /settings/refund-account", "High", "No saved account.", ["Add verified bank account."], "Saved for withdrawals/refunds."),
            c("Post-cancel wallet redirect", "High", "After group cancel.", ["Follow notification/link."], "Wallet shows refund credit."),
        ],
    },
    {
        "name": "B11. Meetup Confirmation & Post-Meetup",
        "cases": [
            c("1:1 confirm /plan/[id]/confirm", "Critical", "Confirm window open.", ["ConfirmMeetupClient: Yes attended."], "Disbursement queued."),
            c("Group guest confirm GroupGuestConfirmClient", "Critical", "Group guest window.", ["Confirm attendance."], "Guest confirmed."),
            c("Report problem from confirm", "High", "On confirm.", ["Report problem."], "Routes to dispute/exigency path."),
            c("Go to wallet after confirm", "High", "After success.", ["Click wallet link."], "Wallet updated."),
            c("Group countdown banner", "Medium", "Group plan deadlines.", ["View on detail/confirm."], "Banner accurate."),
        ],
    },
    {
        "name": "B12. Group Plans, Exigency & Annexure B",
        "cases": [
            c("GroupPlanPolicyGate on create/detail", "Critical", "First group interaction.", ["Sign policy modal."], "Annexure B content; blocks until signed."),
            c("GroupPlanMemberCountBadge", "High", "Partial group.", ["View member count."], "Accurate vs minimum."),
            c("Exigency report /plan/[id]/exigency", "Critical", "Group guest.", ["Complete ExigencyReportClient."], "Report submitted."),
            c("Exigency NDPR evidence consent", "High", "Evidence step.", ["Accept NDPR."], "Consent recorded."),
            c("Exigency 404 on non-group plan", "High", "1:1 plan ID.", ["Navigate to exigency URL."], "404 or safe redirect."),
            c("Platform fee refund copy on host cancel", "Medium", "Host cancel.", ["Review terms."], "Copy matches policy."),
        ],
    },
    {
        "name": "B13. Disputes & Safety",
        "cases": [
            c("Disputes hub /disputes", "High", "User with disputes.", ["Open disputes."], "Plan and escrow disputes listed."),
            c("Plan dispute /dispute/[planId]", "Critical", "Eligible report.", ["Video + NDPR.", "Chat consent."], "Dispute created."),
            c("Dispute detail /dispute/[planId]/detail", "High", "Existing dispute.", ["Open detail."], "Status and evidence visible."),
            c("Chat safety sheet in chat", "High", "Chat open.", ["Report from ChatSafetySheet."], "Report submitted."),
        ],
    },
    {
        "name": "B14. Reviews & Ratings",
        "cases": [
            c("Review page /plan/[id]/review", "Critical", "review_unlock_at passed.", ["Submit ReviewMeetupClient."], "Review saved."),
            c("HostRatingBadge on discover", "Medium", "Rated host.", ["View card."], "Badge shows score."),
            c("Reviews on /user/[id]", "High", "Profile with reviews.", ["Open public profile."], "ReviewList renders."),
            c("ReportReviewButton", "High", "On profile review.", ["Report."], "Queued for admin."),
        ],
    },
    {
        "name": "B15. Messaging & Chat",
        "cases": [
            c("Messages inbox /messages", "Critical", "Has threads.", ["Open inbox."], "Threads with preview/unread."),
            c("1:1 chat /chat/[id]", "Critical", "DM exists.", ["Send message."], "Realtime delivery."),
            c("Group chat /chat/group/[id]", "High", "Group member.", ["Send in group.", "Open info."], "Messages and members work."),
            c("Group chat info /chat/group/[id]/info", "High", "Group chat.", ["View members/settings."], "Info page loads."),
            c("Live location in chat", "High", "Plan chat.", ["Share location.", "Partner views map."], "LinkUpMap updates."),
            c("LiveLocationConsentModal", "High", "Before share.", ["Review consent."], "Required before sharing."),
            c("Arrival nudge in chat", "Medium", "Meetup day.", ["Send nudge."], "Partner notified."),
            c("Read receipts preference (premium)", "Medium", "Gold+ with pref on.", ["Send/read messages."], "Receipts shown per policy."),
        ],
    },
    {
        "name": "B16. Notifications (In-App)",
        "cases": [
            c("Notification inbox /notifications", "High", "Mixed types.", ["Open inbox.", "Filter tabs."], "Categories correct."),
            c("Deep link: meetup_confirm → /plan/.../confirm", "High", "Confirm notification.", ["Click row."], "Confirm page opens."),
            c("Deep link: review_request → /plan/.../review", "High", "Review notification.", ["Click."], "Review page opens."),
            c("Deep link: group_minimum → minimum-action", "Critical", "Host notification.", ["Click."], "Minimum-action opens."),
            c("Deep link: disbursement → /wallet", "High", "Wallet notification.", ["Click."], "Wallet opens."),
            c("Deep link: mood_plan_nearby → /discover", "High", "Mood nearby notification.", ["Click."], "Discover opens."),
        ],
    },
    {
        "name": "B17. Profile, Settings & Trust",
        "cases": [
            c("Profile hub /profile", "High", "Logged in.", ["Open profile."], "Stats, links, subscription card."),
            c("Edit profile /profile/edit", "High", "Logged in.", ["Edit and save."], "Changes persist."),
            c("Public profile /user/[id]", "High", "Other member.", ["View profile."], "Public fields only."),
            c("Notifications settings /profile/notifications", "High", "Logged in.", ["Toggle email/push prefs."], "Saved."),
            c("Privacy /profile/privacy", "High", "Logged in.", ["Update privacy toggles."], "Persist."),
            c("Travel mode /profile/travel", "High", "Gold+.", ["Set travel city."], "Discover uses travel pin."),
            c("Delete account /profile/delete-account", "High", "Logged in.", ["Complete deletion flow."], "Account removed; signed out."),
            c("Trust center /trust", "High", "Any user.", ["Open /trust."], "Verification status and KYC link."),
            c("Blocked users management", "High", "Blocked list.", ["Unblock user."], "Block removed."),
        ],
    },
    {
        "name": "B18. KYC Verification",
        "cases": [
            c("KYC wizard /kyc", "Critical", "Unverified user.", ["Complete all steps."], "Submission pending."),
            c("VerificationGateDialog on gated action", "High", "Unverified.", ["Trigger gated feature."], "Dialog; link to /kyc."),
            c("Verification nudge banner", "Medium", "Unverified browsing.", ["View banner on discover."], "CTA to /kyc."),
            c("Trust page after approval", "High", "Approved KYC.", ["Open /trust."], "Verified status shown."),
        ],
    },
    {
        "name": "B19. Premium & Subscriptions",
        "cases": [
            c("Subscription page /subscription", "High", "Logged in.", ["View tiers."], "All tiers and pricing shown."),
            c("Flutterwave subscription checkout redirect", "High", "Test keys.", ["Checkout.", "Return callback."], "Tier activated."),
            c("Subscription callback /subscription/callback", "High", "After payment.", ["Land on callback."], "Success state; tier updated."),
            c("Cancel subscription", "High", "Active sub.", ["Cancel."], "Status updated."),
            c("Gold trial activation", "Medium", "Eligible Silver.", ["Start trial."], "Gold perks for 7 days."),
            c("Permission matrix smoke on web", "High", "Multi-tier accounts.", ["Test gates: group host, pattern B/C, travel."], "Matches permission-service."),
        ],
    },
    {
        "name": "B20. Plan Management",
        "cases": [
            c("Plan management nav tab /plan-management", "High", "Creator.", ["Open main nav Manage."], "Shelf loads all sections."),
            c("Search sort filter plans", "Medium", "Many plans.", ["Search and sort."], "Results correct."),
            c("Edit modal on live plan", "High", "Published plan.", ["Edit via PlanCreatorEditModal."], "Saved."),
            c("Archive unarchive delete draft", "High", "Various plan states.", ["Perform shelf actions."], "States update correctly."),
        ],
    },
    {
        "name": "B21. Invitations & Public Sharing",
        "cases": [
            c("Invitation email link on web", "Critical", "Invitation received.", ["Open link logged in/out."], "Invitation screen loads."),
            c("Public plan preview /plan/[id]/preview", "Critical", "Published plan; logged out.", ["Open preview URL."], "OG card and plan summary render."),
            c("OG share card API /api/plan/[id]/card", "High", "Share debugger or social.", ["Fetch card endpoint."], "Returns image/metadata."),
            c("Auth next cookie preserved", "High", "Logged-out invite.", ["Sign up.", "Complete auth."], "Returns to plan route."),
        ],
    },
    {
        "name": "B22. Policy & Legal",
        "cases": [
            c("Privacy policy /legal/privacy-policy", "High", "Any user.", ["Open page."], "Renders completely."),
            c("Privacy re-consent /legal/privacy-reconsent", "High", "Re-consent flag.", ["Accept."], "Access restored."),
            c("Group policy modal Annexure B #2", "Critical", "First group plan.", ["Sign GroupPlanPolicyModal."], "Full policy text."),
            c("Escrow policy modal #3 all patterns", "Critical", "Patterns A/B/C.", ["Sign each."], "Correct cancellation matrix."),
            c("Safety caveat #4", "High", "First fund new pair.", ["Fund escrow."], "Shown once."),
            c("Dispute/exigency NDPR #8/#9", "Critical", "Dispute and exigency.", ["Review consent copy."], "Required before submit."),
        ],
    },
    {
        "name": "B23. Support",
        "cases": [
            c("Support home /support", "High", "Logged in.", ["Open support."], "Topics and tickets visible."),
            c("Create ticket", "High", "Logged in.", ["Submit new ticket."], "Confirmation; appears in list."),
            c("Ticket detail /support/ticket/[id]", "High", "Open ticket.", ["Reply."], "Thread updates."),
            c("Payment disambiguation", "Medium", "Payment help entry.", ["Use disambiguation."], "Correct FAQ/route."),
        ],
    },
    {
        "name": "B24. Admin (Web)",
        "cases": [
            c("Admin dashboard /admin access", "Critical", "Admin vs member.", ["Open /admin."], "Member blocked; admin sees tabs."),
            c("KYC verify tab", "Critical", "Pending submission.", ["Approve KYC."], "User verified."),
            c("Reports and moderation tabs", "High", "Pending items.", ["Resolve report."], "Action persists."),
            c("Plan disputes AdminExigencySection", "High", "Open exigency.", ["Review and resolve."], "Outcome applied."),
            c("Review reports tab (web-only)", "Critical", "Reported review.", ["Admin tab review_reports."], "Moderation action works."),
            c("Meet types admin", "High", "Pending type.", ["Approve."], "Type live."),
            c("Support tickets admin", "High", "Open ticket.", ["Admin reply."], "Member notified."),
            c("User subscription events /admin/users/[id]/subscription-events", "Medium", "Admin viewing user.", ["Open subscription events."], "History loads."),
        ],
    },
    {
        "name": "B25. Web Platform & Reliability",
        "cases": [
            c("Desktop responsive layout (1280px+)", "High", "Desktop browser.", ["Browse discover, plan, chat."], "No broken layouts."),
            c("Mobile browser responsive (375px)", "High", "Mobile viewport.", ["Run critical path."], "Usable; no horizontal scroll bugs."),
            c("Session refresh on page reload", "High", "Logged in.", ["Reload on protected route."], "Session persists."),
            c("404 not found handling", "Low", "Invalid URL.", ["Navigate to bad route."], "Friendly not found."),
            c("Supabase misconfig empty state", "Medium", "Missing env (staging only).", ["Load app."], "Clear error; no crash."),
        ],
    },
]


def count_cases(sections: list[QaSection]) -> int:
    return sum(len(s["cases"]) for s in sections)


MOBILE_CASE_COUNT = count_cases(MOBILE_SECTIONS)
WEB_CASE_COUNT = count_cases(WEB_SECTIONS)
TOTAL_CASE_COUNT = MOBILE_CASE_COUNT + WEB_CASE_COUNT
