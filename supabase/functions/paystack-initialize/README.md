# paystack-initialize

Creates a Paystack transaction via the **Initialize Transaction** API and returns `authorization_url` for the mobile app to open.

Deploy **with JWT verification enabled** (default). The app calls this with the user's session token.

```bash
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_test_...
npx supabase functions deploy paystack-initialize
```
