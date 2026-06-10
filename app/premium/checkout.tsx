/**
 * Legacy route — redirects to subscription checkout (Flutterwave).
 */
import { Href, Redirect } from 'expo-router';

export default function PremiumCheckoutRedirectScreen() {
  return <Redirect href={'/subscription' as Href} />;
}
