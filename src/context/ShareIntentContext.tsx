import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useToast } from './ToastContext';
import {
    type SharedDraft,
    clearSharedDrafts,
    consumeSharedDraft,
    dismissSharedDraft,
    enqueueSharedDraft,
    listSharedDrafts,
    normalizeNativeSharedDraft,
    pruneExpiredSharedDrafts,
} from '../features/phoneAssist/shareInbox';
import {
    getPendingNativeShareDraft,
    subscribeToNativeShareDrafts,
} from '../features/phoneAssist/shareNative';
import { appendPhoneAssistAuditEvent } from '../features/phoneAssist';

interface ShareIntentContextValue {
    pendingDrafts: SharedDraft[];
    refreshDrafts: () => Promise<void>;
    consumeDraft: (draftId: string) => Promise<SharedDraft | undefined>;
    dismissDraft: (draftId: string) => Promise<void>;
    clearDrafts: () => Promise<void>;
}

const ShareIntentContext = createContext<ShareIntentContextValue>({
    pendingDrafts: [],
    refreshDrafts: async () => {},
    consumeDraft: async () => undefined,
    dismissDraft: async () => {},
    clearDrafts: async () => {},
});

export function ShareIntentProvider({ children }: { children: React.ReactNode }) {
    const [pendingDrafts, setPendingDrafts] = useState<SharedDraft[]>([]);
    const { showToast } = useToast();

    const refreshDrafts = useCallback(async () => {
        const expired = await pruneExpiredSharedDrafts();
        if (expired.length > 0) {
            await Promise.all(expired.map((draft) => appendPhoneAssistAuditEvent({
                type: 'share_draft_expired',
                capability: 'share_intake',
                summary: 'Shared draft expired',
                detail: draft.subject || draft.text || draft.attachment?.fileName || draft.draftId,
                sensitivity: 'low',
            })));
        }
        setPendingDrafts(await listSharedDrafts());
    }, []);

    const ingestNativePayload = useCallback(async (payload: unknown, announce = false) => {
        const normalized = normalizeNativeSharedDraft(payload as any);
        if (!normalized) {
            return;
        }
        const next = await enqueueSharedDraft(normalized);
        setPendingDrafts(next);
        await appendPhoneAssistAuditEvent({
            type: 'share_draft_received',
            capability: 'share_intake',
            summary: 'Shared draft received',
            detail: normalized.subject || normalized.text || normalized.attachment?.fileName || normalized.draftId,
            sensitivity: 'low',
        });
        if (announce) {
            showToast({
                message: normalized.attachment
                    ? 'Shared item ready to review in Citadel chat'
                    : 'Shared text ready to review in Citadel chat',
                type: 'success',
            });
        }
    }, [showToast]);

    useEffect(() => {
        void (async () => {
            await refreshDrafts();
            const pendingNative = await getPendingNativeShareDraft();
            if (pendingNative) {
                await ingestNativePayload(pendingNative, true);
            }
        })();

        return subscribeToNativeShareDrafts((payload) => {
            void ingestNativePayload(payload, true);
        });
    }, [ingestNativePayload, refreshDrafts]);

    const consumeDraftAction = useCallback(async (draftId: string) => {
        const draft = await consumeSharedDraft(draftId);
        if (draft) {
            await appendPhoneAssistAuditEvent({
                type: 'share_draft_consumed',
                capability: 'share_intake',
                summary: 'Shared draft opened in chat',
                detail: draft.subject || draft.text || draft.attachment?.fileName || draft.draftId,
                sensitivity: 'low',
            });
        }
        await refreshDrafts();
        return draft;
    }, [refreshDrafts]);

    const dismissDraftAction = useCallback(async (draftId: string) => {
        const current = pendingDrafts.find((draft) => draft.draftId === draftId);
        await dismissSharedDraft(draftId);
        await appendPhoneAssistAuditEvent({
            type: 'share_draft_dismissed',
            capability: 'share_intake',
            summary: 'Shared draft dismissed',
            detail: current?.subject || current?.text || current?.attachment?.fileName || draftId,
            sensitivity: 'low',
        });
        await refreshDrafts();
    }, [pendingDrafts, refreshDrafts]);

    const clearDraftsAction = useCallback(async () => {
        const cleared = await clearSharedDrafts();
        if (cleared.length > 0) {
            await appendPhoneAssistAuditEvent({
                type: 'share_draft_dismissed',
                capability: 'share_intake',
                summary: 'Pending shared drafts cleared',
                detail: `${cleared.length} draft(s) removed from the local review queue.`,
                sensitivity: 'low',
            });
        }
        await refreshDrafts();
    }, [refreshDrafts]);

    const value = useMemo<ShareIntentContextValue>(() => ({
        pendingDrafts,
        refreshDrafts,
        consumeDraft: consumeDraftAction,
        dismissDraft: dismissDraftAction,
        clearDrafts: clearDraftsAction,
    }), [clearDraftsAction, consumeDraftAction, dismissDraftAction, pendingDrafts, refreshDrafts]);

    return (
        <ShareIntentContext.Provider value={value}>
            {children}
        </ShareIntentContext.Provider>
    );
}

export function useShareIntents() {
    return useContext(ShareIntentContext);
}
