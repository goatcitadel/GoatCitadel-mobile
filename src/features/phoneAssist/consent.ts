import { createIdempotencyKey } from '../../api/client';
import Constants from 'expo-constants';
import type {
    PhoneAssistCapabilityId,
    PhoneAssistConsentRecord,
    PhoneAssistConsentScope,
} from './contracts';
import {
    PHONE_ASSIST_CAPABILITY_DEFINITIONS,
    PHONE_ASSIST_POLICY_VERSION,
    createDisclosureHash,
} from './contracts';
import { appendPhoneAssistAuditEvent } from './audit';
import { loadConsentRecords, saveConsentRecords } from './storage';

export async function listPhoneAssistConsents(): Promise<PhoneAssistConsentRecord[]> {
    const records = await loadConsentRecords();
    return [...records].sort((left, right) => right.grantedAt.localeCompare(left.grantedAt));
}

export async function getActiveConsentForCapability(
    capability: PhoneAssistCapabilityId,
): Promise<PhoneAssistConsentRecord | undefined> {
    const records = await loadConsentRecords();
    return records.find((record) => record.capability === capability && record.granted && !record.revokedAt);
}

export async function grantCapabilityConsent(
    capability: PhoneAssistCapabilityId,
    scope: PhoneAssistConsentScope = 'consumer_play_app',
): Promise<PhoneAssistConsentRecord> {
    const definition = PHONE_ASSIST_CAPABILITY_DEFINITIONS[capability];
    const disclosureHash = await createDisclosureHash(definition.userDisclosure);
    const next: PhoneAssistConsentRecord = {
        consentId: createIdempotencyKey(),
        capability,
        policyVersion: PHONE_ASSIST_POLICY_VERSION,
        disclosureHash,
        granted: true,
        grantedAt: new Date().toISOString(),
        scope,
        actor: 'device_user',
        appVersion: resolveAppVersion(),
    };
    const current = await loadConsentRecords();
    const updated = current.map((record) => (
        record.capability === capability && record.granted && !record.revokedAt
            ? { ...record, revokedAt: next.grantedAt }
            : record
    ));
    await saveConsentRecords([next, ...updated]);
    await appendPhoneAssistAuditEvent({
        type: 'capability_enabled',
        capability,
        summary: `${definition.label} consent granted`,
        detail: definition.summary,
        sensitivity: 'moderate',
    });
    return next;
}

function resolveAppVersion(): string | undefined {
    if (typeof Constants.expoConfig?.version === 'string' && Constants.expoConfig.version.trim()) {
        return Constants.expoConfig.version.trim();
    }
    if (typeof Constants.nativeAppVersion === 'string' && Constants.nativeAppVersion.trim()) {
        return Constants.nativeAppVersion.trim();
    }
    return undefined;
}

export async function revokeCapabilityConsent(
    capability: PhoneAssistCapabilityId,
    reason = 'Revoked from Privacy Center.',
): Promise<boolean> {
    const current = await loadConsentRecords();
    let changed = false;
    const revokedAt = new Date().toISOString();
    const updated = current.map((record) => {
        if (record.capability === capability && record.granted && !record.revokedAt) {
            changed = true;
            return { ...record, revokedAt };
        }
        return record;
    });
    if (!changed) {
        return false;
    }
    await saveConsentRecords(updated);
    await appendPhoneAssistAuditEvent({
        type: 'capability_revoked',
        capability,
        summary: `${PHONE_ASSIST_CAPABILITY_DEFINITIONS[capability].label} revoked`,
        detail: reason,
        sensitivity: 'moderate',
    });
    return true;
}

export async function revokeAllCapabilityConsents(reason: string): Promise<PhoneAssistCapabilityId[]> {
    const current = await loadConsentRecords();
    const revokedAt = new Date().toISOString();
    const revoked = new Set<PhoneAssistCapabilityId>();
    const updated = current.map((record) => {
        if (record.granted && !record.revokedAt) {
            revoked.add(record.capability);
            return { ...record, revokedAt };
        }
        return record;
    });
    if (revoked.size === 0) {
        return [];
    }
    await saveConsentRecords(updated);
    for (const capability of revoked) {
        await appendPhoneAssistAuditEvent({
            type: 'capability_revoked',
            capability,
            summary: `${PHONE_ASSIST_CAPABILITY_DEFINITIONS[capability].label} revoked`,
            detail: reason,
            sensitivity: 'moderate',
        });
    }
    return [...revoked];
}
