import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AdaptiveContainer } from '../src/components/layout';
import { GCButton, GCCard, GCHeader, GCStatusChip } from '../src/components/ui';
import { createChatSession } from '../src/api/client';
import { useShareIntents } from '../src/context/ShareIntentContext';
import { useGatewayAccess } from '../src/context/GatewayAccessContext';
import { useBottomInsetPadding } from '../src/hooks/useBottomInsetPadding';
import { colors, radii, spacing, typography } from '../src/theme/tokens';
import { useToast } from '../src/context/ToastContext';

export default function ShareReviewScreen() {
    const router = useRouter();
    const { pendingDrafts, dismissDraft, clearDrafts } = useShareIntents();
    const { shellState } = useGatewayAccess();
    const { showToast } = useToast();
    const bottomPad = useBottomInsetPadding(32);
    const [openingDraftId, setOpeningDraftId] = useState<string | null>(null);

    useEffect(() => {
        if (pendingDrafts.length === 0) {
            router.replace('/(tabs)/more' as any);
        }
    }, [pendingDrafts.length, router]);

    const gatewayReady = shellState.status === 'ready' || shellState.status === 'degraded-live-updates';
    const pendingCountLabel = useMemo(() => (
        pendingDrafts.length === 1 ? '1 pending item' : `${pendingDrafts.length} pending items`
    ), [pendingDrafts.length]);

    const openDraftInChat = useCallback(async (draftId: string) => {
        setOpeningDraftId(draftId);
        try {
            const session = await createChatSession();
            router.push({
                pathname: '/(tabs)/chat/[sessionId]' as any,
                params: {
                    sessionId: session.sessionId,
                    shareDraftId: draftId,
                },
            });
        } catch (error) {
            showToast({
                message: (error as Error).message || 'Could not open a new chat for the shared item.',
                type: 'error',
            });
            setOpeningDraftId(null);
        }
    }, [router, showToast]);

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Share Queue"
                title="Review Shared Content"
                subtitle="Nothing reaches chat until you explicitly open it."
                right={<GCButton title="Back" onPress={() => router.replace('/(tabs)/more' as any)} variant="ghost" size="sm" />}
            />
            <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
                <AdaptiveContainer style={styles.content}>
                    <GCCard variant={gatewayReady ? 'default' : 'warning'}>
                        <View style={styles.headerRow}>
                            <View style={styles.listBody}>
                                <Text style={styles.sectionTitle}>QUEUE STATUS</Text>
                                <Text style={styles.body}>{pendingCountLabel}. Shared content stays local until you review it.</Text>
                            </View>
                            <GCStatusChip tone={gatewayReady ? 'success' : 'warning'}>
                                {gatewayReady ? 'READY' : shellState.label.toUpperCase()}
                            </GCStatusChip>
                        </View>
                        <Text style={styles.caption}>{shellState.message}</Text>
                        <View style={styles.actionRow}>
                            {!gatewayReady ? (
                                <GCButton title="Open Login Gate" onPress={() => router.push('/login')} variant="secondary" size="sm" />
                            ) : null}
                            <GCButton
                                title="Clear Queue"
                                onPress={() => void clearDrafts()}
                                variant="danger"
                                size="sm"
                                disabled={pendingDrafts.length === 0}
                            />
                        </View>
                    </GCCard>

                    {pendingDrafts.map((draft) => (
                        <GCCard key={draft.draftId} style={styles.draftCard}>
                            <View style={styles.headerRow}>
                                <View style={styles.listBody}>
                                    <Text style={styles.sectionTitle}>SHARED ITEM</Text>
                                    <Text style={styles.body}>
                                        {draft.subject || draft.text || draft.attachment?.fileName || 'Shared content'}
                                    </Text>
                                </View>
                                <GCStatusChip tone="muted">
                                    {new Date(draft.receivedAt).toLocaleTimeString()}
                                </GCStatusChip>
                            </View>

                            {draft.subject ? <Text style={styles.detail}>Subject: {draft.subject}</Text> : null}
                            {draft.text ? <Text style={styles.detail}>{draft.text}</Text> : null}
                            {draft.attachment ? (
                                <View style={styles.attachmentRow}>
                                    <Ionicons name="attach" size={16} color={colors.cyan} />
                                    <Text style={styles.caption}>
                                        {draft.attachment.fileName} · {draft.attachment.mimeType}
                                        {typeof draft.attachment.sizeBytes === 'number'
                                            ? ` · ${Math.max(1, Math.round(draft.attachment.sizeBytes / 1024))} KB`
                                            : ''}
                                    </Text>
                                </View>
                            ) : null}

                            <View style={styles.actionRow}>
                                <GCButton
                                    title={openingDraftId === draft.draftId ? 'Opening…' : 'Review In New Chat'}
                                    onPress={() => void openDraftInChat(draft.draftId)}
                                    variant="primary"
                                    size="sm"
                                    disabled={!gatewayReady || openingDraftId === draft.draftId}
                                />
                                <GCButton
                                    title="Dismiss"
                                    onPress={() => void dismissDraft(draft.draftId)}
                                    variant="secondary"
                                    size="sm"
                                />
                            </View>
                        </GCCard>
                    ))}

                    <Pressable style={styles.footerLink} onPress={() => router.push('/(tabs)/privacy' as any)}>
                        <Ionicons name="shield-half" size={16} color={colors.cyan} />
                        <Text style={styles.footerText}>Open Privacy Center</Text>
                    </Pressable>
                </AdaptiveContainer>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { gap: spacing.lg, paddingBottom: spacing.xl },
    draftCard: { marginBottom: spacing.lg },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    listBody: { flex: 1, minWidth: 0 },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.sm },
    body: { ...typography.bodyMd, color: colors.textPrimary, lineHeight: 22 },
    detail: { ...typography.bodySm, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },
    caption: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    attachmentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
        padding: spacing.sm,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        backgroundColor: colors.bgInset,
    },
    footerLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
    },
    footerText: { ...typography.bodySm, color: colors.cyan },
});
