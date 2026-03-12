/**
 * GoatCitadel Mobile — Chat Thread Screen
 * The centerpiece of the app — premium streaming chat with traces.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { FlashList } from '@shopify/flash-list';
import { useToast } from '../../../src/context/ToastContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { colors, spacing, typography, radii } from '../../../src/theme/tokens';
import { TypingIndicator, SkeletonBlock } from '../../../src/components/ui';
import { useApiData } from '../../../src/hooks/useApiData';
import {
    fetchChatThread,
    fetchChatPrefs,
    fetchRuntimeSettings,
    uploadChatAttachment,
} from '../../../src/api/client';
import { streamChatResponse } from '../../../src/api/streaming';
import type {
    ChatAttachmentRecord,
    ChatInputPart,
    ChatMemoryMode,
    ChatThinkingLevel,
    ChatThreadResponse,
    ChatThreadTurnRecord,
    ChatMode,
    ChatToolRunRecord,
    ChatWebMode,
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

export default function ChatThreadScreen() {
    const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
    const router = useRouter();
    const flatListRef = useRef<any>(null);
    const { showToast } = useToast();

    const [composerText, setComposerText] = useState('');
    const [mode, setMode] = useState<ChatMode>('chat');
    const [showModeMenu, setShowModeMenu] = useState(false);
    const [showProviderPanel, setShowProviderPanel] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<string | undefined>();
    const [selectedModel, setSelectedModel] = useState<string | undefined>();
    const [webMode, setWebMode] = useState<ChatWebMode>('auto');
    const [memoryMode, setMemoryMode] = useState<ChatMemoryMode>('auto');
    const [thinkingLevel, setThinkingLevel] = useState<ChatThinkingLevel>('standard');
    const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const runtime = useChatSessionRuntime(sessionId);

    // P0-4: Clean up active recording on unmount to avoid leaked microphone.
    // Use a ref so the cleanup always sees the latest recording instance.
    const recordingRef = useRef<Audio.Recording | null>(null);
    recordingRef.current = recording;
    useEffect(() => {
        return () => {
            recordingRef.current?.stopAndUnloadAsync().catch(() => {});
        };
    }, []);

    const settings = useApiData(
        useCallback(() => fetchRuntimeSettings(), []),
    );

    const thread = useApiData<ChatThreadResponse>(
        useCallback(() => fetchChatThread(sessionId!), [sessionId]),
        { enabled: !!sessionId },
    );

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

    const turns = thread.data?.turns ?? [];
    const isServerRunning = turns.some((turn) => turn.trace.status === 'running');
    const isStreaming = Boolean(runtime.activeRequestId);
    const isBusy = isStreaming || isServerRunning;
    const shouldPollThread = isServerRunning && !isStreaming;
    const streamingContent = runtime.streamingContent;
    const activeTools = runtime.activeTools;
    const canSubmitDraft = Boolean(composerText.trim() || selectedImage);

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
            showToast({
                message: (error as Error).message || 'Failed to prepare this message.',
                type: 'error',
            });
        }
    }, [sessionId, showToast, thread.reload]);

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
            const stoppedLocally = stopLocalWait();
            if (stoppedLocally) {
                showToast({
                    message: 'Steer queued next. The current mobile wait was stopped locally.',
                    type: 'info',
                });
            } else if (isBusy) {
                showToast({
                    message: 'Steer queued next. It will run as soon as the current turn clears.',
                    type: 'info',
                });
            }
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
        const stopped = stopLocalWait();
        if (stopped) {
            showToast({
                message: 'Stream stopped. The server turn may still finish in the background.',
                type: 'info',
            });
        } else {
            showToast({
                message: 'This turn is still running on the server, so there was no local stream to stop.',
                type: 'warning',
            });
        }
    }, [sessionId, showToast, stopLocalWait]);

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
        if (recording) {
            await recording.stopAndUnloadAsync();
            setRecording(null);
            // Voice transcription requires local or remote whisper runtime.
            // Until wired to backend /api/voice/transcribe, just notify.
            showToast({ message: 'Voice recording stopped — transcription not yet connected', type: 'warning' });
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
            try {
                const perm = await Audio.requestPermissionsAsync();
                if (!perm.granted) {
                    showToast({ message: 'Microphone permission denied', type: 'warning' });
                    return;
                }
                await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
                const { recording: r } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
                setRecording(r);
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } catch (err: any) {
                showToast({ message: 'Mic permission denied', type: 'error' });
            }
        }
    };

    const renderTurn = ({ item }: { item: ChatThreadTurnRecord }) => (
        <MemoizedTurnCard turn={item} />
    );

    const insets = useSafeAreaInsets();
    const topPad = Math.max(insets.top, spacing.xl);
    const threadBottomPad = insets.bottom + 20;
    const composerBottomPad = insets.bottom + (Platform.OS === 'android' ? spacing.sm : spacing.lg);

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
                    <Pressable onPress={() => setShowProviderPanel(!showProviderPanel)} style={styles.backBtn}>
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
                <View style={styles.providerPanel}>
                    <Text style={styles.providerPanelTitle}>PROVIDER / MODEL</Text>
                    {settings.data?.llm.providers.map((p: ProviderRecord) => (
                        <Pressable key={p.providerId}
                            style={[styles.providerRow, selectedProvider === p.providerId && styles.providerRowActive]}
                            onPress={() => {
                                setSelectedProvider(p.providerId);
                                setSelectedModel(p.defaultModel);
                            }}>
                            <View style={styles.providerDot} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.providerLabel}>{p.label}</Text>
                                <Text style={styles.providerModel}>{p.defaultModel}</Text>
                            </View>
                            {selectedProvider === p.providerId ? (
                                <Ionicons name="checkmark" size={16} color={colors.cyan} />
                            ) : null}
                        </Pressable>
                    ))}
                    {(!settings.data || settings.data.llm.providers.length === 0) ? (
                        <Text style={styles.providerEmpty}>No providers configured. Using defaults.</Text>
                    ) : null}
                    <Pressable style={styles.providerDone} onPress={() => setShowProviderPanel(false)}>
                        <Text style={styles.providerDoneText}>DONE</Text>
                    </Pressable>
                </View>
            ) : null}

            {/* Thread */}
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <FlashList
                    ref={flatListRef}
                    data={turns}
                    keyExtractor={(t) => t.turnId}
                    renderItem={renderTurn}
                    contentContainerStyle={[styles.threadContent, { paddingBottom: threadBottomPad }]}
                    refreshControl={
                        <RefreshControl
                            refreshing={thread.refreshing}
                            onRefresh={thread.refresh}
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
                                    <Text style={styles.thinkingText}>Thinking…</Text>
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

                {/* Composer */}
                <View style={[styles.composerContainer, { paddingBottom: composerBottomPad }]}>
                    {(isBusy || runtime.queuedMessages.length > 0) ? (
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
                        ) : isStreaming ? (
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
                                style={[styles.sendBtn, recording && styles.recordingActiveBtn]}
                                onPress={toggleRecording}
                            >
                                <Ionicons
                                    name={recording ? "mic" : "mic-outline"}
                                    size={20}
                                    color={recording ? colors.crimson : colors.textDim}
                                />
                            </Pressable>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

/** Single turn: user message + assistant response */
function TurnCard({ turn }: { turn: ChatThreadTurnRecord }) {
    const [traceExpanded, setTraceExpanded] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const { showToast } = useToast();

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
                        {(turn.toolRuns.length > 0 || turn.trace.orchestration) ? (
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
                                    {turn.trace.orchestration.steps.map((step) => (
                                        <View key={step.stepId} style={styles.orchStep}>
                                            <View style={[styles.orchDot, { backgroundColor: stepColor(step.status) }]} />
                                            <Text style={styles.orchStepText}>
                                                {step.role} — {step.status}
                                                {step.durationMs ? ` (${step.durationMs}ms)` : ''}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                        </View>
                    ) : null}
                </Pressable>
            ) : null}
        </View>
    );
}

const MemoizedTurnCard = React.memo(TurnCard, (prev, next) => {
    return prev.turn.turnId === next.turn.turnId &&
        prev.turn.toolRuns.length === next.turn.toolRuns.length &&
        prev.turn.assistantMessage?.content === next.turn.assistantMessage?.content &&
        prev.turn.trace.status === next.turn.trace.status;
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
        status === 'running' ? colors.cyan :
            status === 'failed' ? colors.crimson :
                colors.textDim;
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
    providerPanel: {
        position: 'absolute',
        top: 90,
        left: 20,
        right: 20,
        backgroundColor: colors.bgCardElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        padding: spacing.md,
        zIndex: 100,
        elevation: 10,
    },
    providerPanelTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.sm },
    providerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.sm,
    },
    providerRowActive: { backgroundColor: colors.cyanMuted },
    providerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    providerLabel: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
    providerModel: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },
    providerEmpty: { ...typography.bodySm, color: colors.textDim, fontStyle: 'italic', paddingVertical: spacing.sm },
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
