import type { PhoneAssistCapabilityId } from './contracts';

export interface PhoneAssistFeatureFlagState {
    share_intake: boolean;
    otp_assist: boolean;
    screen_share: boolean;
    notification_awareness: boolean;
    call_screening: boolean;
    accessibility_helper: boolean;
}

export const PHONE_ASSIST_FEATURE_FLAGS: PhoneAssistFeatureFlagState = {
    share_intake: true,
    otp_assist: true,
    screen_share: false,
    notification_awareness: false,
    call_screening: false,
    accessibility_helper: false,
};

export function isCapabilityFlagEnabled(capability: PhoneAssistCapabilityId): boolean {
    switch (capability) {
        case 'share_intake':
            return PHONE_ASSIST_FEATURE_FLAGS.share_intake;
        case 'otp_assist':
            return PHONE_ASSIST_FEATURE_FLAGS.otp_assist;
        case 'screen_share':
            return PHONE_ASSIST_FEATURE_FLAGS.screen_share;
        case 'notification_awareness':
            return PHONE_ASSIST_FEATURE_FLAGS.notification_awareness;
        case 'call_screening':
            return PHONE_ASSIST_FEATURE_FLAGS.call_screening;
        case 'accessibility_helper':
            return PHONE_ASSIST_FEATURE_FLAGS.accessibility_helper;
        default:
            return false;
    }
}
