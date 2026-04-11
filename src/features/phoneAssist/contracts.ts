import * as ExpoCrypto from 'expo-crypto';

export const PHONE_ASSIST_POLICY_VERSION = '2026-04-play-safe-v1';

export const PHONE_ASSIST_CAPABILITIES = [
    'share_intake',
    'otp_assist',
    'screen_share',
    'notification_awareness',
    'call_screening',
    'accessibility_helper',
] as const;

export type PhoneAssistCapabilityId = typeof PHONE_ASSIST_CAPABILITIES[number];

export type PhoneAssistCapabilityState =
    | { kind: 'disabled' }
    | { kind: 'available' }
    | { kind: 'needs-consent'; specialAccess?: boolean }
    | { kind: 'enabled'; since: string }
    | { kind: 'blocked'; reason: string };

export type PhoneAssistProcessingMode = 'local_only' | 'local_first' | 'cloud_optional';
export type PhoneAssistSensitivity = 'low' | 'moderate' | 'high';
export type PhoneAssistConsentScope =
    | 'consumer_play_app'
    | 'login_token'
    | 'share_sheet_review'
    | 'manual_review';
export type PhoneAssistAuditEventType =
    | 'capability_enabled'
    | 'capability_revoked'
    | 'observation_captured'
    | 'ai_proposal_created'
    | 'ai_proposal_blocked'
    | 'panic_off_triggered'
    | 'privacy_settings_updated'
    | 'share_draft_received'
    | 'share_draft_consumed'
    | 'share_draft_dismissed'
    | 'share_draft_expired'
    | 'otp_assist_started'
    | 'otp_assist_prompted'
    | 'otp_assist_matched'
    | 'otp_assist_timeout'
    | 'otp_assist_cancelled'
    | 'otp_assist_error';

export interface PhoneAssistCapabilityDisclosure {
    summary: string;
    backgroundBehavior: string;
    processing: string;
    retention: string;
}

export interface PhoneAssistAuditPreview {
    title: string;
    detail?: string;
    sensitivity: PhoneAssistSensitivity;
}

export interface PhoneAssistCapabilityDefinition {
    id: PhoneAssistCapabilityId;
    label: string;
    summary: string;
    canAccess: string[];
    mustNeverAccess: string[];
    retention: string;
    processing: PhoneAssistProcessingMode;
    specialAccess: boolean;
    consentRequired: boolean;
    featureFlag: 'consumer_mvp' | 'future_flagged' | 'enterprise_only';
    defaultState: PhoneAssistCapabilityState;
    userDisclosure: string;
    disclosure: PhoneAssistCapabilityDisclosure;
    implementationStatus: 'ready' | 'stubbed' | 'deferred';
}

export interface PhoneAssistConsentRecord {
    consentId: string;
    capability: PhoneAssistCapabilityId;
    policyVersion: string;
    disclosureHash: string;
    granted: boolean;
    grantedAt: string;
    revokedAt?: string;
    scope: PhoneAssistConsentScope;
    actor: 'device_user';
    appVersion?: string;
}

export interface PhoneAssistAuditEvent {
    eventId: string;
    type: PhoneAssistAuditEventType;
    at: string;
    capability?: PhoneAssistCapabilityId;
    summary: string;
    detail?: string;
    sensitivity?: PhoneAssistSensitivity;
}

export interface SanitizedObservation {
    source: PhoneAssistCapabilityId;
    summary: string;
    structuredFields: Record<string, string>;
    sensitivity: PhoneAssistSensitivity;
    expiresAt: string;
}

export interface PhoneAssistPrivacySettings {
    cloudSyncEnabled: boolean;
    exportRedactedByDefault: boolean;
    retainAuditDays: 7 | 30 | 90;
    showBackgroundIndicators: boolean;
    panicOffLatchedAt?: string;
}

export interface PhoneAssistPolicyDecision {
    allowed: boolean;
    reason: string;
    requiresConsent: boolean;
    requiresFeatureFlag: boolean;
    state: PhoneAssistCapabilityState;
}

export interface OtpAssistRequest {
    flow: 'login_token' | 'pairing';
    timeoutMs?: number;
    senderAddress?: string;
}

export interface OtpAssistAvailability {
    status: 'available' | 'blocked';
    detail: string;
    timeoutMs?: number;
}

export type OtpAssistEventStatus = 'started' | 'prompted' | 'matched' | 'timeout' | 'cancelled' | 'error';

export interface OtpAssistResult {
    status: OtpAssistEventStatus;
    at: string;
    code?: string;
    message?: string;
    detail?: string;
}

export type ScreenShareFramePolicy = 'local_redact' | 'local_only' | 'cloud_optional';
export type ScreenShareStopReason = 'user_stopped' | 'panic_off' | 'timeout' | 'not_allowed';

export interface ScreenShareSessionState {
    status: 'blocked' | 'available' | 'active';
    detail: string;
    framePolicy: ScreenShareFramePolicy;
    stopReason?: ScreenShareStopReason;
}

export const PHONE_ASSIST_CAPABILITY_DEFINITIONS: Record<
    PhoneAssistCapabilityId,
    PhoneAssistCapabilityDefinition
> = {
    share_intake: {
        id: 'share_intake',
        label: 'Share Intake',
        summary: 'Stages content you explicitly share into Citadel before it reaches chat.',
        canAccess: ['The text or file you send through the Android share sheet'],
        mustNeverAccess: ['Unshared app content', 'Background clipboard reads', 'Your general file history'],
        retention: 'Pending drafts stay local until reviewed, dismissed, or expired.',
        processing: 'local_first',
        specialAccess: false,
        consentRequired: false,
        featureFlag: 'consumer_mvp',
        defaultState: { kind: 'available' },
        userDisclosure: 'Citadel only sees items you explicitly share into the app. Shared drafts wait for visible review before they reach chat.',
        disclosure: {
            summary: 'Review content you share before it reaches a chat.',
            backgroundBehavior: 'No background collection. Drafts only appear after a visible share action.',
            processing: 'Local-first draft staging.',
            retention: 'Pending drafts stay on-device until reviewed, dismissed, or expired.',
        },
        implementationStatus: 'ready',
    },
    otp_assist: {
        id: 'otp_assist',
        label: 'OTP Assist',
        summary: 'Helps complete login and pairing flows with a consented verification-code handoff.',
        canAccess: ['A single consented verification message during an active verification flow'],
        mustNeverAccess: ['General SMS inbox', 'Message history', 'Call logs'],
        retention: 'No retained message content; consent and audit metadata only.',
        processing: 'local_only',
        specialAccess: false,
        consentRequired: true,
        featureFlag: 'consumer_mvp',
        defaultState: { kind: 'available' },
        userDisclosure: 'Citadel can help with one verification code during an active sign-in flow. It does not read your SMS inbox or store message history.',
        disclosure: {
            summary: 'Use Android’s one-message consent flow to fill a login or pairing code.',
            backgroundBehavior: 'Only active while you explicitly start the helper from the login screen.',
            processing: 'Local-only; the message body is not uploaded.',
            retention: 'No retained message body, only local consent and audit receipts.',
        },
        implementationStatus: 'ready',
    },
    screen_share: {
        id: 'screen_share',
        label: 'Screen Share',
        summary: 'User-started session sharing for visible, time-bounded assistance.',
        canAccess: ['Pixels from the current shared session'],
        mustNeverAccess: ['Silent background capture', 'Call audio', 'Persistent history by default'],
        retention: 'Ephemeral session buffers; audit receipt only unless you explicitly export.',
        processing: 'cloud_optional',
        specialAccess: true,
        consentRequired: true,
        featureFlag: 'future_flagged',
        defaultState: { kind: 'blocked', reason: 'Screen share is scaffolded but disabled in the Play-safe MVP.' },
        userDisclosure: 'Screen sharing is off by default. When enabled in a future release it will be obvious, time-bounded, and easy to stop.',
        disclosure: {
            summary: 'Visible session sharing with an obvious stop control.',
            backgroundBehavior: 'Not available in this build.',
            processing: 'Local-first with explicit per-session cloud approval.',
            retention: 'Ephemeral unless you explicitly export.',
        },
        implementationStatus: 'deferred',
    },
    notification_awareness: {
        id: 'notification_awareness',
        label: 'Notification Awareness',
        summary: 'Optional allowlisted notification summaries for future releases only.',
        canAccess: ['Notification title and body from user-enabled apps'],
        mustNeverAccess: ['SMS inbox', 'Reply actions', 'Hidden background automation'],
        retention: 'Local-only summaries with short retention.',
        processing: 'local_first',
        specialAccess: true,
        consentRequired: true,
        featureFlag: 'future_flagged',
        defaultState: { kind: 'blocked', reason: 'Notification access is intentionally excluded from the consumer Play build.' },
        userDisclosure: 'Notification awareness is not part of the consumer Play build.',
        disclosure: {
            summary: 'Optional allowlisted notification summaries for a future lane.',
            backgroundBehavior: 'Not available in this build.',
            processing: 'Local-first.',
            retention: 'Short-lived local summaries only.',
        },
        implementationStatus: 'deferred',
    },
    call_screening: {
        id: 'call_screening',
        label: 'Call Screening',
        summary: 'Metadata-only caller ID and spam triage for a future dedicated lane.',
        canAccess: ['Incoming caller metadata'],
        mustNeverAccess: ['Call audio', 'Call log history', 'SMS'],
        retention: 'Metadata only, bounded retention.',
        processing: 'local_first',
        specialAccess: true,
        consentRequired: true,
        featureFlag: 'future_flagged',
        defaultState: { kind: 'blocked', reason: 'Call screening is not included in the Play-safe MVP.' },
        userDisclosure: 'Citadel Mobile does not screen or record calls in this build.',
        disclosure: {
            summary: 'Metadata-only caller triage for a future dedicated lane.',
            backgroundBehavior: 'Not available in this build.',
            processing: 'Local-first metadata handling only.',
            retention: 'Bounded metadata retention.',
        },
        implementationStatus: 'deferred',
    },
    accessibility_helper: {
        id: 'accessibility_helper',
        label: 'Accessibility Helper',
        summary: 'Enterprise-only deterministic automation under managed-device controls.',
        canAccess: ['Reviewed accessibility node metadata during an active enterprise session'],
        mustNeverAccess: ['Autonomous loops', 'Hidden gestures', 'General consumer-device control'],
        retention: 'No consumer retention path.',
        processing: 'local_only',
        specialAccess: true,
        consentRequired: true,
        featureFlag: 'enterprise_only',
        defaultState: { kind: 'blocked', reason: 'Accessibility automation is enterprise-only and excluded from this app.' },
        userDisclosure: 'Accessibility automation is not part of the consumer Play app.',
        disclosure: {
            summary: 'Enterprise-only deterministic automation under managed-device review.',
            backgroundBehavior: 'Not available in this build.',
            processing: 'Local-only in managed environments.',
            retention: 'No consumer retention path.',
        },
        implementationStatus: 'deferred',
    },
};

export const DEFAULT_PHONE_ASSIST_PRIVACY_SETTINGS: PhoneAssistPrivacySettings = {
    cloudSyncEnabled: false,
    exportRedactedByDefault: true,
    retainAuditDays: 30,
    showBackgroundIndicators: true,
};

export async function createDisclosureHash(disclosure: string): Promise<string> {
    return ExpoCrypto.digestStringAsync(
        ExpoCrypto.CryptoDigestAlgorithm.SHA256,
        `${PHONE_ASSIST_POLICY_VERSION}:${disclosure}`,
        { encoding: ExpoCrypto.CryptoEncoding.HEX },
    );
}
