const mockStorage = new Map<string, string>();
let mockIdCounter = 0;

jest.mock('../src/utils/storage', () => ({
    getSecureItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setSecureItem: jest.fn(async (key: string, value: string) => {
        mockStorage.set(key, value);
    }),
    deleteSecureItem: jest.fn(async (key: string) => {
        mockStorage.delete(key);
    }),
}));

jest.mock('../src/api/client', () => ({
    createIdempotencyKey: jest.fn(() => `id-${++mockIdCounter}`),
}));

jest.mock('expo-crypto', () => ({
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    CryptoEncoding: { HEX: 'hex' },
    digestStringAsync: jest.fn(async (_algorithm: string, input: string) => `hash:${input}`),
}));

describe('phone assist policy scaffolding', () => {
    const loadPhoneAssist = () => require('../src/features/phoneAssist');

    beforeEach(() => {
        mockStorage.clear();
        mockIdCounter = 0;
        jest.resetModules();
    });

    it('records consent receipts and audit events for capability grants', async () => {
        const {
            grantCapabilityConsent,
            listPhoneAssistConsents,
            listPhoneAssistAuditEvents,
        } = loadPhoneAssist();

        await grantCapabilityConsent('otp_assist');

        const consents = await listPhoneAssistConsents();
        const audit = await listPhoneAssistAuditEvents();

        expect(consents).toHaveLength(1);
        expect(consents[0]?.capability).toBe('otp_assist');
        expect(consents[0]?.revokedAt).toBeUndefined();
        expect(audit[0]?.type).toBe('capability_enabled');
    });

    it('panic-off revokes active consents and disables cloud sync', async () => {
        const {
            grantCapabilityConsent,
            getPhoneAssistPrivacyState,
            enqueueSharedDraft,
            triggerPhoneAssistPanicOff,
        } = loadPhoneAssist();

        await grantCapabilityConsent('otp_assist');
        await enqueueSharedDraft({
            draftId: 'share-1',
            receivedAt: '2026-04-10T12:00:00.000Z',
            source: 'android-share-sheet',
            text: 'Shared before panic-off',
        });
        await triggerPhoneAssistPanicOff();

        const state = await getPhoneAssistPrivacyState();
        const latestConsent = state.consents[0];
        const latestAudit = state.audit[0];
        const drafts = await loadPhoneAssist().listSharedDrafts();

        expect(state.settings.cloudSyncEnabled).toBe(false);
        expect(state.settings.panicOffLatchedAt).toBeTruthy();
        expect(latestConsent?.revokedAt).toBeTruthy();
        expect(latestAudit?.type).toBe('panic_off_triggered');
        expect(drafts).toHaveLength(0);
    });

    it('blocks future-flagged capabilities in the consumer build', async () => {
        const { evaluateCapabilityPolicy } = loadPhoneAssist();

        const decision = await evaluateCapabilityPolicy('screen_share');

        expect(decision.allowed).toBe(false);
        expect(decision.requiresFeatureFlag).toBe(true);
        expect(decision.state.kind).toBe('blocked');
    });

    it('treats share intake as a user-initiated consumer capability', async () => {
        const { evaluateCapabilityPolicy } = loadPhoneAssist();

        const decision = await evaluateCapabilityPolicy('share_intake');

        expect(decision.allowed).toBe(true);
        expect(decision.requiresConsent).toBe(false);
        expect(decision.state.kind).toBe('available');
    });
});
