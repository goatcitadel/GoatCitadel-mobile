/**
 * GoatCitadel Mobile — Chat Thread Screen
 * The centerpiece of the app — premium streaming chat with traces.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
    RefreshControl,
    AppState,
    ActivityIndicator,
    FlatList,
    Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import {
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    RecordingPresets,
    useAudioRecorder,
    useAudioRecorderState,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import { FlashList } from '@shopify/flash-list';
import { useToast } from '../../../src/context/ToastContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { AdaptiveContainer, ContextPane, MasterDetailShell } from '../../../src/components/layout';
import { colors, spacing, typography, radii } from '../../../src/theme/tokens';
import { TypingIndicator, SkeletonBlock } from '../../../src/components/ui';
import { useApiData } from '../../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../../src/hooks/useLayout';
import {
    cancelChatTurn,
    createChatSpecialistCandidate,
    fetchChatSpecialistCandidates,
    fetchChatSessions,
    fetchLlmModels,
    fetchChatThread,
    fetchChatPrefs,
    fetchRuntimeSettings,
    isGatewayAuthFailure,
    updateChatSpecialistCandidate,
    uploadChatAttachment,
} from '../../../src/api/client';
import { streamChatResponse } from '../../../src/api/streaming';
import type {
    ChatAttachmentRecord,
    ChatInputPart,
    ChatMemoryMode,
    ChatThinkingLevel,
    ChatTurnLifecycleStatus,
    ChatTurnTraceRecord,
    ChatThreadResponse,
    ChatThreadTurnRecord,
    ChatMode,
    ChatSpecialistCandidatePatchInput,
    ChatSpecialistCandidateRecord,
    ChatSpecialistCandidateSuggestionRecord,
    ChatSessionRecord,
    ChatToolRunRecord,
    ChatWebMode,
    LlmModelRecord,
    ProviderRecord,
} from '../../../src/api/types';
import {
    abortChatSessionRequest,
    appendChatSessionStreamingDelta,
    clearChatSessionActivity,
    markChatSessionActive,
    queueChatSessionMessage,
    removeQueuedChatSessionMessage,
    setChatSessionAbortHandler,
    setChatSessionActiveTools,
    setChatSessionStreamingContent,
    setChatSessionStreamingTurn,
    takeNextQueuedChatSessionMessage,
    useChatSessionRuntime,
    type QueuedChatMessage,
} from '../../../src/features/chat/chatRuntimeStore';
import { resolveCurrentLocationContext } from '../../../src/features/chat/mobileContext';
import { useGatewayAccess } from '../../../src/context/GatewayAccessContext';

export default function ChatThreadScreen() {
    const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
    const router = useRouter();
    const layout = useLayout();
    const flatListRef = useRef<any>(null);
    const { showToast } = useToast();
    const { shellState, refreshAccess, reportAuthExpired } = useGatewayAccess();

    const [composerText, setComposerText] = useState('');
    const [mode, setMode] = useState<ChatMode>('chat');
    const [showModeMenu, setShowModeMenu] = useState(false);
    const [showProviderPanel, setShowProviderPanel] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<string | undefined>();
    const [selectedModel, setSelectedModel] = useState<string | undefined>();
    const [providerPanelStage, setProviderPanelStage] = useState<'providers' | 'models'>('providers');
    const [providerPanelProviderId, setProviderPanelProviderId] = useState<string | undefined>();
    const [providerModelsByProvider, setProviderModelsByProvider] = useState<Record<string, LlmModelRecord[]>>({});
    const [providerModelsLoadingFor, setProviderModelsLoadingFor] = useState<string | undefined>();
    const [providerModelsError, setProviderModelsError] = useState<string | undefined>();
    const [webMode, setWebMode] = useState<ChatWebMode>('auto');
    const [memoryMode, setMemoryMode] = useState<ChatMemoryMode>('auto');
    const [thinkingLevel, setThinkingLevel] = useState<ChatThinkingLevel>('standard');
    const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [specialistActionTargetId, setSpecialistActionTargetId] = useState<string | null>(null);
    const runtime = useChatSessionRuntime(sessionId);
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(audioRecorder);

    const stopVoiceRecording = useCallback(async () => {
        try {
            if (recorderState.isRecording) {
                await audioRecorder.stop();
            }
        } finally {
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        }
    }, [audioRecorder, recorderState.isRecording]);

    // Clean up active recording on unmount to avoid leaked microphone state.
    useEffect(() => {
        return () => {
            if (recorderState.isRecording) {
                stopVoiceRecording().catch(() => {});
            }
        };
    }, [recorderState.isRecording, stopVoiceRecording]);

    const settings = useApiData(
        useCallback(() => fetchRuntimeSettings(), []),
    );
    const providerRecords = settings.data?.llm.providers ?? [];
    const activeProviderId = selectedProvider ?? settings.data?.llm.activeProviderId;
    const activeModelId = selectedModel ?? settings.data?.llm.activeModel;
    const providerPanelProvider = providerRecords.find((provider) => provider.providerId === providerPanelProviderId)
        ?? providerRecords.find((provider) => provider.providerId === activeProviderId);
    const providerModelOptions = React.useMemo(
        () => providerPanelProvider
            ? (providerModelsByProvider[providerPanelProvider.providerId]
                ?? normalizeProviderModels([], providerPanelProvider.defaultModel))
            : [],
        [providerModelsByProvider, providerPanelProvider],
    );

    const thread = useApiData<ChatThreadResponse>(
        useCallback(() => fetchChatThread(sessionId!), [sessionId]),
        { enabled: !!sessionId },
    );
    const sessionsState = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { enabled: layout.dualPane, pollMs: 10000 },
    );

    const specialistCandidatesState = useApiData<{ items: ChatSpecialistCandidateRecord[] }>(
        useCallback(() => fetchChatSpecialistCandidates(sessionId!), [sessionId]),
        { enabled: !!sessionId },
    );
    const reloadSpecialistCandidates = specialistCandidatesState.reload;
    const refreshSpecialistCandidates = specialistCandidatesState.refresh;

    // Hydrate session prefs from the backend so follow-ups match other surfaces.
    useEffect(() => {
        if (!sessionId) return;
        let cancelled = false;
        fetchChatPrefs(sessionId).then((prefs) => {
            if (cancelled) return;
            setMode(prefs.mode);
            if (prefs.providerId) setSelectedProvider(prefs.providerId);
            if (prefs.model) setSelectedModel(prefs.model);
            setWebMode(prefs.webMode);
            setMemoryMode(prefs.memoryMode);
            setThinkingLevel(prefs.thinkingLevel);
        }).catch(() => { /* prefs may not exist yet for new sessions */ });
        return () => { cancelled = true; };
    }, [sessionId]);

    const closeProviderPanel = useCallback(() => {
        setShowProviderPanel(false);
        setProviderPanelStage('providers');
        setProviderModelsError(undefined);
    }, []);

    const loadProviderModels = useCallback(async (provider: ProviderRecord) => {
        const cachedModels = providerModelsByProvider[provider.providerId];
        if (cachedModels?.length) {
            setProviderModelsError(undefined);
            return cachedModels;
        }

        setProviderModelsLoadingFor(provider.providerId);
        setProviderModelsError(undefined);
        try {
            const response = await fetchLlmModels(provider.providerId);
            const nextModels = normalizeProviderModels(response.items, provider.defaultModel);
            setProviderModelsByProvider((current) => ({
                ...current,
                [provider.providerId]: nextModels,
            }));
            return nextModels;
        } catch (error) {
            const fallbackModels = normalizeProviderModels([], provider.defaultModel);
            if (fallbackModels.length > 0) {
                setProviderModelsByProvider((current) => ({
                    ...current,
                    [provider.providerId]: fallbackModels,
                }));
            }
            setProviderModelsError((error as Error).message || 'The provider model list could not be loaded.');
            return fallbackModels;
        } finally {
            setProviderModelsLoadingFor((current) => current === provider.providerId ? undefined : current);
        }
    }, [providerModelsByProvider]);

    const openProviderPanel = useCallback(() => {
        setShowModeMenu(false);
        setProviderPanelStage('providers');
        setProviderPanelProviderId(activeProviderId);
        setProviderModelsError(undefined);
        setShowProviderPanel(true);
    }, [activeProviderId]);

    const handleProviderPress = useCallback((provider: ProviderRecord) => {
        setProviderPanelProviderId(provider.providerId);
        setProviderPanelStage('models');
        void loadProviderModels(provider);
    }, [loadProviderModels]);

    const handleModelPress = useCallback((provider: ProviderRecord, modelId: string) => {
        setSelectedProvider(provider.providerId);
        setSelectedModel(modelId);
        closeProviderPanel();
    }, [closeProviderPanel]);

    const turns = thread.data?.turns ?? [];
    const orderedSessions = useMemo(
        () => [...(sessionsState.data?.items ?? [])].sort(
            (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
        ),
        [sessionsState.data?.items],
    );
    const specialistCandidates = specialistCandidatesState.data?.items ?? [];
    const visibleSpecialistCandidates = React.useMemo(
        () => specialistCandidates.filter((item) => item.status !== 'retired'),
        [specialistCandidates],
    );
    const specialistSuggestionMap = React.useMemo(() => {
        const seen = new Set<string>();
        const ordered: ChatSpecialistCandidateSuggestionRecord[] = [];
        for (let index = turns.length - 1; index >= 0; index -= 1) {
            const turn = turns[index];
            for (const suggestion of turn.trace.specialistCandidateSuggestions ?? []) {
                if (seen.has(suggestion.candidateId)) {
                    continue;
                }
                seen.add(suggestion.candidateId);
                ordered.push(suggestion);
            }
        }
        return ordered;
    }, [turns]);
    const specialistCandidateById = React.useMemo(
        () => new Map(specialistCandidates.map((item) => [item.candidateId, item])),
        [specialistCandidates],
    );
    const shouldShowSpecialistPanel = specialistSuggestionMap.length > 0 || visibleSpecialistCandidates.length > 0;
    const activeTurn = turns.find((turn) => isActiveChatTurnStatus(turn.trace.status));
    const activeTurnId = runtime.streamingTurnId ?? activeTurn?.turnId;
    const isServerRunning = Boolean(activeTurn);
    const isStreaming = Boolean(runtime.activeRequestId);
    const isBusy = isStreaming || isServerRunning;
    const shouldPollThread = isServerRunning && !isStreaming;
    const streamingContent = runtime.streamingContent;
    const activeTools = runtime.activeTools;
    const canSubmitDraft = Boolean(composerText.trim() || selectedImage);
    const lastResumeRefreshRef = useRef(0);

    // Scroll to bottom on new content
    useEffect(() => {
        if (thread.data?.turns.length || streamingContent) {
            const timerId = setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
            return () => clearTimeout(timerId);
        }
    }, [thread.data?.turns.length, streamingContent]);

    useEffect(() => {
        if (!sessionId || !shouldPollThread) {
            return;
        }
        const interval = setInterval(() => {
            void thread.reload();
        }, 4000);
        return () => clearInterval(interval);
    }, [sessionId, shouldPollThread, thread.reload]);

    const stopLocalWait = useCallback(() => {
        if (!sessionId) {
            return false;
        }
        const aborted = abortChatSessionRequest(sessionId);
        if (aborted) {
            clearChatSessionActivity(sessionId);
            void thread.reload();
        }
        return aborted;
    }, [sessionId, thread.reload]);

    const requestServerCancel = useCallback(async (turnId?: string) => {
        if (!sessionId || !turnId) {
            return false;
        }
        try {
            await cancelChatTurn(sessionId, turnId, 'mobile-app');
            void thread.reload();
            return true;
        } catch (error) {
            console.warn('[chat] failed to cancel turn', error);
            return false;
        }
    }, [sessionId, thread.reload]);

    const executeQueuedMessage = useCallback(async (item: QueuedChatMessage) => {
        if (!sessionId) {
            return;
        }

        const requestId = item.id;
        let liveTools: ChatToolRunRecord[] = [];
        let settled = false;
        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            setChatSessionAbortHandler(sessionId, undefined);
            clearChatSessionActivity(sessionId);
            void thread.reload();
        };

        markChatSessionActive(sessionId, {
            requestId,
            preview: item.content,
            startedAt: new Date().toISOString(),
        });
        setChatSessionActiveTools(sessionId, liveTools);

        try {
            const uploadedAttachments = item.image
                ? [await uploadSelectedImage(sessionId, item.image)]
                : [];
            const locationContext = await resolveCurrentLocationContext(item.content);

            if (locationContext.status === 'permission-denied') {
                showToast({
                    message: 'Location permission was denied, so this request was sent without GPS context.',
                    type: 'warning',
                });
            } else if (locationContext.status === 'unavailable') {
                showToast({
                    message: 'Current location was unavailable, so this request was sent without GPS context.',
                    type: 'warning',
                });
            }

            const parts = buildOutgoingParts(
                item.content,
                uploadedAttachments,
                locationContext.status === 'attached' ? locationContext.context : undefined,
            );

            const abort = streamChatResponse(sessionId, item.content, {
                onMessageStart: (turnId) => {
                    if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setChatSessionStreamingTurn(sessionId, turnId);
                },
                onDelta: (delta) => {
                    appendChatSessionStreamingDelta(sessionId, delta);
                },
                onToolStart: (_turnId, chunk) => {
                    liveTools = [...liveTools, (chunk as any).toolRun];
                    setChatSessionActiveTools(sessionId, liveTools);
                },
                onToolResult: (_turnId, chunk) => {
                    liveTools = liveTools.map((tool) =>
                        tool.toolRunId === (chunk as any).toolRun.toolRunId ? (chunk as any).toolRun : tool,
                    );
                    setChatSessionActiveTools(sessionId, liveTools);
                },
                onMessageDone: (_turnId, _messageId, content) => {
                    setChatSessionStreamingContent(sessionId, content);
                    // P2-6: Haptic removed here — onDone already fires a success haptic.
                },
                onDone: () => {
                    if (Platform.OS !== 'web') {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                    finish();
                },
                onError: (error) => {
                    if (Platform.OS !== 'web') {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    }
                    if (isChatTurnBusyError(error)) {
                        const retryCount = (item._retryCount ?? 0) + 1;
                        const MAX_BUSY_RETRIES = 5;
                        if (retryCount > MAX_BUSY_RETRIES) {
                            finish();
                            showToast({
                                message: `Gave up after ${MAX_BUSY_RETRIES} retries — the server turn never cleared. Try again later.`,
                                type: 'error',
                            });
                            return;
                        }
                        // Exponential backoff: 2s, 4s, 8s, 16s, 32s to avoid hammering a busy gateway.
                        const backoffMs = Math.min(2000 * Math.pow(2, retryCount - 1), 32000);
                        const retryItem = { ...item, _retryCount: retryCount };
                        finish();
                        setTimeout(() => {
                            queueChatSessionMessage(sessionId, retryItem, { front: item.priority });
                        }, backoffMs);
                        showToast({
                            message: item.priority
                                ? 'Steer request is queued next and will run as soon as the current turn clears.'
                                : `That message is queued and will retry in ${backoffMs / 1000}s. (retry ${retryCount}/${MAX_BUSY_RETRIES})`,
                            type: 'info',
                        });
                        return;
                    }
                    finish();
                    console.warn('[chat] request failed', error);
                    if (isGatewayAuthFailure(new Error(error))) {
                        reportAuthExpired('Gateway access expired while this chat turn was running.');
                        router.push('/login');
                    }
                    showToast({
                        message: formatChatRequestError(error),
                        type: 'error',
                    });
                },
            }, {
                mode: item.mode,
                providerId: item.providerId,
                model: item.model,
                webMode: item.webMode,
                memoryMode: item.memoryMode,
                thinkingLevel: item.thinkingLevel,
                attachments: uploadedAttachments.map((attachment) => attachment.attachmentId),
                parts,
            });

            setChatSessionAbortHandler(sessionId, abort);
        } catch (error) {
            setChatSessionAbortHandler(sessionId, undefined);
            clearChatSessionActivity(sessionId);
            if (isGatewayAuthFailure(error)) {
                reportAuthExpired('Gateway access expired while preparing this message.');
                router.push('/login');
            }
            showToast({
                message: (error as Error).message || 'Failed to prepare this message.',
                type: 'error',
            });
        }
    }, [reportAuthExpired, router, sessionId, showToast, thread.reload]);

    const resumeForegroundWork = useCallback(() => {
        if (!sessionId) {
            return;
        }
        const now = Date.now();
        if (now - lastResumeRefreshRef.current < 1000) {
            return;
        }
        lastResumeRefreshRef.current = now;

        if (shellState.status !== 'ready' && shellState.status !== 'degraded-live-updates') {
            void refreshAccess({ preserveVisibleState: true });
        }
        void reloadSpecialistCandidates();
        if (isServerRunning || runtime.queuedMessages.length > 0) {
            void thread.reload();
        }
        if (!isBusy) {
            const nextMessage = takeNextQueuedChatSessionMessage(sessionId);
            if (nextMessage) {
                void executeQueuedMessage(nextMessage);
            }
        }
    }, [
        executeQueuedMessage,
        isBusy,
        isServerRunning,
        refreshAccess,
        reloadSpecialistCandidates,
        runtime.queuedMessages.length,
        sessionId,
        shellState.status,
        thread,
    ]);

    useFocusEffect(useCallback(() => {
        resumeForegroundWork();
    }, [resumeForegroundWork]));

    useEffect(() => {
        const appStateRef = { current: AppState.currentState };
        const subscription = AppState.addEventListener('change', (nextState) => {
            const previousState = appStateRef.current;
            appStateRef.current = nextState;
            if (previousState !== 'active' && nextState === 'active') {
                resumeForegroundWork();
            }
        });
        return () => subscription.remove();
    }, [resumeForegroundWork]);

    useEffect(() => {
        if (!sessionId || isBusy) {
            return;
        }
        const nextMessage = takeNextQueuedChatSessionMessage(sessionId);
        if (!nextMessage) {
            return;
        }
        void executeQueuedMessage(nextMessage);
    }, [executeQueuedMessage, isBusy, runtime.queuedMessages.length, sessionId]);

    const handleRefreshScreen = useCallback(async () => {
        await Promise.allSettled([
            thread.refresh(),
            refreshSpecialistCandidates(),
        ]);
    }, [refreshSpecialistCandidates, thread]);

    const handleCreateSpecialistDraft = useCallback(async (
        suggestion: ChatSpecialistCandidateSuggestionRecord,
    ) => {
        if (!sessionId || specialistActionTargetId) {
            return;
        }
        setSpecialistActionTargetId(suggestion.candidateId);
        try {
            const turnId = turns.find((turn) => (
                (turn.trace.specialistCandidateSuggestions ?? []).some((item) => item.candidateId === suggestion.candidateId)
            ))?.turnId;
            await createChatSpecialistCandidate(sessionId, {
                turnId,
                suggestion,
            });
            await reloadSpecialistCandidates();
            showToast({
                message: `Drafted specialist candidate: ${suggestion.title}.`,
                type: 'success',
            });
        } catch (error) {
            showToast({
                message: (error as Error).message || 'Failed to draft specialist candidate.',
                type: 'error',
            });
        } finally {
            setSpecialistActionTargetId(null);
        }
    }, [reloadSpecialistCandidates, sessionId, specialistActionTargetId, showToast, turns]);

    const handlePatchSpecialistCandidate = useCallback(async (
        candidateId: string,
        patch: ChatSpecialistCandidatePatchInput,
        successMessage: string,
    ) => {
        if (!sessionId || specialistActionTargetId) {
            return;
        }
        setSpecialistActionTargetId(candidateId);
        try {
            await updateChatSpecialistCandidate(sessionId, candidateId, patch);
            await reloadSpecialistCandidates();
            showToast({
                message: successMessage,
                type: 'success',
            });
        } catch (error) {
            showToast({
                message: (error as Error).message || 'Failed to update specialist candidate.',
                type: 'error',
            });
        } finally {
            setSpecialistActionTargetId(null);
        }
    }, [reloadSpecialistCandidates, sessionId, specialistActionTargetId, showToast]);

    const queueComposerMessage = useCallback((priority = false) => {
        if (!sessionId || !canSubmitDraft) {
            return;
        }

        if (Platform.OS !== 'web') {
            Haptics.impactAsync(priority ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
        }

        const nextMessage: QueuedChatMessage = {
            id: `queue-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            content: composerText.trim() || 'What is in this image?',
            image: selectedImage,
            mode,
            providerId: selectedProvider,
            model: selectedModel,
            webMode,
            memoryMode,
            thinkingLevel,
            createdAt: new Date().toISOString(),
            priority,
        };

        queueChatSessionMessage(sessionId, nextMessage, { front: priority });
        setComposerText('');
        setSelectedImage(null);

        if (priority) {
            const turnIdToCancel = activeTurnId;
            const stoppedLocally = stopLocalWait();
            void (async () => {
                const cancelledServer = await requestServerCancel(turnIdToCancel);
                if (cancelledServer) {
                    showToast({
                        message: 'Steer queued next. The active turn was cancelled and your new message moved to the front.',
                        type: 'info',
                    });
                    return;
                }
                if (stoppedLocally) {
                    showToast({
                        message: 'Steer queued next. The current mobile wait was stopped locally.',
                        type: 'info',
                    });
                    return;
                }
                if (isBusy) {
                    showToast({
                        message: 'Steer queued next. It will run as soon as the current turn clears.',
                        type: 'info',
                    });
                }
            })();
            return;
        }

        if (isBusy) {
            showToast({
                message: 'Message queued while the current turn finishes.',
                type: 'info',
            });
        }
    }, [
        canSubmitDraft,
        composerText,
        isBusy,
        memoryMode,
        mode,
        selectedImage,
        selectedModel,
        selectedProvider,
        sessionId,
        showToast,
        thinkingLevel,
        stopLocalWait,
        webMode,
    ]);

    const handleSend = useCallback(() => {
        queueComposerMessage(false);
    }, [queueComposerMessage]);

    const handleSteerNext = useCallback(() => {
        queueComposerMessage(true);
    }, [queueComposerMessage]);

    const handleStop = useCallback(() => {
        if (!sessionId) {
            return;
        }
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        }
        const turnIdToCancel = activeTurnId;
        const stopped = stopLocalWait();
        void (async () => {
            const cancelledServer = await requestServerCancel(turnIdToCancel);
            if (cancelledServer) {
                showToast({
                    message: 'Turn cancelled.',
                    type: 'info',
                });
                return;
            }
            if (stopped) {
                showToast({
                    message: 'Stream stopped. The server turn may still finish in the background.',
                    type: 'info',
                });
                return;
            }
            if (isServerRunning) {
                showToast({
                    message: 'This turn is still active on the server and could not be cancelled right now.',
                    type: 'warning',
                });
                return;
            }
            showToast({
                message: 'There is no active turn to stop.',
                type: 'warning',
            });
        })();
    }, [activeTurnId, isServerRunning, requestServerCancel, sessionId, showToast, stopLocalWait]);

    const handlePickImage = async () => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0]);
        }
    };

    const handleTakePhoto = async () => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            showToast({ message: 'Camera permission denied', type: 'warning' });
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0]);
        }
    };

    const toggleRecording = async () => {
        if (recorderState.isRecording) {
            try {
                await stopVoiceRecording();
                // Voice transcription requires local or remote whisper runtime.
                // Until wired to backend /api/voice/transcribe, just notify.
                showToast({ message: 'Voice recording stopped — transcription not yet connected', type: 'warning' });
                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch {
                showToast({ message: 'Mic recording could not stop cleanly', type: 'error' });
            }
        } else {
            try {
                const perm = await requestRecordingPermissionsAsync();
                if (!perm.granted) {
                    showToast({ message: 'Microphone permission denied', type: 'warning' });
                    return;
                }
                await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
                await audioRecorder.prepareToRecordAsync();
                audioRecorder.record();
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } catch {
                showToast({ message: 'Mic recording could not start', type: 'error' });
            }
        }
    };

    const renderTurn = ({ item }: { item: ChatThreadTurnRecord }) => (
        <MemoizedTurnCard turn={item} />
    );

    const insets = useSafeAreaInsets();
    const topPad = Math.max(insets.top, spacing.xl);
    const threadBottomPad = useBottomInsetPadding(20);
    const composerBottomPad = useBottomInsetPadding(
        Platform.OS === 'android' ? spacing.sm : spacing.lg,
    );
    const showInlineSpecialistPanel = shouldShowSpecialistPanel && !layout.triplePane;
    const showInlineQueueStatus = (isBusy || runtime.queuedMessages.length > 0) && !layout.triplePane;

    const sessionRail = (
        <ContextPane style={styles.sessionRailPane}>
            <Text style={styles.sessionRailTitle}>Recent sessions</Text>
            <FlatList
                data={orderedSessions}
                keyExtractor={(item) => item.sessionId}
                contentContainerStyle={styles.sessionRailList}
                renderItem={({ item }) => {
                    const selected = item.sessionId === sessionId;
                    return (
                        <Pressable
                            style={({ pressed }) => [
                                styles.sessionRailRow,
                                selected && styles.sessionRailRowSelected,
                                pressed && styles.sessionRailRowPressed,
                            ]}
                            onPress={() => router.replace(`/(tabs)/chat/${item.sessionId}`)}
                        >
                            <View style={styles.sessionRailIcon}>
                                <Ionicons
                                    name={item.scope === 'external' ? 'globe-outline' : 'chatbubble'}
                                    size={16}
                                    color={colors.cyan}
                                />
                            </View>
                            <View style={styles.sessionRailCopy}>
                                <Text style={styles.sessionRailLabel} numberOfLines={1}>
                                    {item.title || 'Untitled session'}
                                </Text>
                                <Text style={styles.sessionRailMeta} numberOfLines={1}>
                                    {(item.projectName ? `${item.projectName} · ` : '') + getRelativeTime(item.lastActivityAt)}
                                </Text>
                            </View>
                        </Pressable>
                    );
                }}
                ListEmptyComponent={sessionsState.loading ? null : (
                    <Text style={styles.sessionRailEmpty}>
                        {sessionsState.error || 'No other sessions yet.'}
                    </Text>
                )}
            />
        </ContextPane>
    );

    const inspectorPane = (
        <ContextPane style={styles.chatInspector}>
            <Text style={styles.sectionTitle}>SESSION CONTEXT</Text>
            <View style={styles.chatInspectorGrid}>
                <InspectorMeta label="Mode" value={mode.toUpperCase()} />
                <InspectorMeta label="Provider" value={activeProviderId || 'default'} />
                <InspectorMeta label="Model" value={activeModelId || 'default'} />
                <InspectorMeta label="Web" value={webMode.toUpperCase()} />
                <InspectorMeta label="Memory" value={memoryMode.toUpperCase()} />
                <InspectorMeta label="Thinking" value={thinkingLevel.toUpperCase()} />
            </View>
            {activeTools.length > 0 ? (
                <View style={styles.chatInspectorBlock}>
                    <Text style={styles.chatInspectorTitle}>Active tools</Text>
                    {activeTools.map((tool) => (
                        <View key={tool.toolRunId} style={styles.inspectorToolRow}>
                            <Ionicons
                                name={tool.status === 'executed' ? 'checkmark-circle' : 'sync'}
                                size={12}
                                color={tool.status === 'executed' ? colors.success : colors.cyan}
                            />
                            <Text style={styles.inspectorToolName}>{tool.toolName}</Text>
                        </View>
                    ))}
                </View>
            ) : null}
            {(isBusy || runtime.queuedMessages.length > 0) ? (
                <View style={styles.queueStatusCard}>
                    <View style={styles.queueStatusHeader}>
                        <View style={styles.queueStatusCopy}>
                            <Text style={styles.queueStatusTitle}>
                                {isBusy ? 'Assistant busy' : 'Queued messages ready'}
                            </Text>
                            <Text style={styles.queueStatusText}>
                                {isBusy
                                    ? 'Queue adds to the end, Steer Next moves to the front.'
                                    : 'Queued messages will send in order.'}
                            </Text>
                        </View>
                        {runtime.queuedMessages.length > 0 ? (
                            <View style={styles.queueCountBadge}>
                                <Text style={styles.queueCountText}>{runtime.queuedMessages.length}</Text>
                            </View>
                        ) : null}
                    </View>
                    {runtime.queuedMessages.slice(0, 3).map((message) => (
                        <View key={message.id} style={styles.queueItemRow}>
                            <View style={styles.queueItemCopy}>
                                <Text style={styles.queueItemText} numberOfLines={1}>
                                    {summarizeQueuedMessage(message)}
                                </Text>
                                {message.priority ? (
                                    <Text style={styles.queueItemTag}>STEER NEXT</Text>
                                ) : null}
                            </View>
                        </View>
                    ))}
                </View>
            ) : null}
            {shouldShowSpecialistPanel ? (
                <SpecialistPanel
                    suggestions={specialistSuggestionMap}
                    candidates={visibleSpecialistCandidates}
                    candidateById={specialistCandidateById}
                    activeActionId={specialistActionTargetId}
                    onCreateDraft={handleCreateSpecialistDraft}
                    onPatchCandidate={handlePatchSpecialistCandidate}
                />
            ) : null}
        </ContextPane>
    );

    return (
        <View style={styles.safe}>
            {/* Header Bar */}
            <BlurView intensity={25} tint="dark" style={[styles.headerBarBlur, { paddingTop: topPad }]}>
                <View style={styles.headerBar}>
                    <Pressable onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </Pressable>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {turns.length > 0 ? 'Chat' : 'New Session'}
                        </Text>
                        <Pressable onPress={() => setShowModeMenu(!showModeMenu)} style={styles.modePill}>
                            <View style={[styles.modeDot, { backgroundColor: modeColor(mode) }]} />
                            <Text style={styles.modeText}>{mode.toUpperCase()}</Text>
                            <Ionicons name="chevron-down" size={12} color={colors.textDim} />
                        </Pressable>
                    </View>
                    <Pressable onPress={openProviderPanel} style={styles.backBtn}>
                        <Ionicons name="options" size={20} color={colors.textMuted} />
                    </Pressable>
                </View>
            </BlurView>

            {/* Mode Selector Dropdown */}
            {showModeMenu ? (
                <View style={styles.modeMenu}>
                    {(['chat', 'cowork', 'code'] as ChatMode[]).map((m) => (
                        <Pressable
                            key={m}
                            style={[styles.modeMenuItem, m === mode && styles.modeMenuItemActive]}
                            onPress={() => {
                                setMode(m);
                                setShowModeMenu(false);
                            }}
                        >
                            <View style={[styles.modeDot, { backgroundColor: modeColor(m) }]} />
                            <View>
                                <Text style={styles.modeMenuLabel}>{m.toUpperCase()}</Text>
                                <Text style={styles.modeMenuDesc}>{modeDesc(m)}</Text>
                            </View>
                        </Pressable>
                    ))}
                </View>
            ) : null}

            {/* Provider/Model Panel */}
            {showProviderPanel ? (
                <Modal
                    visible
                    transparent
                    animationType="fade"
                    onRequestClose={closeProviderPanel}
                >
                    <View style={styles.providerModalRoot}>
                        <Pressable style={styles.providerModalBackdrop} onPress={closeProviderPanel} />
                        <View style={styles.providerModalCard}>
                            <View style={styles.providerModalHeader}>
                                <View style={styles.providerModalTitleWrap}>
                                    <Text style={styles.providerPanelTitle}>
                                        {providerPanelStage === 'providers' ? 'SELECT PROVIDER' : 'SELECT MODEL'}
                                    </Text>
                                    <Text style={styles.providerModalSubtitle}>
                                        {providerPanelStage === 'providers'
                                            ? 'Choose a provider first, then pick the model you want to use.'
                                            : providerPanelProvider
                                                ? `${providerPanelProvider.label} · current ${activeModelId || providerPanelProvider.defaultModel}`
                                                : 'Choose the model for this provider.'}
                                    </Text>
                                </View>
                                {providerPanelStage === 'models' ? (
                                    <Pressable
                                        onPress={() => {
                                            setProviderPanelStage('providers');
                                            setProviderModelsError(undefined);
                                        }}
                                        style={styles.providerStageAction}
                                    >
                                        <Ionicons name="chevron-back" size={18} color={colors.cyan} />
                                    </Pressable>
                                ) : null}
                            </View>

                            {providerPanelStage === 'providers' ? (
                                <FlatList
                                    data={providerRecords}
                                    keyExtractor={(item) => item.providerId}
                                    style={styles.providerList}
                                    contentContainerStyle={providerRecords.length === 0 ? styles.providerListEmpty : undefined}
                                    showsVerticalScrollIndicator
                                    renderItem={({ item }) => {
                                        const isActiveProvider = activeProviderId === item.providerId;
                                        return (
                                            <Pressable
                                                style={[styles.providerRow, isActiveProvider && styles.providerRowActive]}
                                                onPress={() => handleProviderPress(item)}
                                            >
                                                <View style={styles.providerDot} />
                                                <View style={styles.providerRowContent}>
                                                    <Text style={styles.providerLabel}>{item.label}</Text>
                                                    <Text style={styles.providerModel}>{item.defaultModel}</Text>
                                                </View>
                                                {isActiveProvider ? (
                                                    <Text style={styles.providerBadge}>CURRENT</Text>
                                                ) : (
                                                    <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                                                )}
                                            </Pressable>
                                        );
                                    }}
                                    ListEmptyComponent={
                                        <Text style={styles.providerEmpty}>
                                            No providers are configured on this gateway yet.
                                        </Text>
                                    }
                                />
                            ) : (
                                <View style={styles.providerListStage}>
                                    {providerModelsLoadingFor === providerPanelProvider?.providerId ? (
                                        <View style={styles.providerLoadingState}>
                                            <ActivityIndicator size="small" color={colors.cyan} />
                                            <Text style={styles.providerLoadingText}>Loading models…</Text>
                                        </View>
                                    ) : null}
                                    {providerModelsError ? (
                                        <Text style={styles.providerWarningText}>{providerModelsError}</Text>
                                    ) : null}
                                    <FlatList
                                        data={providerModelOptions}
                                        keyExtractor={(item) => item.id}
                                        style={styles.providerList}
                                        contentContainerStyle={providerModelOptions.length === 0 ? styles.providerListEmpty : undefined}
                                        showsVerticalScrollIndicator
                                        renderItem={({ item }) => {
                                            const isActiveModel = activeModelId === item.id;
                                            return (
                                                <Pressable
                                                    style={[styles.providerRow, isActiveModel && styles.providerRowActive]}
                                                    onPress={() => providerPanelProvider && handleModelPress(providerPanelProvider, item.id)}
                                                    disabled={!providerPanelProvider}
                                                >
                                                    <View style={[styles.providerDot, styles.providerModelDot]} />
                                                    <View style={styles.providerRowContent}>
                                                        <Text style={styles.providerLabel}>{item.id}</Text>
                                                        <Text style={styles.providerModel}>
                                                            {item.ownedBy?.trim() || 'Provider catalog'}
                                                        </Text>
                                                    </View>
                                                    {isActiveModel ? (
                                                        <Ionicons name="checkmark" size={16} color={colors.cyan} />
                                                    ) : null}
                                                </Pressable>
                                            );
                                        }}
                                        ListEmptyComponent={
                                            <Text style={styles.providerEmpty}>
                                                No models are available for this provider.
                                            </Text>
                                        }
                                    />
                                </View>
                            )}

                            <Pressable style={styles.providerDone} onPress={closeProviderPanel}>
                                <Text style={styles.providerDoneText}>CLOSE</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            ) : null}

            {/* Thread */}
            <AdaptiveContainer style={styles.workspaceContainer} padded={!layout.dualPane}>
                <MasterDetailShell
                    style={styles.flex}
                    master={sessionRail}
                    detail={(
                        <KeyboardAvoidingView
                            style={layout.dualPane ? styles.threadWorkspace : styles.flex}
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            keyboardVerticalOffset={0}
                        >
                <FlashList
                    ref={flatListRef}
                    data={turns}
                    keyExtractor={(t) => t.turnId}
                    renderItem={renderTurn}
                    contentContainerStyle={[styles.threadContent, { paddingBottom: threadBottomPad }]}
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    removeClippedSubviews={Platform.OS === 'android'}
                    refreshControl={
                        <RefreshControl
                            refreshing={thread.refreshing || specialistCandidatesState.refreshing}
                            onRefresh={handleRefreshScreen}
                            tintColor={colors.cyan}
                            colors={[colors.cyan]}
                            progressBackgroundColor={colors.bgCard}
                        />
                    }
                    ListEmptyComponent={
                        thread.loading ? (
                            <View style={styles.loadingState}>
                                <SkeletonBlock width="85%" height={40} style={{ marginBottom: 12, alignSelf: 'flex-end' }} />
                                <SkeletonBlock width="92%" height={80} style={{ marginBottom: 12 }} />
                                <SkeletonBlock width="70%" height={40} style={{ alignSelf: 'flex-end' }} />
                            </View>
                        ) : (
                            <View style={styles.emptyThread}>
                                <Ionicons name="chatbubble-ellipses-outline" size={56} color={colors.textDim} />
                                <Text style={styles.emptyThreadTitle}>Start a conversation</Text>
                                <Text style={styles.emptyThreadDesc}>
                                    Type a message below to begin a new GoatCitadel session.
                                </Text>
                            </View>
                        )
                    }
                    ListFooterComponent={
                        <>
                            {/* Active Tools */}
                            {activeTools.length > 0 ? (
                                <View style={styles.activeToolsBar}>
                                    {activeTools.map((tool) => (
                                        <View key={tool.toolRunId} style={styles.activeToolChip}>
                                            <Ionicons
                                                name={tool.status === 'executed' ? 'checkmark-circle' : 'sync'}
                                                size={12}
                                                color={tool.status === 'executed' ? colors.success : colors.cyan}
                                            />
                                            <Text style={styles.activeToolText}>{tool.toolName}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}

                            {/* Streaming Response */}
                            {streamingContent ? (
                                <View style={styles.streamingBubble}>
                                    <MarkdownContent content={streamingContent} />
                                    {isStreaming ? (
                                        <View style={styles.streamingDot} />
                                    ) : null}
                                </View>
                            ) : isBusy ? (
                                <View style={styles.thinkingBar}>
                                    <TypingIndicator />
                                    <Text style={styles.thinkingText}>
                                        {activeTurn ? describeTurnTraceStatus(activeTurn.trace) : 'Thinking…'}
                                    </Text>
                                </View>
                            ) : null}
                        </>
                    }
                />

                {/* Quick Prompts */}
                {(!isBusy && turns.length === 0) ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPrompts}>
                        {['What can you do?', 'Show my pending approvals', 'Analyze latest error logs', 'Summarize recent tasks'].map((p, i) => (
                            <Pressable key={i} style={styles.quickPromptChip} onPress={() => {
                                if (Platform.OS !== 'web') Haptics.selectionAsync();
                                setComposerText(p);
                            }}>
                                <Ionicons name="sparkles" size={14} color={colors.cyan} />
                                <Text style={styles.quickPromptText}>{p}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                ) : null}

                {showInlineSpecialistPanel ? (
                    <SpecialistPanel
                        suggestions={specialistSuggestionMap}
                        candidates={visibleSpecialistCandidates}
                        candidateById={specialistCandidateById}
                        activeActionId={specialistActionTargetId}
                        onCreateDraft={handleCreateSpecialistDraft}
                        onPatchCandidate={handlePatchSpecialistCandidate}
                    />
                ) : null}

                {/* Composer */}
                <View style={[styles.composerContainer, { paddingBottom: composerBottomPad }]}>
                    {showInlineQueueStatus ? (
                        <View style={styles.queueStatusCard}>
                            <View style={styles.queueStatusHeader}>
                                <View style={styles.queueStatusCopy}>
                                    <Text style={styles.queueStatusTitle}>
                                        {isBusy ? 'Assistant busy' : 'Queued messages ready'}
                                    </Text>
                                    <Text style={styles.queueStatusText}>
                                        {isBusy
                                            ? 'Keep typing. Queue adds to the end, Steer Next jumps to the front.'
                                            : 'Queued messages will send in order.'}
                                    </Text>
                                </View>
                                {runtime.queuedMessages.length > 0 ? (
                                    <View style={styles.queueCountBadge}>
                                        <Text style={styles.queueCountText}>{runtime.queuedMessages.length}</Text>
                                    </View>
                                ) : null}
                            </View>
                            {runtime.queuedMessages.slice(0, 3).map((message) => (
                                <View key={message.id} style={styles.queueItemRow}>
                                    <View style={styles.queueItemCopy}>
                                        <Text style={styles.queueItemText} numberOfLines={1}>
                                            {summarizeQueuedMessage(message)}
                                        </Text>
                                        {message.priority ? (
                                            <Text style={styles.queueItemTag}>STEER NEXT</Text>
                                        ) : null}
                                    </View>
                                    <Pressable
                                        style={styles.queueRemoveBtn}
                                        onPress={() => sessionId && removeQueuedChatSessionMessage(sessionId, message.id)}
                                    >
                                        <Ionicons name="close" size={14} color={colors.textDim} />
                                    </Pressable>
                                </View>
                            ))}
                        </View>
                    ) : null}
                    {selectedImage ? (
                        <View style={styles.composerAttachments}>
                            <View style={styles.imagePreviewWrapper}>
                                <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                                <Pressable style={styles.imagePreviewClose} onPress={() => setSelectedImage(null)}>
                                    <Ionicons name="close-circle" size={20} color={colors.bgCore} />
                                </Pressable>
                            </View>
                        </View>
                    ) : null}
                    <View style={styles.composer}>
                        <Pressable style={styles.attachBtn} onPress={handlePickImage}>
                            <Ionicons name="add-circle" size={24} color={colors.textDim} />
                        </Pressable>
                        <Pressable style={styles.attachBtn} onPress={handleTakePhoto}>
                            <Ionicons name="camera-outline" size={22} color={colors.textDim} />
                        </Pressable>
                        <TextInput
                            style={styles.composerInput}
                            placeholder={`Message (${mode} mode)…`}
                            placeholderTextColor={colors.textDim}
                            value={composerText}
                            onChangeText={setComposerText}
                            multiline
                            maxLength={32000}
                            onSubmitEditing={handleSend}
                            blurOnSubmit={false}
                        />
                        {isBusy && canSubmitDraft ? (
                            <View style={styles.composerActionButtons}>
                                <Pressable style={styles.steerBtn} onPress={handleSteerNext}>
                                    <Text style={styles.steerBtnText}>STEER NEXT</Text>
                                </Pressable>
                                <Pressable style={styles.queueBtn} onPress={handleSend}>
                                    <Text style={styles.queueBtnText}>QUEUE</Text>
                                </Pressable>
                            </View>
                        ) : isBusy ? (
                            <Pressable style={styles.stopBtn} onPress={handleStop}>
                                <Ionicons name="stop-circle" size={28} color={colors.crimson} />
                            </Pressable>
                        ) : canSubmitDraft ? (
                            <Pressable
                                style={styles.sendBtn}
                                onPress={handleSend}
                            >
                                <Ionicons
                                    name="send"
                                    size={20}
                                    color={colors.cyan}
                                />
                            </Pressable>
                        ) : (
                            <Pressable
                                style={[styles.sendBtn, recorderState.isRecording && styles.recordingActiveBtn]}
                                onPress={toggleRecording}
                            >
                                <Ionicons
                                    name={recorderState.isRecording ? "mic" : "mic-outline"}
                                    size={20}
                                    color={recorderState.isRecording ? colors.crimson : colors.textDim}
                                />
                            </Pressable>
                        )}
                    </View>
                </View>
                        </KeyboardAvoidingView>
                    )}
                    inspector={layout.triplePane ? inspectorPane : undefined}
                />
            </AdaptiveContainer>
        </View>
    );
}

function InspectorMeta({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.inspectorMeta}>
            <Text style={styles.inspectorMetaLabel}>{label}</Text>
            <Text style={styles.inspectorMetaValue} numberOfLines={2}>
                {value}
            </Text>
        </View>
    );
}

function getRelativeTime(value: string) {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) {
        return 'just now';
    }

    const deltaMs = Date.now() - timestamp;
    const deltaMinutes = Math.max(1, Math.round(deltaMs / 60000));

    if (deltaMinutes < 60) {
        return `${deltaMinutes}m ago`;
    }

    const deltaHours = Math.round(deltaMinutes / 60);
    if (deltaHours < 24) {
        return `${deltaHours}h ago`;
    }

    const deltaDays = Math.round(deltaHours / 24);
    return `${deltaDays}d ago`;
}

function SpecialistPanel({
    suggestions,
    candidates,
    candidateById,
    activeActionId,
    onCreateDraft,
    onPatchCandidate,
}: {
    suggestions: ChatSpecialistCandidateSuggestionRecord[];
    candidates: ChatSpecialistCandidateRecord[];
    candidateById: Map<string, ChatSpecialistCandidateRecord>;
    activeActionId: string | null;
    onCreateDraft: (suggestion: ChatSpecialistCandidateSuggestionRecord) => void;
    onPatchCandidate: (candidateId: string, patch: ChatSpecialistCandidatePatchInput, successMessage: string) => void;
}) {
    return (
        <View style={styles.specialistPanel}>
            {suggestions.length > 0 ? (
                <View style={styles.specialistPanelSection}>
                    <Text style={styles.specialistPanelTitle}>Suggested specialists</Text>
                    {suggestions.slice(0, 3).map((suggestion) => {
                        const existing = candidateById.get(suggestion.candidateId);
                        const busy = activeActionId === suggestion.candidateId;
                        return (
                            <View key={suggestion.candidateId} style={styles.specialistCard}>
                                <View style={styles.specialistCardHeader}>
                                    <View style={styles.specialistCardCopy}>
                                        <Text style={styles.specialistCardTitle}>{suggestion.title}</Text>
                                        <Text style={styles.specialistCardMeta}>
                                            {suggestion.role} · {formatSpecialistConfidence(suggestion.confidence)}
                                        </Text>
                                    </View>
                                    <View style={styles.specialistStatusBadge}>
                                        <Text style={styles.specialistStatusBadgeText}>
                                            {existing ? describeSpecialistStatus(existing.status) : 'new'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.specialistCardSummary}>{suggestion.summary}</Text>
                                <Text style={styles.specialistCardReason}>{suggestion.reason}</Text>
                                <View style={styles.specialistActionRow}>
                                    {existing ? (
                                        <Text style={styles.specialistInlineStatus}>
                                            Session candidate already exists.
                                        </Text>
                                    ) : (
                                        <Pressable
                                            style={[styles.specialistPrimaryBtn, busy && styles.specialistBtnDisabled]}
                                            disabled={busy}
                                            onPress={() => onCreateDraft(suggestion)}
                                        >
                                            <Text style={styles.specialistPrimaryBtnText}>
                                                {busy ? 'Drafting…' : 'Draft specialist'}
                                            </Text>
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>
            ) : null}

            {candidates.length > 0 ? (
                <View style={styles.specialistPanelSection}>
                    <Text style={styles.specialistPanelTitle}>Session specialists</Text>
                    {candidates.slice(0, 6).map((candidate) => {
                        const busy = activeActionId === candidate.candidateId;
                        return (
                            <View key={candidate.candidateId} style={styles.specialistCard}>
                                <View style={styles.specialistCardHeader}>
                                    <View style={styles.specialistCardCopy}>
                                        <Text style={styles.specialistCardTitle}>{candidate.title}</Text>
                                        <Text style={styles.specialistCardMeta}>
                                            {candidate.role} · {describeSpecialistRoutingMode(candidate.routingMode)}
                                        </Text>
                                    </View>
                                    <View style={styles.specialistStatusBadge}>
                                        <Text style={styles.specialistStatusBadgeText}>
                                            {describeSpecialistStatus(candidate.status)}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.specialistCardSummary}>{candidate.summary}</Text>
                                <Text style={styles.specialistCardReason}>{candidate.reason}</Text>
                                <View style={styles.specialistActionRow}>
                                    {(candidate.status === 'suggested' || candidate.status === 'drafted' || candidate.status === 'disabled') ? (
                                        <Pressable
                                            style={[styles.specialistSecondaryBtn, busy && styles.specialistBtnDisabled]}
                                            disabled={busy}
                                            onPress={() => onPatchCandidate(
                                                candidate.candidateId,
                                                { status: 'approved' },
                                                `Approved ${candidate.title}.`,
                                            )}
                                        >
                                            <Text style={styles.specialistSecondaryBtnText}>Approve</Text>
                                        </Pressable>
                                    ) : null}
                                    {(candidate.status !== 'active' || candidate.routingMode !== 'strong_match_only') ? (
                                        <Pressable
                                            style={[styles.specialistPrimaryBtn, busy && styles.specialistBtnDisabled]}
                                            disabled={busy}
                                            onPress={() => onPatchCandidate(
                                                candidate.candidateId,
                                                { status: 'active', routingMode: 'strong_match_only' },
                                                `Activated ${candidate.title} for strong auto-match.`,
                                            )}
                                        >
                                            <Text style={styles.specialistPrimaryBtnText}>Auto-match</Text>
                                        </Pressable>
                                    ) : null}
                                    {(candidate.status !== 'disabled' || candidate.routingMode !== 'disabled') ? (
                                        <Pressable
                                            style={[styles.specialistSecondaryBtn, busy && styles.specialistBtnDisabled]}
                                            disabled={busy}
                                            onPress={() => onPatchCandidate(
                                                candidate.candidateId,
                                                { status: 'disabled', routingMode: 'disabled' },
                                                `Disabled ${candidate.title}.`,
                                            )}
                                        >
                                            <Text style={styles.specialistSecondaryBtnText}>Disable</Text>
                                        </Pressable>
                                    ) : null}
                                    <Pressable
                                        style={[styles.specialistDangerBtn, busy && styles.specialistBtnDisabled]}
                                        disabled={busy}
                                        onPress={() => onPatchCandidate(
                                            candidate.candidateId,
                                            { status: 'retired', routingMode: 'disabled' },
                                            `Retired ${candidate.title}.`,
                                        )}
                                    >
                                        <Text style={styles.specialistDangerBtnText}>Retire</Text>
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })}
                </View>
            ) : null}
        </View>
    );
}

/** Single turn: user message + assistant response */
function TurnCard({ turn }: { turn: ChatThreadTurnRecord }) {
    const [traceExpanded, setTraceExpanded] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const { showToast } = useToast();
    const showTraceStatusBubble = shouldRenderTraceStatusBubble(turn.trace);
    const specialistSuggestionCount = turn.trace.specialistCandidateSuggestions?.length ?? 0;
    const routedSpecialistCount = turn.trace.orchestration?.routeDecision?.specialistCandidates?.length ?? 0;

    const handleCopy = async (text: string) => {
        await Clipboard.setStringAsync(text);
        showToast({ message: 'Message copied to clipboard', type: 'success', durationMs: 2000 });
    };

    const handleSpeak = async (text: string) => {
        if (isSpeaking) {
            Speech.stop();
            setIsSpeaking(false);
            return;
        }
        setIsSpeaking(true);
        Speech.speak(text, {
            onDone: () => setIsSpeaking(false),
            onStopped: () => setIsSpeaking(false),
            onError: () => {
                setIsSpeaking(false);
                showToast({ message: 'Speech engine error', type: 'error' });
            }
        });
    };

    return (
        <View style={styles.turnContainer}>
            {/* User Message */}
            <Pressable onLongPress={() => handleCopy(turn.userMessage.content)} style={styles.userBubble}>
                <Text style={styles.userText}>{turn.userMessage.content}</Text>
                {turn.userMessage.attachments?.length ? (
                    <View style={styles.attachmentRow}>
                        {turn.userMessage.attachments.map((a) => (
                            <View key={a.attachmentId} style={styles.attachmentChip}>
                                <Ionicons name="document-attach" size={12} color={colors.cyan} />
                                <Text style={styles.attachmentName} numberOfLines={1}>{a.fileName}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}
            </Pressable>

            {/* Assistant Message */}
            {turn.assistantMessage ? (
                <Pressable onLongPress={() => handleCopy(turn.assistantMessage!.content)} style={styles.assistantBubble}>
                    <MarkdownContent content={turn.assistantMessage.content} />

                    {/* Citations */}
                    {turn.citations.length > 0 ? (
                        <View style={styles.citationsBar}>
                            {turn.citations.slice(0, 3).map((c) => (
                                <View key={c.citationId} style={styles.citationChip}>
                                    <Ionicons name="link" size={10} color={colors.cyan} />
                                    <Text style={styles.citationText} numberOfLines={1}>
                                        {c.title || c.url}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : null}

                    {/* Actions / Trace Toggle */}
                    <View style={styles.assistantActionBar}>
                        {(turn.toolRuns.length > 0 || turn.trace.orchestration || specialistSuggestionCount > 0) ? (
                            <Pressable
                                style={styles.traceToggle}
                                onPress={() => setTraceExpanded(!traceExpanded)}
                            >
                                <Ionicons
                                    name={traceExpanded ? 'chevron-up' : 'chevron-down'}
                                    size={14}
                                    color={colors.textDim}
                                />
                                <Text style={styles.traceToggleText}>
                                    {turn.toolRuns.length > 0
                                        ? `${turn.toolRuns.length} tool${turn.toolRuns.length !== 1 ? 's' : ''}`
                                        : ''}
                                    {turn.trace.orchestration
                                        ? ` · ${turn.trace.orchestration.steps.length} orchestration steps`
                                        : ''}
                                    {routedSpecialistCount > 0
                                        ? ` · ${routedSpecialistCount} active specialist${routedSpecialistCount !== 1 ? 's' : ''}`
                                        : ''}
                                    {specialistSuggestionCount > 0
                                        ? ` · ${specialistSuggestionCount} specialist suggestion${specialistSuggestionCount !== 1 ? 's' : ''}`
                                        : ''}
                                </Text>
                                {turn.trace.routing.effectiveModel ? (
                                    <Text style={styles.traceModel}>{turn.trace.routing.effectiveModel}</Text>
                                ) : null}
                            </Pressable>
                        ) : <View style={{ flex: 1 }} />}

                        <Pressable style={styles.actionIconBtn} onPress={() => handleSpeak(turn.assistantMessage!.content)}>
                            <Ionicons name={isSpeaking ? "volume-mute" : "volume-medium"} size={16} color={isSpeaking ? colors.crimson : colors.textDim} />
                        </Pressable>
                    </View>

                    {/* Expanded Trace */}
                    {traceExpanded ? (
                        <View style={styles.traceContent}>
                            {turn.toolRuns.map((tool) => (
                                <ToolRunRow key={tool.toolRunId} tool={tool} />
                            ))}
                            {turn.trace.orchestration ? (
                                <View style={styles.orchSummary}>
                                    <Text style={styles.orchTitle}>
                                        Orchestration: {turn.trace.orchestration.objective}
                                    </Text>
                                    {routedSpecialistCount > 0 ? (
                                        <View style={styles.specialistTraceSection}>
                                            <Text style={styles.specialistTraceTitle}>Selected specialists</Text>
                                            {turn.trace.orchestration?.routeDecision?.specialistCandidates?.map((item) => (
                                                <View key={item.candidateId} style={styles.specialistTraceRow}>
                                                    <View style={styles.specialistTraceBadge}>
                                                        <Text style={styles.specialistTraceBadgeText}>{item.role}</Text>
                                                    </View>
                                                    <View style={styles.specialistTraceCopy}>
                                                        <Text style={styles.specialistTraceName}>{item.title}</Text>
                                                        <Text style={styles.specialistTraceMeta} numberOfLines={2}>
                                                            {item.matchReason}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}
                                    {turn.trace.orchestration.steps.map((step) => (
                                        <View key={step.stepId} style={styles.orchStep}>
                                            <View style={[styles.orchDot, { backgroundColor: stepColor(step.status) }]} />
                                            <Text style={styles.orchStepText}>
                                                {step.role} — {step.status}
                                                {step.durationMs ? ` (${step.durationMs}ms)` : ''}
                                                {step.specialistTitle ? ` · specialist: ${step.specialistTitle}` : ''}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                            {specialistSuggestionCount > 0 ? (
                                <View style={styles.specialistTraceSection}>
                                    <Text style={styles.specialistTraceTitle}>Specialist suggestions</Text>
                                    {turn.trace.specialistCandidateSuggestions?.map((item) => (
                                        <View key={item.candidateId} style={styles.specialistTraceRow}>
                                            <View style={styles.specialistTraceBadge}>
                                                <Text style={styles.specialistTraceBadgeText}>{item.role}</Text>
                                            </View>
                                            <View style={styles.specialistTraceCopy}>
                                                <Text style={styles.specialistTraceName}>{item.title}</Text>
                                                <Text style={styles.specialistTraceMeta} numberOfLines={2}>
                                                    {item.summary}
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                        </View>
                    ) : null}
                </Pressable>
            ) : showTraceStatusBubble ? (
                <View
                    style={[
                        styles.assistantBubble,
                        styles.traceStatusBubble,
                        turn.trace.status === 'failed' && styles.traceStatusBubbleFailed,
                        turn.trace.status === 'cancelled' && styles.traceStatusBubbleCancelled,
                    ]}
                >
                    <Text style={styles.traceStatusTitle}>{describeTurnTraceStatus(turn.trace)}</Text>
                    {turn.trace.failure?.message ? (
                        <Text style={styles.traceStatusMessage}>{turn.trace.failure.message}</Text>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

const MemoizedTurnCard = React.memo(TurnCard, (prev, next) => {
    return prev.turn.turnId === next.turn.turnId &&
        prev.turn.toolRuns.length === next.turn.toolRuns.length &&
        prev.turn.assistantMessage?.content === next.turn.assistantMessage?.content &&
        prev.turn.trace.status === next.turn.trace.status &&
        prev.turn.trace.failure?.message === next.turn.trace.failure?.message &&
        summarizeTraceSpecialistSuggestions(prev.turn.trace) === summarizeTraceSpecialistSuggestions(next.turn.trace) &&
        summarizeRoutedSpecialists(prev.turn.trace) === summarizeRoutedSpecialists(next.turn.trace) &&
        summarizeOrchestrationSpecialistSteps(prev.turn.trace) === summarizeOrchestrationSpecialistSteps(next.turn.trace);
});

function ToolRunRow({ tool }: { tool: ChatToolRunRecord }) {
    const statusIcon =
        tool.status === 'executed' ? 'checkmark-circle' :
            tool.status === 'failed' ? 'close-circle' :
                tool.status === 'blocked' ? 'ban' :
                    tool.status === 'approval_required' ? 'lock-closed' :
                        'sync';
    const statusColor =
        tool.status === 'executed' ? colors.success :
            tool.status === 'failed' ? colors.crimson :
                tool.status === 'blocked' ? colors.ember :
                    tool.status === 'approval_required' ? colors.ember :
                        colors.cyan;

    return (
        <View style={styles.toolRow}>
            <Ionicons name={statusIcon} size={14} color={statusColor} />
            <Text style={styles.toolName}>{tool.toolName}</Text>
            <Text style={styles.toolStatus}>{tool.status}</Text>
        </View>
    );
}

// P2-1: Hoisted markdown rules factory to avoid re-creating the rules object on every render.
function createMarkdownRules(onCopy: (text: string) => void) {
    return {
        fence: (node: any, _children: any, _parent: any, ruleStyles: any) => {
            return (
                <View key={node.key} style={ruleStyles.code_wrapper}>
                    <View style={ruleStyles.code_header}>
                        <Text style={ruleStyles.code_lang}>{node.sourceInfo || 'code'}</Text>
                        <Pressable style={ruleStyles.code_copy} onPress={() => onCopy(node.content)}>
                            <Ionicons name="copy-outline" size={14} color={colors.textDim} />
                            <Text style={ruleStyles.code_copy_text}>COPY</Text>
                        </Pressable>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ruleStyles.code_scroll}>
                        <Text style={ruleStyles.code_block}>{node.content}</Text>
                    </ScrollView>
                </View>
            );
        }
    };
}

function MarkdownContent({ content }: { content: string }) {
    const { showToast } = useToast();

    const handleCopy = useCallback(async (text: string) => {
        await Clipboard.setStringAsync(text);
        showToast({ message: 'Code copied', type: 'success' });
    }, [showToast]);

    const rules = React.useMemo(() => createMarkdownRules(handleCopy), [handleCopy]);

    return (
        <Markdown
            style={markdownStyles}
            rules={rules}
        >
            {content}
        </Markdown>
    );
}

function modeColor(m: ChatMode): string {
    return m === 'chat' ? colors.cyan : m === 'cowork' ? colors.ember : colors.success;
}

function modeDesc(m: ChatMode): string {
    return m === 'chat'
        ? 'Simple conversation flow'
        : m === 'cowork'
            ? 'Collaborative delegation'
            : 'Software-focused workflow';
}

function normalizeProviderModels(items: LlmModelRecord[], defaultModel?: string): LlmModelRecord[] {
    const normalized: LlmModelRecord[] = [];
    const seen = new Set<string>();

    const pushModel = (item: LlmModelRecord | null | undefined) => {
        const id = item?.id?.trim();
        if (!id || seen.has(id)) {
            return;
        }
        seen.add(id);
        normalized.push({
            id,
            ownedBy: item?.ownedBy,
            created: item?.created,
        });
    };

    for (const item of items) {
        pushModel(item);
    }
    if (defaultModel?.trim()) {
        pushModel({ id: defaultModel.trim() });
    }

    return normalized;
}

function isChatTurnBusyError(error: string): boolean {
    return /already (?:in progress|being generated|running)|wait for the current|turn is (?:still )?(?:active|running)|busy|concurrent.*turn/i.test(error);
}

function formatChatRequestError(error: string): string {
    const normalized = error.toLowerCase();
    if (normalized.includes('timed out') || normalized.includes('timeout=')) {
        return 'The chat request timed out. The assistant may still finish in the background, so pull to refresh in a few seconds.';
    }
    if (normalized.includes('network error')) {
        return 'The app lost contact with the gateway while this message was running. Check the connection and try again.';
    }
    if (normalized.includes('stream error 401') || normalized.includes('stream error 403') || normalized.includes('credentials are required')) {
        return 'The gateway rejected this chat request. Reconnect or refresh your device access, then try again.';
    }
    return error || 'Chat request failed.';
}

function summarizeQueuedMessage(message: QueuedChatMessage): string {
    const normalized = message.content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 56) {
        return normalized;
    }
    return `${normalized.slice(0, 53)}...`;
}

function formatSpecialistConfidence(confidence: number): string {
    return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}% confidence`;
}

function describeSpecialistStatus(status: ChatSpecialistCandidateRecord['status']): string {
    return status.replace(/_/g, ' ');
}

function describeSpecialistRoutingMode(mode: ChatSpecialistCandidateRecord['routingMode']): string {
    switch (mode) {
        case 'disabled':
            return 'Routing disabled';
        case 'manual_only':
            return 'Manual only';
        case 'strong_match_only':
            return 'Strong auto-match';
        default:
            return mode;
    }
}

function summarizeOrchestrationSpecialistSteps(trace: ChatTurnTraceRecord): string {
    return trace.orchestration?.steps
        .map((step) => `${step.stepId}:${step.status}:${step.specialistCandidateId ?? ''}:${step.specialistTitle ?? ''}`)
        .join('|') ?? '';
}

function summarizeTraceSpecialistSuggestions(trace: ChatTurnTraceRecord): string {
    return trace.specialistCandidateSuggestions
        ?.map((item) => `${item.candidateId}:${item.title}:${item.role}:${item.summary}`)
        .join('|') ?? '';
}

function summarizeRoutedSpecialists(trace: ChatTurnTraceRecord): string {
    return trace.orchestration?.routeDecision?.specialistCandidates
        ?.map((item) => `${item.candidateId}:${item.title}:${item.role}:${item.matchReason}`)
        .join('|') ?? '';
}

async function uploadSelectedImage(
    sessionId: string,
    asset: ImagePicker.ImagePickerAsset,
): Promise<ChatAttachmentRecord> {
    const bytesBase64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
    });
    return uploadChatAttachment({
        sessionId,
        fileName: resolveAttachmentFileName(asset),
        mimeType: asset.mimeType || 'image/jpeg',
        bytesBase64,
    });
}

function buildOutgoingParts(
    content: string,
    attachments: ChatAttachmentRecord[],
    locationContext?: string,
): ChatInputPart[] | undefined {
    if (!locationContext && attachments.length === 0) {
        return undefined;
    }

    const parts: ChatInputPart[] = [{ type: 'text', text: content }];
    if (locationContext) {
        parts.push({
            type: 'text',
            text: locationContext,
        });
    }
    for (const attachment of attachments) {
        parts.push({
            type: attachment.mimeType.startsWith('image/') ? 'image_ref' : 'file_ref',
            attachmentId: attachment.attachmentId,
            mimeType: attachment.mimeType,
        });
    }
    return parts;
}

function resolveAttachmentFileName(asset: ImagePicker.ImagePickerAsset): string {
    if (asset.fileName?.trim()) {
        return asset.fileName;
    }
    const fromUri = asset.uri.split('/').pop()?.trim();
    if (fromUri) {
        return fromUri;
    }
    return `mobile-image-${Date.now()}.jpg`;
}

function stepColor(status: string): string {
    return status === 'completed' ? colors.success :
        ['queued', 'running', 'waiting_for_tool', 'waiting_for_approval'].includes(status) ? colors.cyan :
            status === 'cancelled' ? colors.textMuted :
            status === 'failed' ? colors.crimson :
                colors.textDim;
}

function isActiveChatTurnStatus(status: ChatTurnLifecycleStatus): boolean {
    return status === 'queued'
        || status === 'running'
        || status === 'waiting_for_tool'
        || status === 'waiting_for_approval';
}

function shouldRenderTraceStatusBubble(trace: ChatTurnTraceRecord): boolean {
    return trace.status === 'waiting_for_approval'
        || trace.status === 'failed'
        || trace.status === 'cancelled';
}

function describeTurnTraceStatus(trace?: ChatTurnTraceRecord): string {
    if (!trace) {
        return 'Thinking…';
    }
    switch (trace.status) {
        case 'queued':
            return 'Queued…';
        case 'running':
            return 'Thinking…';
        case 'waiting_for_tool':
            return 'Using tools…';
        case 'waiting_for_approval':
            return 'Awaiting approval';
        case 'completed':
            return 'Completed';
        case 'failed':
            return trace.failure?.message || 'This turn failed.';
        case 'cancelled':
            return 'This turn was cancelled.';
        default:
            return 'Thinking…';
    }
}

const markdownStyles = StyleSheet.create({
    body: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    heading1: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 12, marginBottom: 6 },
    heading2: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 10, marginBottom: 4 },
    heading3: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 8, marginBottom: 4 },
    strong: { color: colors.textPrimary, fontWeight: '700' },
    em: { fontStyle: 'italic' },
    code_inline: {
        backgroundColor: colors.bgInset,
        color: colors.cyan,
        fontFamily: 'monospace',
        fontSize: 12,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    code_wrapper: {
        backgroundColor: colors.bgShell,
        borderRadius: radii.md,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        overflow: 'hidden',
    },
    code_header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bgInset,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    code_lang: { ...typography.caption, color: colors.textDim, textTransform: 'uppercase' },
    code_copy: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 4 },
    code_copy_text: { ...typography.caption, color: colors.textDim },
    code_scroll: { padding: spacing.sm },
    code_block: {
        color: colors.textSecondary,
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 18,
    },
    blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: colors.cyan,
        paddingLeft: 10,
        marginVertical: 6,
        opacity: 0.85,
    },
    link: { color: colors.cyan, textDecorationLine: 'underline' },
    list_item: { marginVertical: 2 },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    table: { borderWidth: 1, borderColor: colors.borderQuiet, borderRadius: 4, marginVertical: 6 },
    thead: { backgroundColor: colors.bgInset },
    th: { color: colors.textPrimary, fontWeight: '700', padding: 6 },
    td: { color: colors.textSecondary, padding: 6 },
    tr: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderQuiet },
    hr: { backgroundColor: colors.borderQuiet, height: StyleSheet.hairlineWidth, marginVertical: 10 },
});

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    flex: { flex: 1 },

    // Header
    headerBarBlur: {
        paddingTop: Platform.OS === 'android' ? 24 : 48,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderCyan,
        zIndex: 10,
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    backBtn: { padding: spacing.sm, width: 40 },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: {
        ...typography.displaySm,
        color: colors.textPrimary,
        textTransform: 'uppercase',
    },
    modePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        backgroundColor: colors.bgInset,
        borderWidth: 1,
        borderColor: colors.borderCyan,
        marginTop: 2,
    },
    modeDot: { width: 6, height: 6, borderRadius: 3 },
    modeText: { ...typography.caption, color: colors.textMuted, letterSpacing: 1 },

    // Mode Menu
    modeMenu: {
        position: 'absolute',
        top: 90,
        left: 60,
        right: 60,
        backgroundColor: colors.bgCardElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        padding: spacing.sm,
        zIndex: 100,
        elevation: 10,
    },
    modeMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.sm,
    },
    modeMenuItemActive: { backgroundColor: colors.cyanMuted },
    modeMenuLabel: { ...typography.eyebrow, color: colors.textPrimary, fontSize: 11 },
    modeMenuDesc: { ...typography.caption, color: colors.textDim },

    // Provider Panel
    providerModalRoot: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    providerModalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(5, 8, 14, 0.72)',
    },
    providerModalCard: {
        maxHeight: '72%',
        backgroundColor: colors.bgCardElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        padding: spacing.md,
        zIndex: 100,
        elevation: 10,
    },
    providerModalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    providerModalTitleWrap: {
        flex: 1,
        gap: 4,
    },
    providerPanelTitle: { ...typography.eyebrow, color: colors.textMuted },
    providerModalSubtitle: {
        ...typography.caption,
        color: colors.textDim,
        lineHeight: 18,
    },
    providerStageAction: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgCard,
    },
    providerListStage: {
        flex: 1,
        minHeight: 220,
    },
    providerList: {
        flexGrow: 0,
    },
    providerListEmpty: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    providerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.sm,
        marginBottom: spacing.xs,
    },
    providerRowActive: { backgroundColor: colors.cyanMuted },
    providerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    providerModelDot: { backgroundColor: colors.cyan },
    providerRowContent: { flex: 1, gap: 2 },
    providerLabel: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
    providerModel: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },
    providerEmpty: { ...typography.bodySm, color: colors.textDim, fontStyle: 'italic', paddingVertical: spacing.sm },
    providerBadge: {
        ...typography.eyebrow,
        color: colors.cyan,
        fontSize: 9,
    },
    providerLoadingState: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingBottom: spacing.sm,
    },
    providerLoadingText: {
        ...typography.caption,
        color: colors.textDim,
    },
    providerWarningText: {
        ...typography.caption,
        color: colors.ember,
        paddingHorizontal: spacing.sm,
        paddingBottom: spacing.sm,
        lineHeight: 18,
    },
    providerDone: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
        marginTop: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.borderQuiet,
    },
    providerDoneText: { ...typography.eyebrow, color: colors.cyan },

    // Thread
    threadContent: { paddingVertical: spacing.md, paddingBottom: 20 },
    loadingState: { paddingTop: 100, alignItems: 'center' },
    emptyThread: { alignItems: 'center', paddingTop: 100, gap: spacing.md },
    emptyThreadTitle: { ...typography.displayMd, color: colors.textPrimary },
    emptyThreadDesc: { ...typography.bodyMd, color: colors.textDim, textAlign: 'center', maxWidth: 280 },

    turnContainer: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },

    // User Bubble
    userBubble: {
        alignSelf: 'flex-end',
        maxWidth: '85%',
        backgroundColor: 'rgba(84, 221, 255, 0.12)',
        borderRadius: radii.lg,
        borderBottomRightRadius: radii.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.cyanMuted,
    },
    userText: { ...typography.bodyMd, color: colors.textPrimary },
    attachmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
    attachmentChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    attachmentName: { ...typography.caption, color: colors.textMuted, maxWidth: 100 },

    // Assistant Bubble
    assistantBubble: {
        alignSelf: 'flex-start',
        maxWidth: '92%',
        backgroundColor: colors.bgCard,
        borderRadius: radii.lg,
        borderBottomLeftRadius: radii.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderCyan,
    },
    traceStatusBubble: {
        backgroundColor: colors.bgInset,
        borderColor: colors.borderQuiet,
    },
    traceStatusBubbleFailed: {
        borderColor: colors.crimson,
        backgroundColor: 'rgba(255, 86, 120, 0.08)',
    },
    traceStatusBubbleCancelled: {
        borderColor: colors.borderQuiet,
        backgroundColor: colors.bgInset,
    },
    traceStatusTitle: {
        ...typography.bodySm,
        color: colors.textPrimary,
        fontWeight: '700',
    },
    traceStatusMessage: {
        ...typography.bodySm,
        color: colors.textDim,
        marginTop: spacing.xs,
    },
    assistantActionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.05)',
        paddingTop: spacing.sm,
    },
    actionIconBtn: {
        padding: spacing.xs,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
    },

    // Citations
    citationsBar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.borderQuiet,
    },
    citationChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    citationText: { ...typography.caption, color: colors.cyan, maxWidth: 120 },

    // Trace
    traceToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.borderQuiet,
    },
    traceToggleText: { ...typography.caption, color: colors.textDim },
    traceModel: { ...typography.caption, color: colors.cyan, opacity: 0.6, marginLeft: 'auto' },
    traceContent: {
        marginTop: spacing.sm,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        padding: spacing.sm,
    },
    toolRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 3,
    },
    toolName: { ...typography.bodySm, color: colors.textSecondary, fontFamily: 'monospace', fontSize: 11 },
    toolStatus: { ...typography.caption, color: colors.textDim, marginLeft: 'auto' },

    // Orchestration
    orchSummary: { marginTop: spacing.sm },
    orchTitle: { ...typography.bodySm, color: colors.textMuted, fontWeight: '600', marginBottom: 4 },
    orchStep: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
    orchDot: { width: 6, height: 6, borderRadius: 3 },
    orchStepText: { ...typography.caption, color: colors.textDim },
    specialistTraceSection: {
        marginTop: spacing.sm,
        gap: spacing.xs,
    },
    specialistTraceTitle: {
        ...typography.bodySm,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    specialistTraceRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        paddingVertical: 2,
    },
    specialistTraceBadge: {
        backgroundColor: 'rgba(84, 221, 255, 0.12)',
        borderRadius: radii.pill,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: colors.borderCyan,
    },
    specialistTraceBadgeText: {
        ...typography.caption,
        color: colors.cyan,
        fontWeight: '700',
    },
    specialistTraceCopy: {
        flex: 1,
        gap: 2,
    },
    specialistTraceName: {
        ...typography.bodySm,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    specialistTraceMeta: {
        ...typography.caption,
        color: colors.textDim,
    },

    // Streaming
    streamingBubble: {
        alignSelf: 'flex-start',
        maxWidth: '92%',
        backgroundColor: colors.bgCard,
        borderRadius: radii.lg,
        borderBottomLeftRadius: radii.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginHorizontal: spacing.lg,
        borderWidth: 1,
        borderColor: colors.borderLive,
    },
    streamingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.cyan,
        marginTop: spacing.sm,
        opacity: 0.6,
    },
    thinkingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
    },
    thinkingText: { ...typography.bodySm, color: colors.textDim },
    activeToolsBar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
    },
    activeToolChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.bgInset,
        borderRadius: radii.pill,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: colors.borderCyan,
    },
    activeToolText: { ...typography.caption, color: colors.textMuted, fontFamily: 'monospace', fontSize: 10 },
    workspaceContainer: {
        flex: 1,
        paddingBottom: 0,
    },
    threadWorkspace: {
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        backgroundColor: colors.bgCore,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
    },
    sessionRailPane: {
        flex: 1,
        gap: spacing.md,
        padding: spacing.lg,
    },
    sessionRailTitle: {
        ...typography.eyebrow,
        color: colors.textPrimary,
    },
    sessionRailList: {
        gap: spacing.xs,
    },
    sessionRailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    sessionRailRowSelected: {
        backgroundColor: colors.cyanMuted,
        borderColor: colors.borderCyan,
    },
    sessionRailRowPressed: {
        opacity: 0.84,
    },
    sessionRailIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgInset,
    },
    sessionRailCopy: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    sessionRailLabel: {
        ...typography.bodySm,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    sessionRailMeta: {
        ...typography.caption,
        color: colors.textDim,
    },
    sessionRailEmpty: {
        ...typography.bodySm,
        color: colors.textDim,
        paddingTop: spacing.lg,
    },
    sectionTitle: {
        ...typography.eyebrow,
        color: colors.textPrimary,
    },
    chatInspector: {
        gap: spacing.lg,
    },
    chatInspectorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    inspectorMeta: {
        minWidth: 120,
        flexGrow: 1,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        gap: 2,
    },
    inspectorMetaLabel: {
        ...typography.caption,
        color: colors.textDim,
        textTransform: 'uppercase',
    },
    inspectorMetaValue: {
        ...typography.bodySm,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    chatInspectorBlock: {
        gap: spacing.sm,
    },
    chatInspectorTitle: {
        ...typography.eyebrow,
        color: colors.textPrimary,
    },
    inspectorToolRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    inspectorToolName: {
        ...typography.bodySm,
        color: colors.textSecondary,
        flex: 1,
    },

    // Composer
    composerContainer: {
        backgroundColor: colors.bgShell,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        paddingBottom: Platform.OS === 'android' ? spacing.sm : spacing.lg,
    },
    queueStatusCard: {
        backgroundColor: colors.bgInset,
        borderWidth: 1,
        borderColor: colors.borderCyan,
        borderRadius: radii.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginBottom: spacing.sm,
        gap: spacing.xs,
    },
    queueStatusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    queueStatusCopy: { flex: 1 },
    queueStatusTitle: {
        ...typography.eyebrow,
        color: colors.textPrimary,
    },
    queueStatusText: {
        ...typography.caption,
        color: colors.textDim,
    },
    queueCountBadge: {
        minWidth: 24,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.pill,
        backgroundColor: 'rgba(84, 221, 255, 0.12)',
        borderWidth: 1,
        borderColor: colors.borderCyan,
        alignItems: 'center',
    },
    queueCountText: {
        ...typography.caption,
        color: colors.cyan,
        fontWeight: '700',
    },
    queueItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingTop: 2,
    },
    queueItemCopy: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    queueItemText: {
        ...typography.bodySm,
        color: colors.textSecondary,
        flex: 1,
    },
    queueItemTag: {
        ...typography.caption,
        color: colors.cyan,
        fontWeight: '700',
    },
    queueRemoveBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgCard,
    },
    quickPrompts: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        backgroundColor: colors.bgShell,
    },
    quickPromptChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.bgInset,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.borderCyan,
    },
    quickPromptText: { ...typography.bodySm, color: colors.cyan },
    specialistPanel: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        gap: spacing.sm,
        backgroundColor: colors.bgShell,
    },
    specialistPanelSection: {
        backgroundColor: colors.bgInset,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        padding: spacing.md,
        gap: spacing.sm,
    },
    specialistPanelTitle: {
        ...typography.eyebrow,
        color: colors.textPrimary,
    },
    specialistCard: {
        backgroundColor: colors.bgCard,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderCyan,
        padding: spacing.md,
        gap: spacing.xs,
    },
    specialistCardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    specialistCardCopy: {
        flex: 1,
        gap: 2,
    },
    specialistCardTitle: {
        ...typography.bodyMd,
        color: colors.textPrimary,
        fontWeight: '700',
    },
    specialistCardMeta: {
        ...typography.caption,
        color: colors.cyan,
    },
    specialistCardSummary: {
        ...typography.bodySm,
        color: colors.textSecondary,
    },
    specialistCardReason: {
        ...typography.caption,
        color: colors.textDim,
    },
    specialistStatusBadge: {
        borderRadius: radii.pill,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: colors.bgShell,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
    },
    specialistStatusBadgeText: {
        ...typography.caption,
        color: colors.textMuted,
        textTransform: 'uppercase',
    },
    specialistActionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: spacing.xs,
    },
    specialistInlineStatus: {
        ...typography.caption,
        color: colors.textDim,
    },
    specialistPrimaryBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        backgroundColor: 'rgba(84, 221, 255, 0.12)',
        borderWidth: 1,
        borderColor: colors.borderCyan,
    },
    specialistPrimaryBtnText: {
        ...typography.caption,
        color: colors.cyan,
        fontWeight: '700',
    },
    specialistSecondaryBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        backgroundColor: colors.bgShell,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
    },
    specialistSecondaryBtnText: {
        ...typography.caption,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    specialistDangerBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        backgroundColor: 'rgba(255, 86, 120, 0.08)',
        borderWidth: 1,
        borderColor: colors.crimson,
    },
    specialistDangerBtnText: {
        ...typography.caption,
        color: colors.crimson,
        fontWeight: '700',
    },
    specialistBtnDisabled: {
        opacity: 0.5,
    },
    composer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: colors.bgInput,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderCyan,
        paddingVertical: spacing.xs,
        paddingRight: spacing.md,
        paddingLeft: spacing.xs,
        minHeight: 44,
        maxHeight: 120,
    },
    composerActionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginLeft: spacing.xs,
        marginBottom: Platform.OS === 'android' ? 2 : 5,
    },
    attachBtn: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        marginBottom: Platform.OS === 'android' ? 2 : 5,
    },
    composerInput: {
        flex: 1,
        color: colors.textPrimary,
        ...typography.bodyMd,
        paddingVertical: Platform.OS === 'android' ? spacing.sm : spacing.sm,
        maxHeight: 100,
    },
    composerAttachments: {
        flexDirection: 'row',
        paddingHorizontal: spacing.sm,
        paddingBottom: spacing.sm,
    },
    imagePreviewWrapper: {
        position: 'relative',
        width: 60, height: 60,
        borderRadius: radii.sm,
        overflow: 'hidden',
    },
    imagePreview: {
        width: '100%', height: '100%',
        resizeMode: 'cover',
    },
    imagePreviewClose: {
        position: 'absolute',
        top: 2, right: 2,
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: 10,
    },
    sendBtn: {
        padding: spacing.sm,
        marginLeft: spacing.xs,
    },
    queueBtn: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: colors.bgInset,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
    },
    queueBtnText: {
        ...typography.caption,
        color: colors.textPrimary,
        fontWeight: '700',
    },
    steerBtn: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: 'rgba(84, 221, 255, 0.12)',
        borderWidth: 1,
        borderColor: colors.borderCyan,
    },
    steerBtnText: {
        ...typography.caption,
        color: colors.cyan,
        fontWeight: '700',
    },
    recordingActiveBtn: {
        backgroundColor: 'rgba(255,86,120,0.15)',
        borderRadius: radii.pill,
    },
    sendBtnDisabled: { opacity: 0.4 },
    stopBtn: { padding: spacing.sm, marginLeft: spacing.xs },
});
