const mockStorage = new Map<string, string>();

jest.mock('../src/utils/storage', () => ({
    getSecureItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setSecureItem: jest.fn(async (key: string, value: string) => {
        mockStorage.set(key, value);
    }),
    deleteSecureItem: jest.fn(async (key: string) => {
        mockStorage.delete(key);
    }),
}));

describe('share inbox', () => {
    const loadShareInbox = () => require('../src/features/phoneAssist/shareInbox');

    beforeEach(() => {
        mockStorage.clear();
        jest.resetModules();
    });

    it('normalizes and persists shared drafts', async () => {
        const {
            normalizeNativeSharedDraft,
            enqueueSharedDraft,
            listSharedDrafts,
        } = loadShareInbox();

        const draft = normalizeNativeSharedDraft({
            draftId: 'share-1',
            receivedAt: '2026-04-10T12:00:00.000Z',
            source: 'android-share-sheet',
            text: 'Look at this',
            attachment: {
                uri: 'file:///tmp/test.jpg',
                mimeType: 'image/jpeg',
                fileName: 'test.jpg',
                sizeBytes: 1234,
            },
        });

        expect(draft).toBeTruthy();
        await enqueueSharedDraft(draft);

        const drafts = await listSharedDrafts();
        expect(drafts).toHaveLength(1);
        expect(drafts[0]?.text).toBe('Look at this');
        expect(drafts[0]?.attachment?.fileName).toBe('test.jpg');
    });

    it('consumes drafts exactly once', async () => {
        const {
            enqueueSharedDraft,
            consumeSharedDraft,
            listSharedDrafts,
        } = loadShareInbox();

        await enqueueSharedDraft({
            draftId: 'share-2',
            receivedAt: '2026-04-10T12:00:00.000Z',
            source: 'android-share-sheet',
            subject: 'Shared note',
        });

        const consumed = await consumeSharedDraft('share-2');
        const remaining = await listSharedDrafts();

        expect(consumed?.draftId).toBe('share-2');
        expect(remaining).toHaveLength(0);
    });

    it('expires stale drafts during refresh windows', async () => {
        const {
            enqueueSharedDraft,
            pruneExpiredSharedDrafts,
            listSharedDrafts,
        } = loadShareInbox();

        await enqueueSharedDraft({
            draftId: 'share-3',
            receivedAt: '2026-04-01T12:00:00.000Z',
            source: 'android-share-sheet',
            text: 'Expired item',
        });

        const expired = await pruneExpiredSharedDrafts(new Date('2026-04-10T12:00:00.000Z'));
        const remaining = await listSharedDrafts();

        expect(expired).toHaveLength(1);
        expect(expired[0]?.draftId).toBe('share-3');
        expect(remaining).toHaveLength(0);
    });
});
