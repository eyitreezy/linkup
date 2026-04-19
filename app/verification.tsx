/**
 * Legacy route — KYC now lives at /kyc (multi-step wizard).
 */
import { Href, Redirect } from 'expo-router';

export default function LegacyVerificationRedirect() {
  return <Redirect href={'/kyc' as Href} />;
}
