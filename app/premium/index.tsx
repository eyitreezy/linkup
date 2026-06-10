/**
 * Legacy route — redirects to subscription tiers (Flutterwave).
 */
import { Href, Redirect } from 'expo-router';

export default function PremiumRedirectScreen() {
  return <Redirect href={'/subscription' as Href} />;
}
