import { deleteSecureItem, getSecureItem, setSecureItem } from '../../utils/storage';

const STORE_KEY_SHARE_DRAFTS = 'gc_phone_assist_share_drafts';
const SHARE_DRAFT_RETENTION_MS = 72 * 60 * 60 * 1000;
const SHARE_DRAFT_LIMIT = 10;

export interface SharedDraftAttachment {
    uri: string;
    mimeType: string;
    fileName: string;
    sizeBytes?: number;
}

export interface SharedDraft {
    draftId: string;
    receivedAt: string;
    source: 'android-share-sheet';
    text?: string;
    subject?: string;
    attachment?: SharedDraftAttachment;
}

export interface NativeSharedDraftPayload {
    draftId?: string;
    receivedAt?: string;
    source?: string;
    text?: string;
    subject?: string;
    attachment?: {
        uri?: string;
        mimeType?: string;
        fileName?: string;
        sizeBytes?: number;
    };
}

async function readDrafts(): Promise<SharedDraft[]> {
    const raw = await getSecureItem(STORE_KEY_SHARE_DRAFTS);
    if (!raw?.trim()) {
        return [];
    }
    try {
        return JSON.parse(raw) as SharedDraft[];
    } catch {
        return [];
    }
}

async function writeDrafts(drafts: SharedDraft[]): Promise<void> {
    if (drafts.length === 0) {
        await deleteSecureItem(STORE_KEY_SHARE_DRAFTS);
        return;
    }
    await setSecureItem(STORE_KEY_SHARE_DRAFTS, JSON.stringify(drafts));
}

export async function listSharedDrafts(): Promise<SharedDraft[]> {
    const drafts = await readDrafts();
    return [...drafts].sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
}

export async function pruneExpiredSharedDrafts(now = new Date()): Promise<SharedDraft[]> {
    const current = await readDrafts();
    const nowMs = now.getTime();
    const expired = current.filter((draft) => {
        const parsed = Date.parse(draft.receivedAt);
        if (!Number.isFinite(parsed)) {
            return true;
        }
        return nowMs - parsed > SHARE_DRAFT_RETENTION_MS;
    });
    if (expired.length === 0) {
        return [];
    }
    const retained = current.filter((draft) => !expired.some((item) => item.draftId === draft.draftId));
    await writeDrafts(retained);
    return expired;
}

export function normalizeNativeSharedDraft(payload: NativeSharedDraftPayload): SharedDraft | null {
    if (!payload.draftId || !payload.receivedAt) {
        return null;
    }
    const text = payload.text?.trim();
    const subject = payload.subject?.trim();
    const attachment = payload.attachment?.uri
        ? {
            uri: payload.attachment.uri,
            mimeType: payload.attachment.mimeType?.trim() || 'application/octet-stream',
            fileName: payload.attachment.fileName?.trim() || 'shared-item',
            sizeBytes: payload.attachment.sizeBytes,
        }
        : undefined;

    if (!text && !subject && !attachment) {
        return null;
    }

    return {
        draftId: payload.draftId,
        receivedAt: payload.receivedAt,
        source: 'android-share-sheet',
        text: text || undefined,
        subject: subject || undefined,
        attachment,
    };
}

export async function enqueueSharedDraft(draft: SharedDraft): Promise<SharedDraft[]> {
    const current = await readDrafts();
    const withoutDuplicate = current.filter((item) => item.draftId !== draft.draftId);
    const next = [draft, ...withoutDuplicate].slice(0, SHARE_DRAFT_LIMIT);
    await writeDrafts(next);
    return next;
}

export async function consumeSharedDraft(draftId: string): Promise<SharedDraft | undefined> {
    const current = await readDrafts();
    const match = current.find((item) => item.draftId === draftId);
    if (!match) {
        return undefined;
    }
    await writeDrafts(current.filter((item) => item.draftId !== draftId));
    return match;
}

export async function dismissSharedDraft(draftId: string): Promise<SharedDraft[]> {
    const current = await readDrafts();
    const next = current.filter((item) => item.draftId !== draftId);
    await writeDrafts(next);
    return next;
}

export async function clearSharedDrafts(): Promise<SharedDraft[]> {
    const current = await readDrafts();
    await writeDrafts([]);
    return current;
}
