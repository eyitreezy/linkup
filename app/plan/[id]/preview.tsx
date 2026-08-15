import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

/** Share links use /plan/{id}/preview — redirect into the in-app plan detail route. */
export default function PlanPreviewDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) {
    return <Redirect href={'/(tabs)' as Href} />;
  }
  return <Redirect href={`/plan/${id}` as Href} />;
}
