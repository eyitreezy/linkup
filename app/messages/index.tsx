/**
 * Deep link / stack entry — canonical path /messages → tab inbox.
 */
import { Redirect, type Href } from 'expo-router';

export default function MessagesPathRedirect() {
  return <Redirect href={'/(tabs)/messages' as Href} />;
}
