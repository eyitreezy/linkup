"""Regenerate LinkUp QA user test case Word documents."""
from __future__ import annotations

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt

ROOT = Path(__file__).resolve().parent
DOCX_PATH = ROOT / "LinkUp-QA-User-Test-Cases.docx"
DOC_PATH = ROOT / "LinkUp-QA-User-Test-Cases.doc"
GENERATED = date.today().isoformat()
VERSION = "1.3"
TOTAL_CASES = 170


def add_heading(doc: Document, text: str, level: int = 1) -> None:
    doc.add_heading(text, level=level)


def add_para(doc: Document, text: str, bold: bool = False) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold


def add_table_row(table, cells: list[str]) -> None:
    row = table.add_row().cells
    for i, value in enumerate(cells):
        row[i].text = value


def add_test_case(
    doc: Document,
    case_id: str,
    title: str,
    module: str,
    priority: str,
    preconditions: str,
    steps: list[str],
    expected: str,
) -> None:
    doc.add_heading(f"{case_id}: {title}", level=3)
    table = doc.add_table(rows=1, cols=4)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    hdr[0].text = "Test ID"
    hdr[1].text = "Module"
    hdr[2].text = "Priority"
    hdr[3].text = "Result"
    add_table_row(table, [case_id, module, priority, "Pass / Fail / Blocked"])
    add_para(doc, "Preconditions:", bold=True)
    add_para(doc, preconditions)
    add_para(doc, "Test Steps:", bold=True)
    for i, step in enumerate(steps, start=1):
        add_para(doc, f"{i}. {step}")
    add_para(doc, "Expected Result:", bold=True)
    add_para(doc, expected)
    doc.add_paragraph()


def build_document() -> Document:
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)

    title = doc.add_heading("LinkUp - User Test Cases", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub = doc.add_paragraph("Quality Assurance · Manual User Acceptance Testing")
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta = doc.add_paragraph(
        f"Document version: {VERSION}    Generated: {GENERATED}    Product: LinkUp Mobile + LinkUp Web"
    )
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER

    add_heading(doc, "1. Purpose & Scope", 1)
    add_para(
        doc,
        "This document defines manual user test cases for LinkUp (mobile iOS/Android and web browser), a social "
        "meetup platform with discovery, plans, negotiation, escrow (Flutterwave), wallet disbursement, group "
        "plans (Annexure B), meetup confirmation, exigency reports, live location sharing, reviews and ratings, "
        "disputes (video evidence and chat log consent), messaging, verification (KYC), membership tiers, and "
        "admin tooling. Cases are written for QA testers, UAT participants, and release sign-off.",
    )
    add_para(
        doc,
        "Platform tags in preconditions: Mobile = iOS/Android app only; Web = linkup-web browser app only; "
        "Both = execute on mobile and web unless marked otherwise. Section 'LinkUp Web' covers web-specific "
        "routes, layout, and smoke checks aligned with docs/PAYMENT_FLOW_CONTENT_MATRIX.md in linkup-web.",
    )

    add_heading(doc, "2. Test Environment", 1)
    for line in [
        "Staging or production Supabase project with Auth SMTP configured (signup/reset emails deliver).",
        "Physical device recommended for push notifications, deep links (linkup://auth/callback), and KYC camera flows.",
        "Test accounts: unverified member, verified member, Silver/Gold/Platinum member, admin (admins table row).",
        "Flutterwave test keys for escrow and membership checkout; bank transfer virtual account function deployed.",
        "Edge functions deployed for QA: create-escrow-payment, generate-virtual-account, verify-bank-account, list-nigerian-banks, verify-flutterwave-payment, flutterwave-webhook, disburse-wallet, disbursement-sweep, submit-arrival-nudge, submit-dispute-video, submit-exigency-report.",
        "Migrations applied: group_plan_annexure_b, meetup_confirmation_disbursement, rating_review_system, annexure_b_missing_features.",
        "Nigerian banks seed/migration applied (nigerian_banks table populated; bank codes aligned).",
        "Web: linkup-web deployed against same Supabase project; desktop Chrome/Safari recommended for web-only cases.",
        "Optional second device/account for messaging, offer negotiation, split escrow funding, live location, and meetup confirmation.",
    ]:
        doc.add_paragraph(line, style="List Bullet")

    add_heading(doc, "3. Priority Definitions", 1)
    pri = doc.add_table(rows=1, cols=2)
    pri.style = "Table Grid"
    pri.rows[0].cells[0].text = "Priority"
    pri.rows[0].cells[1].text = "Definition"
    for p, d in [
        ("Critical", "Blocks release; core auth, onboarding, discover, plan pay flow, or data loss risk."),
        ("High", "Major feature broken; workaround difficult."),
        ("Medium", "Secondary feature or UX issue with workaround."),
        ("Low", "Cosmetic or edge case."),
    ]:
        add_table_row(pri, [p, d])

    add_heading(doc, "4. How to Execute", 1)
    add_para(
        doc,
        "For each test case record: Tester name, Date, Environment (OS/build), Result (Pass/Fail/Blocked), "
        "Actual result, Screenshot/reference, Defect ID if failed.",
    )

    add_heading(doc, "5. Test Cases", 1)

    # Authentication
    add_heading(doc, "Authentication", 2)
    auth_cases = [
        (
            "TC-AUTH-001",
            "Cold start splash displays brand",
            "Authentication",
            "Critical",
            "App not running; user logged out or first install.",
            ["Launch LinkUp on device.", "Observe splash overlay."],
            "Pastel splash shows LinkUp logo lockup and 'Meet With Confidence'; fades into login or app within ~5s after auth bootstrap.",
        ),
        (
            "TC-AUTH-002",
            "Email signup with confirmation",
            "Authentication",
            "Critical",
            "Valid unused email; Supabase confirm-email ON; SMTP configured.",
            ["Open Sign up.", "Enter name, email, password.", "Accept privacy consent.", "Tap Sign up."],
            "Success message to check email; verification email received with tappable confirm link; no session until confirmed.",
        ),
        (
            "TC-AUTH-003",
            "Email confirmation deep link",
            "Authentication",
            "Critical",
            "Signup completed; confirmation email received on same device with app installed.",
            ["Tap Confirm link in email.", "Observe app opens via linkup://auth/callback."],
            "App opens; session established; user routed to onboarding (new) or main tabs (returning).",
        ),
        (
            "TC-AUTH-004",
            "Resend verification email cooldown",
            "Authentication",
            "High",
            "Signup awaiting confirmation.",
            ["Tap Resend verification.", "Immediately tap Resend again."],
            "First resend succeeds or shows check email; second attempt blocked with cooldown message (~60s).",
        ),
        (
            "TC-AUTH-005",
            "Email/password login",
            "Authentication",
            "Critical",
            "Confirmed account exists.",
            ["Open Log in.", "Enter valid credentials.", "Tap Log in."],
            "User enters app; routed per onboarding_status (onboarding or Discover tab).",
        ),
        (
            "TC-AUTH-006",
            "Google OAuth sign-in",
            "Authentication",
            "High",
            "Google provider enabled in Supabase; device has Google account.",
            ["Tap Continue with Google.", "Complete Google consent."],
            "Session established; user routed to onboarding or main tabs.",
        ),
        (
            "TC-AUTH-007",
            "Forgot password flow",
            "Authentication",
            "High",
            "Registered email; reset email configured.",
            ["Tap Forgot password.", "Enter email.", "Submit.", "Open reset link on same device.", "Set new password."],
            "Reset email received; new password works on next login.",
        ),
        (
            "TC-AUTH-008",
            "Show/hide password toggle",
            "Authentication",
            "Low",
            "On login or signup screen.",
            ["Enter password.", "Tap eye icon to show.", "Tap again to hide."],
            "Password visibility toggles without clearing field.",
        ),
        (
            "TC-AUTH-009",
            "Invalid login credentials",
            "Authentication",
            "High",
            "Confirmed account exists.",
            ["Enter wrong password.", "Tap Log in."],
            "Clear error shown; no session created.",
        ),
        (
            "TC-AUTH-010",
            "Signup without privacy consent",
            "Authentication",
            "High",
            "On signup screen.",
            ["Fill fields.", "Do not check privacy consent.", "Tap Sign up."],
            "Signup blocked with consent required message.",
        ),
    ]
    for c in auth_cases:
        add_test_case(doc, *c)

    # Onboarding
    add_heading(doc, "Onboarding", 2)
    for c in [
        (
            "TC-ONB-001",
            "Complete 5-step onboarding wizard",
            "Onboarding",
            "Critical",
            "New user post-signup.",
            [
                "Complete P1 Basics (name, DOB 18+, photos, intro video).",
                "Complete P2 Story.",
                "Complete P3 Location and prefs.",
                "Complete P4 Safety acknowledgment.",
                "Publish on P5 Preview.",
            ],
            "Onboarding marked complete; user lands on Discover tab.",
        ),
        (
            "TC-ONB-002",
            "Resume onboarding mid-wizard",
            "Onboarding",
            "High",
            "User partially completed onboarding.",
            ["Relaunch app.", "Continue from saved step."],
            "Wizard resumes at last saved step with draft intact.",
        ),
        (
            "TC-ONB-003",
            "18+ age gate",
            "Onboarding",
            "Critical",
            "On P1 Basics.",
            ["Enter birth date under 18.", "Attempt continue."],
            "Blocked with age requirement message.",
        ),
        (
            "TC-ONB-004",
            "Primary photo selection",
            "Onboarding",
            "Medium",
            "Multiple photos uploaded.",
            ["Set one photo as primary.", "Complete onboarding.", "View profile preview."],
            "Primary photo shown on profile and discovery card.",
        ),
    ]:
        add_test_case(doc, *c)

    # Discover
    add_heading(doc, "Discover", 2)
    for c in [
        (
            "TC-DIS-001",
            "Discover tab loads swipe deck",
            "Discover",
            "Critical",
            "Logged in; plans exist in feed.",
            ["Open app (default Discover tab).", "Wait for feed load."],
            "Plan cards load with host media, title, and actions.",
        ),
        (
            "TC-DIS-002",
            "Swipe right (interest) on plan",
            "Discover",
            "High",
            "Plan in feed.",
            ["Swipe right or tap like on a plan card."],
            "Interest recorded; card advances.",
        ),
        (
            "TC-DIS-003",
            "Swipe left (hide) plan",
            "Discover",
            "Medium",
            "Plan in feed.",
            ["Swipe left to hide plan.", "Tap Undo in header."],
            "Plan hidden then restored on undo.",
        ),
        (
            "TC-DIS-004",
            "Switch list display mode",
            "Discover",
            "Medium",
            "On Discover.",
            ["Open Filters.", "Select List display.", "Apply."],
            "Feed switches to list layout.",
        ),
        (
            "TC-DIS-005",
            "Apply feed filters",
            "Discover",
            "High",
            "On Discover.",
            ["Open Filters.", "Set distance, price, mood, verified hosts.", "Apply."],
            "Feed respects filters.",
        ),
        (
            "TC-DIS-006",
            "Open plan detail from card",
            "Discover",
            "Critical",
            "Plan in feed.",
            ["Tap plan card (or info action)."],
            "Plan detail opens with host media gallery and CTAs.",
        ),
        (
            "TC-DIS-007",
            "Open host member profile",
            "Discover",
            "High",
            "Plan in feed.",
            ["Tap host avatar."],
            "Public member profile opens.",
        ),
        (
            "TC-DIS-008",
            "Unverified user sees KYC banner",
            "Discover",
            "High",
            "Unverified user logged in.",
            ["Open Discover."],
            "KYC prompt/banner visible with path to verification.",
        ),
        (
            "TC-DIS-009",
            "Create plan hard gate (unverified)",
            "Discover",
            "Critical",
            "Unverified user.",
            ["Tap + Create FAB or create entry."],
            "Verification hard gate shown; create blocked.",
        ),
        (
            "TC-DIS-010",
            "Group plan stays in Discover during host payment",
            "Discover",
            "High",
            "Group plan in awaiting_payment while host funds; standard/mood paid plans in same status hidden.",
            ["Open Discover as guest or third party.", "Locate group plan host is paying for.", "Confirm standard paid plan in awaiting_payment is not shown."],
            "Group plan remains visible in feed during host payment; non-group awaiting_payment plans are hidden.",
        ),
    ]:
        add_test_case(doc, *c)

    # Meetr
    add_heading(doc, "Meetr", 2)
    for c in [
        (
            "TC-MET-001",
            "Meetr grid loads meet types",
            "Meetr",
            "High",
            "Logged in.",
            ["Navigate to Meetr tab.", "Observe category tiles."],
            "Meet type grid loads with icons and labels.",
        ),
        (
            "TC-MET-002",
            "Browse plans by meet type",
            "Meetr",
            "High",
            "Meet types available.",
            ["Tap a meet type tile."],
            "Discover or filtered view shows plans for that meet type.",
        ),
        (
            "TC-MET-003",
            "Custom meet type pending state",
            "Meetr",
            "Medium",
            "User submitted custom meet type awaiting approval.",
            ["Open Meetr.", "Tap pending tile."],
            "Pending state shown; type not selectable for create until approved.",
        ),
        (
            "TC-MET-004",
            "Press/hold reveals meet type description",
            "Meetr",
            "Low",
            "On Meetr grid.",
            ["Press and hold tile.", "Release."],
            "Description tooltip or overlay appears.",
        ),
    ]:
        add_test_case(doc, *c)

    # Plans
    add_heading(doc, "Plans", 2)
    for c in [
        (
            "TC-PLN-001",
            "Verified user creates paid plan",
            "Plans",
            "Critical",
            "Verified user.",
            ["Start Create plan.", "Complete meet/schedule, commitment, details.", "Publish."],
            "Plan published to feed with paid escrow configuration.",
        ),
        (
            "TC-PLN-002",
            "Create mood plan",
            "Plans",
            "High",
            "Verified user.",
            ["Create plan with mood/vibe fields.", "Publish."],
            "Mood plan published with countdown/window behavior.",
        ),
        (
            "TC-PLN-003",
            "Guest sends negotiation offer",
            "Plans",
            "Critical",
            "Verified guest; open plan.",
            ["Open plan detail.", "Open negotiate.", "Submit offer amount/message."],
            "Offer created; host notified.",
        ),
        (
            "TC-PLN-004",
            "Unverified guest blocked from offer",
            "Plans",
            "High",
            "Guest not verified.",
            ["Open plan.", "Attempt send offer."],
            "Verification gate shown; offer not sent.",
        ),
        (
            "TC-PLN-005",
            "Host accepts offer to agreement",
            "Plans",
            "High",
            "Host has pending acceptable offer.",
            ["Open Offers or plan.", "Accept offer.", "Review agreement screen."],
            "Agreement summary shown with gross payment preview for paid plans; path to confirm and fund.",
        ),
        (
            "TC-PLN-006",
            "Edit published plan",
            "Plans",
            "Medium",
            "User is plan host.",
            ["Open own plan.", "Open edit sheet.", "Change title/schedule.", "Save."],
            "Changes persist; feed reflects updates.",
        ),
        (
            "TC-PLN-007",
            "Group plan host closes group and pays",
            "Plans",
            "High",
            "Group split plan with funded guests; host not yet paid.",
            ["Open agreement as host.", "Follow close group / manage offers path.", "Fund host share."],
            "Host escrow created; projected host share matches guest commitments; plan can reach active when all funded.",
        ),
    ]:
        add_test_case(doc, *c)

    # Group Plans (Annexure B)
    add_heading(doc, "Group Plans (Annexure B)", 2)
    for c in [
        (
            "TC-GRP-001",
            "Group plan policy gate on first create",
            "Group Plans",
            "Critical",
            "Platform: Both. User has never signed group plan policy.",
            [
                "Start Create plan as verified host.",
                "Enable group plan toggle.",
                "Observe GroupPlanPolicyModal.",
                "Scroll to bottom and sign.",
            ],
            "Modal blocks create until scrolled and signed; policy sections match Annexure B content; after sign, group settings available.",
        ),
        (
            "TC-GRP-002",
            "Group plan policy gate skipped after prior sign",
            "Group Plans",
            "High",
            "Platform: Both. User already signed group plan policy.",
            ["Start Create plan.", "Enable group plan toggle."],
            "Policy modal does not reappear; user proceeds directly to group settings.",
        ),
        (
            "TC-GRP-003",
            "Create group plan with minimum membership",
            "Group Plans",
            "Critical",
            "Platform: Both. Verified host; policy signed.",
            [
                "Create group plan with minimum members (e.g. 5).",
                "Set split/pattern and publish.",
                "Open plan detail as host.",
            ],
            "Plan published as group type; member count badge shows current vs minimum; guests can request/join slots.",
        ),
        (
            "TC-GRP-004",
            "Group member count badge and guest panel",
            "Group Plans",
            "High",
            "Platform: Both. Active group plan with partial membership.",
            ["Open plan detail.", "Review member count badge and guest list panel."],
            "Badge shows funded/joined count vs minimum; guest panel lists members and funding status.",
        ),
        (
            "TC-GRP-005",
            "Host confirms group meetup completed",
            "Group Plans",
            "Critical",
            "Platform: Both. Group plan active; meetup datetime passed.",
            [
                "Open plan detail as host.",
                "Tap Confirm Group Meetup Completed.",
                "Confirm action.",
            ],
            "Host confirmation recorded; guests receive meetup confirm notifications; guest confirm window opens.",
        ),
        (
            "TC-GRP-006",
            "Group guest meetup confirm Yes attended",
            "Group Plans",
            "Critical",
            "Platform: Both. Host confirmed group meetup; guest notified.",
            [
                "Open notification or navigate to plan confirm screen as guest.",
                "Tap Yes, I attended.",
            ],
            "Guest confirmation recorded; disbursement queued; guest can navigate to wallet.",
        ),
        (
            "TC-GRP-007",
            "Minimum not met notification and minimum-action screen",
            "Group Plans",
            "Critical",
            "Platform: Both. Group plan T-48h before meetup; count below minimum.",
            [
                "As host, receive group_minimum_not_met notification.",
                "Tap notification.",
            ],
            "Routes to /plan/[id]/minimum-action; three host options visible: extend deadline, proceed smaller, cancel plan.",
        ),
        (
            "TC-GRP-008",
            "Host extends deadline on minimum-action",
            "Group Plans",
            "High",
            "Platform: Both. On minimum-action screen; eligible to extend.",
            ["Select extend deadline.", "Confirm new deadline."],
            "Deadline extended; members notified; plan remains active.",
        ),
        (
            "TC-GRP-009",
            "Host proceeds with smaller group",
            "Group Plans",
            "High",
            "Platform: Both. On minimum-action; enough funded guests to proceed.",
            ["Select proceed with current members.", "Confirm."],
            "Plan proceeds with reduced headcount; meetup can continue per policy.",
        ),
        (
            "TC-GRP-010",
            "Host cancels due to minimum not met",
            "Group Plans",
            "High",
            "Platform: Both. On minimum-action screen.",
            ["Select cancel plan.", "Confirm cancellation."],
            "Plan cancelled; all guests refunded per cancellation matrix; host penalty applied if applicable.",
        ),
        (
            "TC-GRP-011",
            "Guest opt-out more than 48h before meetup",
            "Group Plans",
            "High",
            "Platform: Both. Guest on group plan; meetup >48h away.",
            [
                "Open plan detail as guest (not host).",
                "Tap opt out of group plan.",
                "Confirm opt-out.",
            ],
            "Guest removed; wallet credited per refund policy; group_member_opted_out notification to host.",
        ),
        (
            "TC-GRP-012",
            "Guest opt-out drops below minimum triggers cancel",
            "Group Plans",
            "High",
            "Platform: Both. Group near minimum; one opt-out would drop below minimum.",
            ["Guest opts out.", "Observe plan status and refunds."],
            "Plan auto-cancelled (triggered_minimum_cancel); all remaining members refunded.",
        ),
        (
            "TC-GRP-013",
            "Host group cancellation modal with penalty terms",
            "Group Plans",
            "Critical",
            "Platform: Both. User is group plan host; plan active.",
            [
                "Open plan detail as host.",
                "Open Cancel group plan.",
                "Select reason; review penalty/refund terms (platform fee refund copy).",
                "Confirm cancellation.",
            ],
            "Modal shows reason picker, terms, and confirm; on confirm guests refunded and group_plan_host_cancelled notifications sent.",
        ),
        (
            "TC-GRP-014",
            "Group plan countdown banners on plan detail",
            "Group Plans",
            "Medium",
            "Platform: Both. Group plan approaching key deadlines (minimum check, meetup, confirm window).",
            ["Open plan detail at T-48h, meetup day, and post-meetup windows."],
            "Contextual countdown banners appear with correct messaging per Annexure B timeline.",
        ),
        (
            "TC-GRP-015",
            "Platform fee refund messaging on host cancel",
            "Group Plans",
            "Medium",
            "Platform: Both. Host cancellation or minimum cancel flow.",
            ["Review cancellation modal and confirmation copy for platform fee refund eligibility."],
            "Copy matches platformFeeRefundCopy rules (eligible vs non-eligible scenarios clearly stated).",
        ),
    ]:
        add_test_case(doc, *c)

    # Agreement
    add_heading(doc, "Agreement", 2)
    for c in [
        (
            "TC-AGR-001",
            "Agreement shows gross payment amounts",
            "Agreement",
            "Critical",
            "Paid plan; both parties on agreement screen; escrow row exists.",
            ["Open agreement as payer.", "Review payment preview card and pre-confirm modal.", "Compare displayed total to Flutterwave checkout amount."],
            "UI shows gross amount (budget + platform fee) consistently on preview card, modal, and checkout; no budget-only mismatch.",
        ),
        (
            "TC-AGR-002",
            "Meetup confirmed Go to chat",
            "Agreement",
            "High",
            "Paid plan active; user funded and plan status active.",
            ["Open agreement screen.", "Tap Go to chat on Meetup confirmed card."],
            "Routes to plan-related chat: 1:1 DM for standard plans or plan group thread for group plans (not a random DM).",
        ),
        (
            "TC-AGR-003",
            "Both parties must confirm before payer funds",
            "Agreement",
            "High",
            "Paid plan in agreed/awaiting_payment; only one party confirmed.",
            ["Attempt pay before both confirm.", "Complete second confirmation.", "Proceed to payment."],
            "Payment blocked until both confirm; payer can proceed after both confirm.",
        ),
        (
            "TC-AGR-004",
            "Agreement to escrow payment method flow",
            "Agreement",
            "High",
            "Paid plan; payer confirmed; escrow pending_funding.",
            [
                "From agreement, tap proceed to secure payment / pay CTA.",
                "Land on escrow detail with gross Your share amount.",
                "Tap fund CTA and choose bank transfer.",
            ],
            "Agreement routes to escrow with gross amounts; bank transfer path available via payment method selector.",
        ),
    ]:
        add_test_case(doc, *c)

    # Meetup Confirmation & Disbursement
    add_heading(doc, "Meetup Confirmation & Disbursement", 2)
    for c in [
        (
            "TC-CNF-001",
            "1:1 meetup confirm Yes attended",
            "Meetup Confirmation",
            "Critical",
            "Platform: Both. Paid 1:1 plan active; meetup datetime passed; T+12h confirm window.",
            [
                "Open meetup confirm notification or /plan/[id]/confirm.",
                "Tap Yes, it happened / I attended.",
            ],
            "Confirmation recorded; escrow release initiated; disbursement appears in wallet pending queue.",
        ),
        (
            "TC-CNF-002",
            "1:1 meetup confirm No report problem",
            "Meetup Confirmation",
            "Critical",
            "Platform: Both. On meetup confirm screen.",
            [
                "Tap No, report a problem.",
                "Observe routed screen.",
            ],
            "Routes to plan dispute flow (video report) on mobile; on web verify route to dispute detail or report flow per product spec.",
        ),
        (
            "TC-CNF-003",
            "Meetup confirm push notification deep link",
            "Meetup Confirmation",
            "High",
            "Platform: Mobile. Push enabled; meetup_confirm_requested or meetup_confirm_reminder received.",
            ["Tap push notification."],
            "App opens /plan/[id]/confirm for correct plan.",
        ),
        (
            "TC-CNF-004",
            "Auto-confirm after 24h no dispute",
            "Meetup Confirmation",
            "High",
            "Platform: Both. Meetup confirm window open; user takes no action for 24h; no dispute filed.",
            ["Wait for auto-confirm job (or simulate in staging).", "Check wallet and plan status."],
            "Meetup auto-confirmed; funds disbursed per policy; wallet ledger updated.",
        ),
        (
            "TC-CNF-005",
            "Go to wallet after confirm disbursement",
            "Meetup Confirmation",
            "High",
            "Platform: Both. User just confirmed attendance.",
            ["Tap Go to wallet from confirm success state."],
            "Wallet opens showing updated balance and pending/completed disbursement entry.",
        ),
        (
            "TC-CNF-006",
            "Group guest exigency path from confirm screen",
            "Meetup Confirmation",
            "High",
            "Platform: Both. Group guest on confirm screen after host confirmed meetup.",
            ["Tap Submit Exigency Report instead of Yes attended."],
            "Routes to /plan/[id]/exigency with group plan context.",
        ),
    ]:
        add_test_case(doc, *c)

    # Policy Modals & Cancellation Matrix
    add_heading(doc, "Policy Modals & Cancellation Matrix", 2)
    for c in [
        (
            "TC-POL-001",
            "Escrow policy sign-off before checkout",
            "Policy",
            "Critical",
            "Platform: Both. User on agreement screen before first escrow payment for plan.",
            [
                "Tap proceed to secure payment.",
                "Observe EscrowPolicySignOffModal.",
                "Scroll and sign.",
            ],
            "Modal shows pattern-specific Annexure B escrow policy; blocks payment until signed.",
        ),
        (
            "TC-POL-002",
            "Pattern-specific cancellation matrix on agreement",
            "Policy",
            "High",
            "Platform: Both. Plans with escrow patterns A, B, and C.",
            ["Open agreement for each pattern.", "Review cancellation matrix section."],
            "Matrix rows match DB cancellation_matrix for plan pattern; amounts and timing correct.",
        ),
        (
            "TC-POL-003",
            "Safety caveat interstitial after first funded meetup",
            "Policy",
            "High",
            "Platform: Both. First funded meetup with new counterparty pair.",
            ["Open /escrow/[id] after funding.", "Observe SafetyCaveatInterstitial."],
            "Interstitial shown once per pair; acknowledge required; not shown again for same pair.",
        ),
        (
            "TC-POL-004",
            "Section 7.4 cancellation matrix from database",
            "Policy",
            "High",
            "Platform: Both. Plan create or agreement with CancellationMatrixPolicy component.",
            ["Review Section 7.4 display on create/agreement.", "Compare to admin DB cancellation_matrix rows."],
            "UI renders live DB matrix (not hardcoded placeholder); updates if DB rows change.",
        ),
    ]:
        add_test_case(doc, *c)

    # Offers
    add_heading(doc, "Offers", 2)
    for c in [
        (
            "TC-OFR-001",
            "Offers tab sent/received lists",
            "Offers",
            "High",
            "User has sent and received offers.",
            ["Open Offers tab.", "Switch sent/received segments."],
            "Correct offers listed with status (pending, countered, accepted).",
        ),
        (
            "TC-OFR-002",
            "Counter-offer flow",
            "Offers",
            "High",
            "Pending offer exists.",
            ["Open negotiation thread.", "Submit counter offer."],
            "Counter recorded; other party sees updated status.",
        ),
    ]:
        add_test_case(doc, *c)

    # Escrow
    add_heading(doc, "Escrow", 2)
    for c in [
        (
            "TC-ESC-001",
            "Fund escrow via Flutterwave card (paid plan)",
            "Escrow",
            "Critical",
            "Agreement reached on paid plan; Flutterwave configured.",
            ["Proceed to payment from agreement or escrow.", "Choose card payment.", "Complete Flutterwave checkout."],
            "Escrow leg marked funded; plan moves toward active when all legs funded; both parties notified.",
        ),
        (
            "TC-ESC-002",
            "View escrow status",
            "Escrow",
            "High",
            "Active or pending escrow exists.",
            ["Open escrow detail from plan or wallet path."],
            "Status, gross amounts, counterparty, split breakdown, and next actions visible.",
        ),
        (
            "TC-ESC-003",
            "Open dispute on escrow",
            "Escrow",
            "High",
            "Eligible active escrow.",
            ["Open dispute flow.", "Submit reason and evidence."],
            "Dispute created; funds flagged; admins notified.",
        ),
        (
            "TC-ESC-004",
            "Payment method selector on escrow",
            "Escrow",
            "High",
            "User is payer on escrow screen.",
            ["Tap Pay your share or fund CTA.", "Observe payment method modal."],
            "Modal offers card vs bank transfer; card continues Flutterwave flow; bank transfer routes to virtual account screen.",
        ),
        (
            "TC-ESC-005",
            "Bank transfer virtual account screen",
            "Escrow",
            "High",
            "Bank transfer path selected; generate-virtual-account deployed; refund account step completed.",
            [
                "Choose bank transfer from payment method selector.",
                "Complete refund account step (saved or new verified account).",
                "Review virtual account screen: bank, account number, exact gross amount, countdown.",
            ],
            "Virtual account details shown with correct gross amount; content aligned with header padding; copy account works.",
        ),
        (
            "TC-ESC-006",
            "Split escrow Pattern B gross per leg",
            "Escrow",
            "High",
            "Pattern B plan; host and guest each fund separate legs.",
            ["Open escrow as host and guest.", "Review Your share / pay amounts on footer and cards."],
            "Each leg shows gross cents for that leg; Flutterwave charge matches displayed gross.",
        ),
    ]:
        add_test_case(doc, *c)

    # Bank transfer & refund account
    add_heading(doc, "Bank Transfer & Refund Account", 2)
    for c in [
        (
            "TC-BNK-001",
            "Payment method selector on escrow fund",
            "Bank Transfer",
            "Critical",
            "Payer on escrow detail with pending_funding status.",
            [
                "Tap Pay your share (or equivalent fund CTA).",
                "Review How would you like to pay modal.",
                "Select Pay by card and Continue (smoke).",
                "Repeat flow; select Pay by bank transfer and Continue.",
            ],
            "Modal shows card and bank transfer options with copy; card opens Flutterwave; bank transfer routes to /escrow/bank-transfer/[id].",
        ),
        (
            "TC-BNK-002",
            "Refund account step uses saved account",
            "Bank Transfer",
            "High",
            "User has default saved payment account in user_payment_accounts.",
            [
                "Open bank transfer flow for eligible escrow.",
                "On Refund account step, review saved account card.",
                "Tap Use this account.",
            ],
            "Saved bank name, masked account number, and verified badge shown; virtual account generates without re-entering details.",
        ),
        (
            "TC-BNK-003",
            "Verify new refund account (10-digit NUBAN)",
            "Bank Transfer",
            "Critical",
            "No saved account or user chose Use a different account.",
            [
                "Tap Select a bank and pick a Nigerian bank.",
                "Enter 10-digit account number.",
                "Wait for account name resolution.",
            ],
            "verify-bank-account returns account holder name; errors shown for invalid bank/account combo.",
        ),
        (
            "TC-BNK-004",
            "Bank search in selector modal",
            "Bank Transfer",
            "Medium",
            "On refund account form; banks loaded.",
            ["Open bank selector modal.", "Search for partial bank name (e.g. GTB, Access).", "Select a result."],
            "Filtered list updates; selection closes modal and fills bank field.",
        ),
        (
            "TC-BNK-005",
            "Save account for future refunds",
            "Bank Transfer",
            "High",
            "New verified account; consent checked.",
            [
                "Complete bank verification.",
                "Check NDPR consent checkbox.",
                "Leave Save for future refunds on.",
                "Tap Generate payment account.",
            ],
            "Account upserted to user_payment_accounts as default; virtual account session created with refund_account_id.",
        ),
        (
            "TC-BNK-006",
            "Use once without saving",
            "Bank Transfer",
            "High",
            "New verified account; consent checked.",
            [
                "Complete bank verification and consent.",
                "Tap Use once (do not save).",
            ],
            "Virtual account generated with one-time refund fields; no new default row in user_payment_accounts.",
        ),
        (
            "TC-BNK-007",
            "NDPR consent required",
            "Bank Transfer",
            "High",
            "New account verified; consent unchecked.",
            ["Attempt Generate payment account without consent.", "Check consent and retry."],
            "Primary CTA disabled until consent checked; proceeds after consent.",
        ),
        (
            "TC-BNK-008",
            "Copy virtual account number",
            "Bank Transfer",
            "Medium",
            "Virtual account step active.",
            ["Tap copy icon beside account number."],
            "Copied confirmation shown; clipboard contains full account number.",
        ),
        (
            "TC-BNK-009",
            "Virtual account expiry and regenerate",
            "Bank Transfer",
            "High",
            "Virtual account session near or past expires_at (test env or wait).",
            [
                "Observe countdown reaches Account expired.",
                "Tap Generate new account.",
            ],
            "User returned to refund account step; new session can be generated.",
        ),
        (
            "TC-BNK-010",
            "Auto-confirm after bank transfer received",
            "Bank Transfer",
            "Critical",
            "Virtual account issued; Flutterwave webhook or test transfer available.",
            [
                "Transfer exact gross amount from registered refund account.",
                "Keep app on virtual account screen or background and return.",
            ],
            "Escrow leg or row moves to funded; user routed to plan agreement screen; plan progresses when all legs funded.",
        ),
        (
            "TC-BNK-011",
            "Non-payer blocked from bank transfer route",
            "Bank Transfer",
            "High",
            "User is not the payer / cannot fund this escrow leg.",
            ["Attempt to open /escrow/bank-transfer/[id] directly or via ineligible CTA."],
            "Redirected to escrow detail or blocked; no virtual account issued.",
        ),
        (
            "TC-BNK-012",
            "Nigerian banks list loads",
            "Bank Transfer",
            "High",
            "list-nigerian-banks deployed; nigerian_banks table seeded.",
            ["Open refund account form.", "Open bank selector."],
            "Banks list populates from API or DB fallback; no empty list in production-like env.",
        ),
    ]:
        add_test_case(doc, *c)

    # Messages
    add_heading(doc, "Messages", 2)
    for c in [
        (
            "TC-MSG-001",
            "Messages inbox loads",
            "Messages",
            "Critical",
            "User has at least one conversation.",
            ["Open Messages tab."],
            "Conversation list with preview, time, unread state.",
        ),
        (
            "TC-MSG-002",
            "Send text message in DM",
            "Messages",
            "High",
            "DM thread open.",
            ["Type message.", "Send."],
            "Message appears in thread; delivered to recipient inbox (second device/account).",
        ),
        (
            "TC-MSG-003",
            "Open chat from plan negotiation",
            "Messages",
            "High",
            "Active negotiation thread.",
            ["Tap Open chat from negotiate screen."],
            "Chat opens with correct counterparty; group plans route to plan group thread when available.",
        ),
        (
            "TC-MSG-004",
            "Smart suggestions bar",
            "Messages",
            "Medium",
            "Chat with plan/meetup context.",
            ["Open chat thread.", "Observe suggestion chips.", "Tap a suggestion."],
            "Contextual suggestions shown; tap inserts/sends suggested text.",
        ),
        (
            "TC-MSG-005",
            "Group chat",
            "Messages",
            "High",
            "User member of group conversation.",
            ["Open group thread.", "Send message.", "Open group info."],
            "Group messages deliver; member list accessible.",
        ),
        (
            "TC-MSG-006",
            "Push notification tap opens chat",
            "Messages",
            "Medium",
            "Push enabled; message received while app backgrounded.",
            ["Receive push for new message.", "Tap notification."],
            "App opens correct chat thread.",
        ),
        (
            "TC-MSG-007",
            "Video message tap-to-play",
            "Messages",
            "Medium",
            "Chat thread with video attachment.",
            ["Open chat with video bubble.", "Observe poster.", "Tap to play."],
            "Video shows play poster first; player mounts on tap without crash.",
        ),
    ]:
        add_test_case(doc, *c)

    # Live Location Sharing
    add_heading(doc, "Live Location Sharing", 2)
    for c in [
        (
            "TC-LOC-001",
            "Start live location with NDPR consent",
            "Live Location",
            "High",
            "Platform: Both. Active plan chat (1:1 or group); meetup upcoming or in progress.",
            [
                "Open plan chat thread.",
                "Tap Share live location.",
                "Read NDPR consent in LiveLocationConsentModal.",
                "Select duration and confirm share.",
            ],
            "Consent modal blocks until acknowledged; session starts; partner notified (live_location_started).",
        ),
        (
            "TC-LOC-002",
            "Partner views live location map",
            "Live Location",
            "High",
            "Platform: Both. Partner sharing live location in chat.",
            [
                "Open same chat as counterparty.",
                "Observe LiveLocationViewer map.",
            ],
            "Map shows partner pin updating; ETA/distance if applicable.",
        ),
        (
            "TC-LOC-003",
            "Stop live location sharing",
            "Live Location",
            "High",
            "Platform: Both. User currently sharing location.",
            ["Tap Stop sharing live location."],
            "Session ends; map removed for partner; no further location updates.",
        ),
        (
            "TC-LOC-004",
            "Live location session expiry",
            "Live Location",
            "Medium",
            "Platform: Both. Short duration selected (e.g. 15 min) or wait for expiry.",
            ["Share location with short duration.", "Wait for expiry."],
            "Sharing stops automatically at duration end; UI reflects expired state.",
        ),
        (
            "TC-LOC-005",
            "live_location_started notification routing",
            "Live Location",
            "Medium",
            "Platform: Both. Partner receives live_location_started notification.",
            ["Tap notification."],
            "Routes to plan detail or chat per notification handler.",
        ),
        (
            "TC-LOC-006",
            "Arrival nudge from chat",
            "Live Location",
            "Medium",
            "Platform: Both. Plan chat open; meetup day.",
            [
                "Tap Arrival nudge button.",
                "As partner, receive nudge notification.",
            ],
            "Partner notified; optional link to dispute with ?reported= param if used.",
        ),
    ]:
        add_test_case(doc, *c)

    # Verification
    add_heading(doc, "Verification", 2)
    for c in [
        (
            "TC-KYC-001",
            "Start KYC from hard gate",
            "Verification",
            "Critical",
            "Unverified user triggered gate (e.g. create plan).",
            ["Tap Start verification.", "Begin K1 intro."],
            "KYC wizard opens; user can progress or exit with Not now.",
        ),
        (
            "TC-KYC-002",
            "Complete KYC document + video steps",
            "Verification",
            "High",
            "User in KYC wizard.",
            ["Select ID type.", "Capture/upload documents.", "Record liveness clip.", "Submit."],
            "Submission queued; status pending.",
        ),
        (
            "TC-KYC-003",
            "Verified user creates plan after approval",
            "Verification",
            "High",
            "KYC approved.",
            ["Create plan after approval."],
            "Hard gate no longer blocks; plan publish succeeds.",
        ),
        (
            "TC-KYC-004",
            "Soft KYC prompt dismiss",
            "Verification",
            "Medium",
            "Post-onboarding soft prompt shown.",
            ["Dismiss soft prompt.", "Continue browsing."],
            "App usable; prompt can reappear per policy.",
        ),
    ]:
        add_test_case(doc, *c)

    # Notifications
    add_heading(doc, "Notifications", 2)
    for c in [
        (
            "TC-NOT-001",
            "Notification inbox loads",
            "Notifications",
            "High",
            "User has notifications.",
            ["Open notification inbox from header/bell."],
            "Notifications listed with read/unread state.",
        ),
        (
            "TC-NOT-002",
            "Tap notification deep link",
            "Notifications",
            "High",
            "Actionable notification exists.",
            ["Tap notification row."],
            "Routes to relevant plan, chat, escrow, or settings screen.",
        ),
        (
            "TC-NOT-003",
            "Admin-only notification hidden from members",
            "Notifications",
            "Medium",
            "Admin-only notification type exists.",
            ["Open inbox as regular member."],
            "Admin-only types (e.g. meet type pending approval) not visible.",
        ),
        (
            "TC-NOT-004",
            "Admin sees meet type pending notification",
            "Notifications",
            "Medium",
            "Admin account; member submitted custom meet type.",
            ["Open inbox as admin.", "Tap meet type notification."],
            "Notification visible; opens Admin Meet types tab.",
        ),
        (
            "TC-NOT-005",
            "meetup_confirm notification types routing",
            "Notifications",
            "High",
            "Platform: Both. Notifications: meetup_confirm_requested, meetup_confirm_reminder, meetup_confirm_final.",
            ["Tap each notification type from inbox."],
            "Each routes to /plan/[id]/confirm.",
        ),
        (
            "TC-NOT-006",
            "group_minimum_not_met routing",
            "Notifications",
            "Critical",
            "Platform: Both. Host receives group_minimum_not_met.",
            ["Tap notification."],
            "Routes to /plan/[id]/minimum-action.",
        ),
        (
            "TC-NOT-007",
            "group_plan_host_cancelled routing",
            "Notifications",
            "High",
            "Platform: Both. Guest receives group_plan_host_cancelled.",
            ["Tap notification."],
            "Routes to /wallet (refund/disbursement context).",
        ),
        (
            "TC-NOT-008",
            "Exigency outcome notifications",
            "Notifications",
            "High",
            "Platform: Both. exigency resolved notifications (guest/host outcomes).",
            ["Tap exigency outcome notification."],
            "Routes to /wallet with ledger explanation.",
        ),
        (
            "TC-NOT-009",
            "Disbursement and withdrawal notifications",
            "Notifications",
            "High",
            "Platform: Both. disbursement_*, withdrawal_initiated, withdrawal_completed, withdrawal_failed.",
            ["Tap each notification type."],
            "Routes to /wallet.",
        ),
        (
            "TC-NOT-010",
            "group_member_opted_out routing",
            "Notifications",
            "Medium",
            "Platform: Both. Host receives group_member_opted_out.",
            ["Tap notification."],
            "Routes to /plan/[id] plan detail.",
        ),
        (
            "TC-NOT-011",
            "review_request notification routing",
            "Notifications",
            "High",
            "Platform: Both. review_unlock_at passed; review_request notification sent.",
            ["Tap review_request notification."],
            "Routes to /plan/[id]/review.",
        ),
        (
            "TC-NOT-012",
            "new_exigency_report admin routing",
            "Notifications",
            "Medium",
            "Platform: Both. Admin account; new exigency submitted.",
            ["Tap new_exigency_report as admin."],
            "Routes to admin plan disputes / exigency queue.",
        ),
    ]:
        add_test_case(doc, *c)

    # Reviews & Ratings
    add_heading(doc, "Reviews & Ratings", 2)
    for c in [
        (
            "TC-REV-001",
            "Submit review after review_unlock_at",
            "Reviews",
            "Critical",
            "Platform: Both. Completed meetup; review_unlock_at in past; user has not reviewed.",
            [
                "Open /plan/[id]/review via notification or plan path.",
                "Rate punctuality and conduct (and plan quality if host reviewing guest).",
                "Submit review.",
            ],
            "Review saved; success confirmation; duplicate path blocked on revisit.",
        ),
        (
            "TC-REV-002",
            "Duplicate review submit blocked",
            "Reviews",
            "High",
            "Platform: Both. User already submitted review for plan.",
            ["Navigate to /plan/[id]/review again."],
            "UI shows already reviewed state; submit disabled or redirects.",
        ),
        (
            "TC-REV-003",
            "Host rating badge on discover",
            "Reviews",
            "Medium",
            "Platform: Both. Host with aggregated ratings on published plan.",
            ["Open Discover feed.", "Locate host plan card."],
            "HostRatingBadge shows average rating and review count.",
        ),
        (
            "TC-REV-004",
            "Profile ratings section on own profile",
            "Reviews",
            "High",
            "Platform: Both. User with at least one received review.",
            ["Open Profile tab (mobile) or /user/[id] (web).", "Review ProfileRatingsSection / ratings summary."],
            "Aggregated scores and review list visible on own profile.",
        ),
        (
            "TC-REV-005",
            "Report review",
            "Reviews",
            "High",
            "Platform: Both. Public profile with reviews from another user.",
            [
                "Open another user's profile.",
                "Tap Report on a review.",
                "Submit report reason.",
            ],
            "Report recorded; confirmation shown; review flagged for admin moderation.",
        ),
        (
            "TC-REV-006",
            "View reviews on member profile",
            "Reviews",
            "Medium",
            "Platform: Both. Member with multiple reviews.",
            ["Open /user/[id] or member profile from plan.", "Scroll review list."],
            "Reviews show rating, text, reviewer anonymization per policy, and date.",
        ),
        (
            "TC-REV-007",
            "Admin review reports moderation",
            "Reviews",
            "High",
            "Platform: Both. Admin account; reported review in queue.",
            [
                "Open Admin -> review_reports tab.",
                "Review report details.",
                "Take moderation action (dismiss or remove review).",
            ],
            "Queue loads; actions persist; reporter/reviewee state updated per policy.",
        ),
    ]:
        add_test_case(doc, *c)

    # Profile & Settings
    add_heading(doc, "Profile & Settings", 2)
    for c in [
        (
            "TC-SET-001",
            "Edit profile",
            "Profile & Settings",
            "High",
            "Logged in.",
            ["Profile tab -> Edit profile.", "Change bio/photos.", "Save."],
            "Changes visible on profile and discovery card; form content uses same horizontal padding as account screen.",
        ),
        (
            "TC-SET-002",
            "Notification and visibility preferences",
            "Profile & Settings",
            "High",
            "On Settings -> Notifications and visibility.",
            ["Toggle Push off/on.", "Toggle Email off/on.", "Toggle visibility options.", "Relaunch app."],
            "Preferences persist; screen uses inline back button aligned with header row; content padding matches account screen.",
        ),
        (
            "TC-SET-003",
            "Travel mode (Premium)",
            "Profile & Settings",
            "Medium",
            "Premium user.",
            ["Settings -> Travel.", "Set travel location.", "Open Discover header."],
            "Travel label shown; feed ranking uses travel location.",
        ),
        (
            "TC-SET-004",
            "Delete account flow",
            "Profile & Settings",
            "High",
            "Logged in; no blocking legal hold.",
            ["Settings -> Delete account.", "Confirm deletion."],
            "Account deletion initiated/completed per policy; user signed out.",
        ),
        (
            "TC-SET-005",
            "Privacy policy re-consent",
            "Profile & Settings",
            "Medium",
            "Policy update required flag set.",
            ["Launch app.", "Complete re-consent screen."],
            "Access restored after accept; decline blocks or limits per policy.",
        ),
    ]:
        add_test_case(doc, *c)

    # Premium / Membership
    add_heading(doc, "Premium / Membership", 2)
    for c in [
        (
            "TC-PRM-001",
            "Membership subscription checkout",
            "Premium",
            "High",
            "Flutterwave membership checkout configured.",
            ["Profile -> Membership.", "Select tier and billing cycle.", "Complete checkout."],
            "Subscription active; badge/perks visible; membership screen background extends behind status bar.",
        ),
        (
            "TC-PRM-002",
            "Saved plans tab (Premium)",
            "Premium",
            "Medium",
            "Premium user; saved plans exist.",
            ["Open Saved tab."],
            "Saved plans listed.",
        ),
        (
            "TC-PRM-003",
            "Gold trial from Silver subscriber",
            "Premium",
            "High",
            "Eligible Silver subscriber; gold trial not yet used.",
            ["Open Membership.", "Activate Gold trial."],
            "Gold trial active for 7 days; perks unlock.",
        ),
    ]:
        add_test_case(doc, *c)

    # Wallet
    add_heading(doc, "Wallet", 2)
    for c in [
        (
            "TC-WAL-001",
            "Wallet balance and ledger",
            "Wallet",
            "High",
            "User with ledger activity.",
            ["Open Wallet from profile.", "Review balance, goodwill, and recent activity."],
            "Balance, goodwill credits, goodwill history, withdrawals card, and ledger rows render correctly.",
        ),
        (
            "TC-WAL-002",
            "Goodwill history spacing",
            "Wallet",
            "Low",
            "Wallet open; goodwill history empty or populated.",
            ["Scroll to Goodwill history section.", "Observe spacing to Withdrawals card below."],
            "Clear vertical gap between goodwill history block and Withdrawals card matches other card spacing.",
        ),
        (
            "TC-WAL-003",
            "Pending disbursement queue display",
            "Wallet",
            "High",
            "Platform: Both. User with meetup confirm disbursement pending processing.",
            ["Open Wallet.", "Review pending disbursements section."],
            "Pending items listed with amount, plan reference, and countdown or status.",
        ),
        (
            "TC-WAL-004",
            "Withdraw to bank account",
            "Wallet",
            "Critical",
            "Platform: Both. Withdrawable balance; verified refund bank account on file.",
            [
                "Open Wallet.",
                "Tap Withdraw.",
                "Enter amount within limits.",
                "Confirm withdrawal.",
            ],
            "disburse-wallet invoked; withdrawal_initiated notification; balance updates when completed.",
        ),
        (
            "TC-WAL-005",
            "Withdraw validation min/max and insufficient balance",
            "Wallet",
            "High",
            "Platform: Both. Wallet with known balance.",
            [
                "Attempt withdraw below minimum.",
                "Attempt withdraw above balance.",
                "Attempt valid partial withdraw.",
            ],
            "Validation errors for invalid amounts; valid amount proceeds.",
        ),
        (
            "TC-WAL-006",
            "Refund account settings",
            "Wallet",
            "High",
            "Platform: Both. User without saved refund account.",
            [
                "Open refund account settings (web: /settings/refund-account; mobile: wallet/escrow path).",
                "Add and verify Nigerian bank account.",
            ],
            "Account saved and available for withdrawals and escrow refunds.",
        ),
        (
            "TC-WAL-007",
            "Goodwill credits non-withdrawable",
            "Wallet",
            "Medium",
            "Platform: Both. User with goodwill balance.",
            ["Review wallet balance breakdown.", "Attempt to withdraw full displayed total including goodwill."],
            "Withdrawable amount excludes goodwill; goodwill history separate from withdrawable balance.",
        ),
    ]:
        add_test_case(doc, *c)

    # Exigency Reports
    add_heading(doc, "Exigency Reports", 2)
    for c in [
        (
            "TC-EXG-001",
            "Submit exigency report on group plan",
            "Exigency",
            "Critical",
            "Platform: Both. Group guest in confirm window; did not attend or safety issue.",
            [
                "Navigate to /plan/[id]/exigency.",
                "Select reason category.",
                "Enter narrative.",
                "Submit report.",
            ],
            "Report created; confirmation shown; admin notified (new_exigency_report).",
        ),
        (
            "TC-EXG-002",
            "Exigency optional evidence with NDPR consent",
            "Exigency",
            "High",
            "Platform: Both. On exigency form step 3.",
            [
                "Attach optional photo/video evidence.",
                "Review EXIGENCY_EVIDENCE_NDPR copy.",
                "Accept consent and submit.",
            ],
            "Evidence uploaded; NDPR consent recorded; report complete.",
        ),
        (
            "TC-EXG-003",
            "Exigency blocked on non-group plan",
            "Exigency",
            "High",
            "Platform: Both. Standard 1:1 plan (not group).",
            ["Attempt to open /plan/[id]/exigency directly."],
            "Route blocked or 404; user directed to plan dispute flow instead.",
        ),
        (
            "TC-EXG-004",
            "Exigency auto-outcome after 24h no guest report",
            "Exigency",
            "High",
            "Platform: Both. Host confirmed group meetup; guest takes no action 24h.",
            ["Wait for auto-outcome job.", "Check guest wallet."],
            "50% floor (or policy amount) credited to guest wallet; notification sent.",
        ),
        (
            "TC-EXG-005",
            "Admin exigency queue review",
            "Exigency",
            "High",
            "Platform: Both. Admin account; pending exigency report.",
            [
                "Open Admin -> plan_disputes / exigency section.",
                "Review report details and evidence.",
                "Resolve with outcome.",
            ],
            "Admin can view narrative and evidence; resolution triggers wallet updates and notifications.",
        ),
    ]:
        add_test_case(doc, *c)

    # Support
    add_heading(doc, "Support", 2)
    for c in [
        (
            "TC-SUP-001",
            "Create support ticket",
            "Support",
            "High",
            "Logged in.",
            ["Open Support.", "Submit ticket with category and message."],
            "Ticket created; confirmation shown.",
        ),
        (
            "TC-SUP-002",
            "Reply on existing ticket",
            "Support",
            "Medium",
            "Open ticket exists.",
            ["Open ticket.", "Send reply."],
            "Reply appended; status updated.",
        ),
    ]:
        add_test_case(doc, *c)

    # Disputes
    add_heading(doc, "Disputes", 2)
    for c in [
        (
            "TC-DSP-001",
            "View disputes list",
            "Disputes",
            "High",
            "Platform: Both. User has plan and escrow disputes.",
            ["Open /disputes from support or navigation.", "Review list filters."],
            "Disputes listed with status, type (plan vs escrow), and plan reference.",
        ),
        (
            "TC-DSP-002",
            "Plan no-show dispute video capture with NDPR",
            "Disputes",
            "Critical",
            "Platform: Both. Eligible plan no-show; entry via confirm No or /dispute/[planId]?reported=.",
            [
                "Open plan dispute report flow.",
                "Record video evidence.",
                "Review NDPR consent copy in VideoEvidenceCapture.",
                "Accept and submit.",
            ],
            "Video uploaded; NDPR consent recorded; dispute created.",
        ),
        (
            "TC-DSP-003",
            "Chat log consent step grant access",
            "Disputes",
            "High",
            "Platform: Both. Plan dispute after video step.",
            [
                "Proceed to ChatLogConsentStep.",
                "Grant chat log access.",
                "Complete dispute submission.",
            ],
            "Consent recorded; dispute status reflects chat evidence available for admin.",
        ),
        (
            "TC-DSP-004",
            "Chat log consent step deny access",
            "Disputes",
            "High",
            "Platform: Both. Plan dispute after video step.",
            [
                "Proceed to ChatLogConsentStep.",
                "Decline chat log access.",
                "Complete submission.",
            ],
            "Dispute submitted without chat logs; status reflects consent declined.",
        ),
        (
            "TC-DSP-005",
            "Escrow payment dispute separate from plan dispute",
            "Disputes",
            "Critical",
            "Platform: Both. Active funded escrow with payment issue.",
            [
                "Open /escrow/[id].",
                "Open dispute modal (not plan video flow).",
                "Submit payment dispute reason.",
            ],
            "Escrow dispute created; funds on hold; support ticket path; distinct from plan no-show dispute.",
        ),
        (
            "TC-DSP-006",
            "Dispute detail view status and evidence",
            "Disputes",
            "High",
            "Platform: Both. Existing plan dispute with video submitted.",
            ["Open /dispute/[planId]/detail."],
            "Status, video evidence state, chat consent state, and next steps visible.",
        ),
    ]:
        add_test_case(doc, *c)

    # LinkUp Web
    add_heading(doc, "LinkUp Web", 2)
    add_para(
        doc,
        "Execute these cases in linkup-web (desktop or mobile browser). Shared backend with mobile; "
        "reference linkup-web/docs/PAYMENT_FLOW_CONTENT_MATRIX.md Section 10 for payment smoke matrix.",
    )
    for c in [
        (
            "TC-WEB-001",
            "Web auth login and session",
            "LinkUp Web",
            "Critical",
            "Platform: Web. Staging linkup-web URL; test account.",
            ["Open web app.", "Log in with email/password or OAuth.", "Refresh page."],
            "Session persists; user lands on Discover or onboarding.",
        ),
        (
            "TC-WEB-002",
            "Web create group plan end-to-end",
            "LinkUp Web",
            "Critical",
            "Platform: Web. Verified host.",
            [
                "Navigate to /plan/create.",
                "Enable group plan; complete policy gate.",
                "Publish group plan with minimum members.",
            ],
            "Plan created; visible on /plan/[id] with group settings and member badge.",
        ),
        (
            "TC-WEB-003",
            "Web meetup confirm page",
            "LinkUp Web",
            "Critical",
            "Platform: Web. User in meetup confirm window.",
            ["Open /plan/[id]/confirm.", "Complete Yes attended flow."],
            "ConfirmMeetupClient (1:1) or GroupGuestConfirmClient (group) works; wallet link available.",
        ),
        (
            "TC-WEB-004",
            "Web wallet withdraw dialog",
            "LinkUp Web",
            "Critical",
            "Platform: Web. Withdrawable wallet balance; bank account on file.",
            [
                "Open /wallet.",
                "Click Withdraw.",
                "Complete WalletWithdrawDialog.",
            ],
            "Withdrawal submitted via disburse-wallet; pending/completed state shown on wallet.",
        ),
        (
            "TC-WEB-005",
            "Web plan dispute video flow",
            "LinkUp Web",
            "High",
            "Platform: Web. Browser with camera permission.",
            ["Open /dispute/[planId]?reported=[userId].", "Complete video and chat consent steps."],
            "DisputeReportClient completes full flow in browser.",
        ),
        (
            "TC-WEB-006",
            "Web chat live location",
            "LinkUp Web",
            "High",
            "Platform: Web. Two accounts; plan chat at /chat/[id] or /chat/group/[id].",
            ["Share live location with consent.", "Partner views map in thread."],
            "LiveLocationConsentModal, sharing, and LiveLocationViewer work in web chat.",
        ),
        (
            "TC-WEB-007",
            "Web review submission page",
            "LinkUp Web",
            "High",
            "Platform: Web. review_unlock_at passed.",
            ["Open /plan/[id]/review.", "Submit ratings and optional text."],
            "ReviewMeetupClient saves review; success state shown.",
        ),
        (
            "TC-WEB-008",
            "Web public plan preview OG card",
            "LinkUp Web",
            "Medium",
            "Platform: Web. Published plan with share link.",
            [
                "Open /plan/[id]/preview (logged out or incognito).",
                "Verify OG metadata and plan card render.",
            ],
            "Public preview loads without auth; share card API /api/plan/[id]/card returns image metadata.",
        ),
        (
            "TC-WEB-009",
            "Web admin exigency and review reports tabs",
            "LinkUp Web",
            "High",
            "Platform: Web. Admin account.",
            [
                "Open /admin?tab=plan_disputes.",
                "Open /admin?tab=review_reports.",
            ],
            "AdminExigencySection and AdminReviewReportsPanel load and are actionable.",
        ),
        (
            "TC-WEB-010",
            "Web refund account settings page",
            "LinkUp Web",
            "High",
            "Platform: Web. User logged in.",
            ["Navigate to /settings/refund-account.", "Add or update bank account."],
            "RefundAccountSettingsScreen saves verified account for withdrawals.",
        ),
        (
            "TC-WEB-011",
            "Web minimum-action host decision page",
            "LinkUp Web",
            "Critical",
            "Platform: Web. Host with group_minimum_not_met state.",
            ["Open /plan/[id]/minimum-action.", "Execute one host decision."],
            "MinimumActionClient shows three options; selected action persists.",
        ),
        (
            "TC-WEB-012",
            "Web payment flow matrix smoke",
            "LinkUp Web",
            "Critical",
            "Platform: Web. Reference PAYMENT_FLOW_CONTENT_MATRIX.md Section 10.",
            [
                "Pick one cell: plan kind (Standard/Mood/Group) x pattern (A/B/C) x role x paid/free.",
                "Walk Review and confirm -> Confirm plan -> Secure payment (or free confirm).",
            ],
            "Each step shows correct copy and CTAs for selected matrix cell; gross amounts consistent.",
        ),
        (
            "TC-WEB-013",
            "Web agreement escrow policy and group split",
            "LinkUp Web",
            "High",
            "Platform: Web. Group plan with pending guest funding.",
            [
                "Open /plan/[id]/agreement?offerId=....",
                "Review GroupSplitAgreementSection and EscrowPolicySignOffModal.",
                "Fund via /escrow/[id].",
            ],
            "Group agreement and escrow policy modals match mobile; payment completes.",
        ),
        (
            "TC-WEB-014",
            "Web exigency route group-only guard",
            "LinkUp Web",
            "High",
            "Platform: Web. Standard 1:1 plan ID.",
            ["Navigate to /plan/[id]/exigency for non-group plan."],
            "404 or redirect; no broken exigency form for 1:1 plans.",
        ),
        (
            "TC-WEB-015",
            "Web notification inbox deep links",
            "LinkUp Web",
            "High",
            "Platform: Web. User with mixed notification types.",
            [
                "Open /notifications.",
                "Tap meetup_confirm, review_request, disbursement, and group_minimum_not_met rows.",
            ],
            "Each routes to correct web path (/plan/.../confirm, /review, /wallet, /minimum-action).",
        ),
    ]:
        add_test_case(doc, *c)

    # Admin
    add_heading(doc, "Admin", 2)
    for c in [
        (
            "TC-ADM-001",
            "Admin dashboard access control",
            "Admin",
            "Critical",
            "Admin and non-admin accounts.",
            ["Open Admin as non-admin.", "Open Admin as admin."],
            "Non-admin blocked; admin sees queues (KYC, reports, meet types, etc.); background extends behind status bar.",
        ),
        (
            "TC-ADM-002",
            "Approve custom meet type",
            "Admin",
            "High",
            "Pending user meet type in queue.",
            ["Admin -> Meet types.", "Approve type."],
            "Type active for users; submitter notified.",
        ),
        (
            "TC-ADM-003",
            "KYC approval grants Silver trial",
            "Admin",
            "High",
            "Pending KYC submission.",
            ["Admin -> Verification.", "Approve submission."],
            "User verified; Silver trial activated per policy.",
        ),
        (
            "TC-ADM-004",
            "Admin copy uses plain punctuation",
            "Admin",
            "Low",
            "Admin account.",
            ["Browse admin tabs and modals."],
            "No em dash characters in user-visible admin strings; sentences use periods or colons.",
        ),
    ]:
        add_test_case(doc, *c)

    # Non-functional
    add_heading(doc, "Non-functional", 2)
    for c in [
        (
            "TC-NFR-001",
            "App background and resume",
            "Non-functional",
            "Medium",
            "Logged in on device.",
            ["Background app 30s.", "Resume."],
            "Session intact; screen restores without crash.",
        ),
        (
            "TC-NFR-002",
            "Pull to refresh on Meetr/Discover",
            "Non-functional",
            "Medium",
            "On Discover or Meetr.",
            ["Pull to refresh."],
            "Feed reloads; spinner dismisses.",
        ),
        (
            "TC-NFR-003",
            "Offline graceful error",
            "Non-functional",
            "High",
            "Enable airplane mode.",
            ["Open Discover or Messages."],
            "Friendly error/empty state; no white screen crash.",
        ),
    ]:
        add_test_case(doc, *c)

    add_heading(doc, "6. Test Execution Summary", 1)
    summary = doc.add_table(rows=2, cols=6)
    summary.style = "Table Grid"
    headers = ["Total Cases", "Passed", "Failed", "Blocked", "Not Run", "Pass Rate %"]
    for i, h in enumerate(headers):
        summary.rows[0].cells[i].text = h
    summary.rows[1].cells[0].text = str(TOTAL_CASES)

    add_heading(doc, "7. Sign-off", 1)
    sign = doc.add_table(rows=4, cols=4)
    sign.style = "Table Grid"
    sign.rows[0].cells[0].text = "Role"
    sign.rows[0].cells[1].text = "Name"
    sign.rows[0].cells[2].text = "Signature"
    sign.rows[0].cells[3].text = "Date"
    for role in ["QA Lead", "Product Owner", "Engineering Lead"]:
        add_table_row(sign, [role, "", "", ""])

    return doc


def save_doc_from_docx(docx_path: Path, doc_path: Path) -> None:
    try:
        import win32com.client  # type: ignore

        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        doc = word.Documents.Open(str(docx_path.resolve()))
        doc.SaveAs(str(doc_path.resolve()), FileFormat=0)  # wdFormatDocument
        doc.Close()
        word.Quit()
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"Could not write legacy .doc file: {exc}") from exc


def main() -> None:
    doc = build_document()
    doc.save(DOCX_PATH)
    save_doc_from_docx(DOCX_PATH, DOC_PATH)
    print(f"Wrote {DOCX_PATH.name} and {DOC_PATH.name} ({TOTAL_CASES} cases)")


if __name__ == "__main__":
    main()
