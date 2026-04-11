import { appendPhoneAssistAuditEvent, listPhoneAssistAuditEvents } from './audit';
import { listPhoneAssistConsents, revokeAllCapabilityConsents } from './consent';
import type { PhoneAssistPrivacySettings } from './contracts';
import { DEFAULT_PHONE_ASSIST_PRIVACY_SETTINGS } from './contracts';
import { clearSharedDrafts } from './shareInbox';
import { clearPhoneAssistData, loadPrivacySettings, savePrivacySettings } from './storage';

export async function getPhoneAssistPrivacyState() {
    const [settings, consents, audit] = await Promise.all([
        loadPrivacySettings(),
        listPhoneAssistConsents(),
        listPhoneAssistAuditEvents(),
    ]);
    return { settings, consents, audit };
}

export async function updatePhoneAssistPrivacySettings(
    patch: Partial<PhoneAssistPrivacySettings>,
): Promise<PhoneAssistPrivacySettings> {
    const current = await loadPrivacySettings();
    const next = { ...current, ...patch };
    await savePrivacySettings(next);
    await appendPhoneAssistAuditEvent({
        type: 'privacy_settings_updated',
        summary: 'Privacy settings updated',
        detail: JSON.stringify(patch),
        sensitivity: 'low',
    });
    return next;
}

export async function triggerPhoneAssistPanicOff(): Promise<PhoneAssistPrivacySettings> {
    const revokedCapabilities = await revokeAllCapabilityConsents('Emergency disable triggered.');
    const clearedDrafts = await clearSharedDrafts();
    const current = await loadPrivacySettings();
    const next: PhoneAssistPrivacySettings = {
        ...current,
        cloudSyncEnabled: false,
        panicOffLatchedAt: new Date().toISOString(),
    };
    await savePrivacySettings(next);
    await appendPhoneAssistAuditEvent({
        type: 'panic_off_triggered',
        summary: 'Emergency disable triggered',
        detail: [
            revokedCapabilities.length > 0 ? `Revoked: ${revokedCapabilities.join(', ')}` : 'No active consents to revoke.',
            clearedDrafts.length > 0 ? `Cleared ${clearedDrafts.length} pending shared draft(s).` : 'No pending shared drafts.',
        ].join(' '),
        sensitivity: 'high',
    });
    return next;
}

export async function resetPhoneAssistPrivacyState(): Promise<PhoneAssistPrivacySettings> {
    await clearSharedDrafts();
    await clearPhoneAssistData();
    await savePrivacySettings(DEFAULT_PHONE_ASSIST_PRIVACY_SETTINGS);
    return DEFAULT_PHONE_ASSIST_PRIVACY_SETTINGS;
}
