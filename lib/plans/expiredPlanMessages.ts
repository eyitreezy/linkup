export type ExpiredPlanAction = 'offer' | 'join' | 'share' | 'invite';

export function expiredPlanActionCopy(action: ExpiredPlanAction): {
  title: string;
  message: string;
} {
  switch (action) {
    case 'offer':
      return {
        title: 'Plan expired',
        message: 'This plan has already expired, so new offers can no longer be made.',
      };
    case 'join':
      return {
        title: 'Plan expired',
        message: 'This plan has already expired and can no longer be joined.',
      };
    case 'share':
      return {
        title: 'Plan expired',
        message: 'This plan has already expired and can no longer be shared.',
      };
    case 'invite':
      return {
        title: 'Plan expired',
        message: 'This plan has already expired, so new invitations cannot be sent.',
      };
    default:
      return {
        title: 'Plan expired',
        message: 'This plan is no longer active.',
      };
  }
}
