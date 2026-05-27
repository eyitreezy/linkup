/**
 * @deprecated Use `OnboardingStickyProgress` outside ScrollView for full-bleed sticky progress.
 */
import { OnboardingStickyProgress } from '@/components/onboarding/OnboardingStickyProgress';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';

type Props = {
  step: number;
  total?: number;
};

export function OnboardingProgress({ step, total = ONBOARDING_TOTAL_STEPS }: Props) {
  return <OnboardingStickyProgress step={step} total={total} />;
}
