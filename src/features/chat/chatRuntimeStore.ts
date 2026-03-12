import { useSyncExternalStore } from 'react';
import type * as ImagePicker from 'expo-image-picker';
import type {
    ChatMemoryMode,
    ChatMode,
    ChatThinkingLevel,
    ChatToolRunRecord,
    ChatWebMode,
} from '../../api/types';

export interface QueuedChatMessage {
    id: string;
    content: string;
    image?: ImagePicker.ImagePickerAsset | null;
    mode: ChatMode;
    providerId?: string;
    model?: string;
    webMode?: ChatWebMode;
    memoryMode?: ChatMemoryMode;
    thinkingLevel?: ChatThinkingLevel;
    createdAt: string;
    priority?: boolean;
    /** P0-1: Tracks how many times this message has been re-queued due to busy errors. */
    _retryCount?: number;
}

export interface ChatSessionRuntimeSnapshot {
    activeRequestId?: string;
    activeRequestStartedAt?: string;
    activeDraftPreview?: string;
    streamingTurnId?: string;
    streamingContent: string;
    activeTools: ChatToolRunRecord[];
    queuedMessages: QueuedChatMessage[];
}

const EMPTY_SNAPSHOT: ChatSessionRuntimeSnapshot = {
    streamingContent: '',
    activeTools: [],
    queuedMessages: [],
};

const snapshots = new Map<string, ChatSessionRuntimeSnapshot>();
const abortHandlers = new Map<string, () => void>();
// P1-2: Partition listeners by session ID so writes to session A don't
// cause React re-renders in every mounted session B subscriber.
const sessionListeners = new Map<string, Set<() => void>>();
const globalListeners = new Set<() => void>();

function emitChange(sessionId?: string) {
    // Notify session-specific listeners
    if (sessionId) {
        const scoped = sessionListeners.get(sessionId);
        if (scoped) {
            for (const listener of scoped) {
                listener();
            }
        }
    }
    // Notify global listeners (e.g. components watching all sessions)
    for (const listener of globalListeners) {
        listener();
    }
}

function getSnapshotForSession(sessionId: string): ChatSessionRuntimeSnapshot {
    return snapshots.get(sessionId) ?? EMPTY_SNAPSHOT;
}

function writeSnapshot(
    sessionId: string,
    updater: (current: ChatSessionRuntimeSnapshot) => ChatSessionRuntimeSnapshot,
) {
    const next = updater(getSnapshotForSession(sessionId));
    snapshots.set(sessionId, next);
    emitChange(sessionId);
}

export function useChatSessionRuntime(sessionId?: string): ChatSessionRuntimeSnapshot {
    return useSyncExternalStore(
        (listener) => {
            if (sessionId) {
                let set = sessionListeners.get(sessionId);
                if (!set) {
                    set = new Set();
                    sessionListeners.set(sessionId, set);
                }
                set.add(listener);
                return () => {
                    set!.delete(listener);
                    if (set!.size === 0) sessionListeners.delete(sessionId);
                };
            }
            // No sessionId — subscribe globally
            globalListeners.add(listener);
            return () => globalListeners.delete(listener);
        },
        () => (sessionId ? getSnapshotForSession(sessionId) : EMPTY_SNAPSHOT),
        () => EMPTY_SNAPSHOT,
    );
}

export function markChatSessionActive(
    sessionId: string,
    input: { requestId: string; preview: string; startedAt: string },
) {
    writeSnapshot(sessionId, (current) => ({
        ...current,
        activeRequestId: input.requestId,
        activeRequestStartedAt: input.startedAt,
        activeDraftPreview: input.preview,
        streamingTurnId: undefined,
        streamingContent: '',
        activeTools: [],
    }));
}

export function clearChatSessionActivity(sessionId: string) {
    abortHandlers.delete(sessionId);
    writeSnapshot(sessionId, (current) => ({
        ...current,
        activeRequestId: undefined,
        activeRequestStartedAt: undefined,
        activeDraftPreview: undefined,
        streamingTurnId: undefined,
        streamingContent: '',
        activeTools: [],
    }));
}

export function setChatSessionAbortHandler(sessionId: string, abort?: () => void) {
    if (!abort) {
        abortHandlers.delete(sessionId);
        return;
    }
    abortHandlers.set(sessionId, abort);
}

export function abortChatSessionRequest(sessionId: string): boolean {
    const abort = abortHandlers.get(sessionId);
    if (!abort) {
        return false;
    }
    abort();
    abortHandlers.delete(sessionId);
    return true;
}

export function setChatSessionStreamingTurn(sessionId: string, turnId: string | null) {
    writeSnapshot(sessionId, (current) => ({
        ...current,
        streamingTurnId: turnId ?? undefined,
    }));
}

export function appendChatSessionStreamingDelta(sessionId: string, delta: string) {
    writeSnapshot(sessionId, (current) => ({
        ...current,
        streamingContent: `${current.streamingContent}${delta}`,
    }));
}

export function setChatSessionStreamingContent(sessionId: string, content: string) {
    writeSnapshot(sessionId, (current) => ({
        ...current,
        streamingContent: content,
    }));
}

export function setChatSessionActiveTools(sessionId: string, tools: ChatToolRunRecord[]) {
    writeSnapshot(sessionId, (current) => ({
        ...current,
        activeTools: [...tools],
    }));
}

export function queueChatSessionMessage(
    sessionId: string,
    message: QueuedChatMessage,
    options?: { front?: boolean },
) {
    writeSnapshot(sessionId, (current) => ({
        ...current,
        queuedMessages: options?.front
            ? [message, ...current.queuedMessages]
            : [...current.queuedMessages, message],
    }));
}

export function takeNextQueuedChatSessionMessage(sessionId: string): QueuedChatMessage | null {
    const current = getSnapshotForSession(sessionId);
    const [next, ...rest] = current.queuedMessages;
    if (!next) {
        return null;
    }
    snapshots.set(sessionId, {
        ...current,
        queuedMessages: rest,
    });
    emitChange(sessionId);
    return next;
}

export function removeQueuedChatSessionMessage(sessionId: string, messageId: string) {
    writeSnapshot(sessionId, (current) => ({
        ...current,
        queuedMessages: current.queuedMessages.filter((message) => message.id !== messageId),
    }));
}
