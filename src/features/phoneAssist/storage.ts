import { deleteSecureItem, getSecureItem, setSecureItem } from '../../utils/storage';
import type {
    PhoneAssistAuditEvent,
    PhoneAssistConsentRecord,
    PhoneAssistPrivacySettings,
} from './contracts';
import { DEFAULT_PHONE_ASSIST_PRIVACY_SETTINGS } from './contracts';

const STORE_KEY_CONSENTS = 'gc_phone_assist_consents';
const STORE_KEY_AUDIT = 'gc_phone_assist_audit';
const STORE_KEY_PRIVACY = 'gc_phone_assist_privacy_settings';

async function readJson<T>(key: string, fallback: T): Promise<T> {
    const raw = await getSecureItem(key);
    if (!raw?.trim()) {
        return fallback;
    }
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

async function writeJson(key: string, value: unknown): Promise<void> {
    await setSecureItem(key, JSON.stringify(value));
}

export async function loadConsentRecords(): Promise<PhoneAssistConsentRecord[]> {
    return readJson<PhoneAssistConsentRecord[]>(STORE_KEY_CONSENTS, []);
}

export async function saveConsentRecords(records: PhoneAssistConsentRecord[]): Promise<void> {
    await writeJson(STORE_KEY_CONSENTS, records);
}

export async function loadAuditEvents(): Promise<PhoneAssistAuditEvent[]> {
    return readJson<PhoneAssistAuditEvent[]>(STORE_KEY_AUDIT, []);
}

export async function saveAuditEvents(events: PhoneAssistAuditEvent[]): Promise<void> {
    await writeJson(STORE_KEY_AUDIT, events.slice(0, 200));
}

export async function loadPrivacySettings(): Promise<PhoneAssistPrivacySettings> {
    const loaded = await readJson<Partial<PhoneAssistPrivacySettings>>(STORE_KEY_PRIVACY, {});
    return {
        ...DEFAULT_PHONE_ASSIST_PRIVACY_SETTINGS,
        ...loaded,
    };
}

export async function savePrivacySettings(settings: PhoneAssistPrivacySettings): Promise<void> {
    await writeJson(STORE_KEY_PRIVACY, settings);
}

export async function clearPhoneAssistData(): Promise<void> {
    await Promise.all([
        deleteSecureItem(STORE_KEY_CONSENTS),
        deleteSecureItem(STORE_KEY_AUDIT),
        deleteSecureItem(STORE_KEY_PRIVACY),
    ]);
}
