import type {
    PhoneAssistCapabilityId,
    PhoneAssistPolicyDecision,
    PhoneAssistPrivacySettings,
    SanitizedObservation,
} from './contracts';
import {
    PHONE_ASSIST_CAPABILITY_DEFINITIONS,
    type PhoneAssistCapabilityState,
} from './contracts';
import { isCapabilityFlagEnabled } from './flags';
import { getActiveConsentForCapability } from './consent';

export async function evaluateCapabilityPolicy(
    capability: PhoneAssistCapabilityId,
): Promise<PhoneAssistPolicyDecision> {
    const definition = PHONE_ASSIST_CAPABILITY_DEFINITIONS[capability];
    if (!isCapabilityFlagEnabled(capability)) {
        return {
            allowed: false,
            reason: definition.defaultState.kind === 'blocked'
                ? definition.defaultState.reason
                : `${definition.label} is disabled in this build.`,
            requiresConsent: false,
            requiresFeatureFlag: true,
            state: definition.defaultState,
        };
    }

    const consent = await getActiveConsentForCapability(capability);
    const state: PhoneAssistCapabilityState = consent
        ? { kind: 'enabled', since: consent.grantedAt }
        : definition.consentRequired
            ? { kind: 'needs-consent', specialAccess: definition.specialAccess }
            : { kind: 'available' };

    return {
        allowed: Boolean(consent) || !definition.consentRequired,
        reason: consent
            ? `${definition.label} is enabled for this device.`
            : definition.consentRequired
                ? `${definition.label} requires explicit consent and is not active.`
                : `${definition.label} is available and user-initiated.`,
        requiresConsent: definition.consentRequired && !consent,
        requiresFeatureFlag: false,
        state,
    };
}

export function evaluateObservationForCloud(
    observation: SanitizedObservation,
    settings: PhoneAssistPrivacySettings,
): PhoneAssistPolicyDecision {
    if (!settings.cloudSyncEnabled) {
        return {
            allowed: false,
            reason: 'Cloud sync is disabled in Privacy Center.',
            requiresConsent: false,
            requiresFeatureFlag: false,
            state: { kind: 'disabled' },
        };
    }
    if (observation.sensitivity === 'high') {
        return {
            allowed: false,
            reason: 'High-sensitivity observations stay local by default.',
            requiresConsent: true,
            requiresFeatureFlag: false,
            state: { kind: 'needs-consent' },
        };
    }
    return {
        allowed: true,
        reason: 'Observation may be synced because cloud sync is enabled and the payload is sanitized.',
        requiresConsent: false,
        requiresFeatureFlag: false,
        state: { kind: 'available' },
    };
}
