/**
 * Legacy route — redirects to subscription callback after payment.
 */
import { Href, Redirect } from 'expo-router';

export default function PremiumSuccessRedirectScreen() {
  return <Redirect href={'/subscription/callback' as Href} />;
}
