import React, { useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    createChatSession,
    fetchApprovals,
    fetchCompanionSessionInfo,
    fetchFollowOnParityReport,
    getCompanionSession,
    getLastCompanionBootstrapError,
    resolveApproval,
} from '../../src/api/client';
import type {
    ApprovalRequest,
    CompanionSessionInfoResponse,
    FollowOnParityReport,
    RealtimeEvent,
} from '../../src/api/types';
import { GCCard, GCButton, GCHeader, GCStatusChip } from '../../src/components/ui';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useRealtimeEvents } from '../../src/context/RealtimeEventsContext';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { getRealtimeEventMeta } from '../../src/utils/realtimeEvents';

type CanvasNode =
    | {
        id: string;
        kind: 'approval';
        title: string;
        subtitle: string;
        detail: string;
        tone: 'warning' | 'critical' | 'success';
        route: string;
        approval: ApprovalRequest;
    }
    | {
        id: string;
        kind: 'event';
        title: string;
        subtitle: string;
        detail: string;
        tone: 'live' | 'warning' | 'critical' | 'muted';
        route?: string;
        event: RealtimeEvent;
    };

export default function CompanionCanvasScreen() {
    const router = useRouter();
    const bottomPad = useBottomInsetPadding(32);
    const hasCompanionSession = !!getCompanionSession();
    const lastCompanionBootstrapError = getLastCompanionBootstrapError();
    const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
    const [actionError, setActionError] = useState<string | undefined>(undefined);
    const [sceneBusy, setSceneBusy] = useState(false);
    const [approvalBusyId, setApprovalBusyId] = useState<string | undefined>(undefined);

    const parity = useApiData<FollowOnParityReport>(
        () => fetchFollowOnParityReport(),
        { pollMs: 30000 },
    );
    const companionInfo = useApiData<CompanionSessionInfoResponse>(
        () => fetchCompanionSessionInfo(),
        { enabled: hasCompanionSession, pollMs: 20000 },
    );
    const approvals = useApiData<{ items: ApprovalRequest[] }>(
        () => fetchApprovals(),
        { enabled: hasCompanionSession, pollMs: 15000 },
    );
    const realtime = useRealtimeEvents();

    const nodes = useMemo<CanvasNode[]>(() => {
        const approvalNodes = (approvals.data?.items ?? []).slice(0, 4).map<CanvasNode>((approval) => ({
            id: `approval:${approval.approvalId}`,
            kind: 'approval',
            title: approval.kind,
            subtitle: approval.resolutionNote?.trim() || summarizeApprovalPreview(approval),
            detail: `Risk ${approval.riskLevel} · pending operator action`,
            tone: approval.riskLevel === 'nuclear' || approval.riskLevel === 'danger' ? 'critical' : 'warning',
            route: `/(tabs)/approvals/${approval.approvalId}`,
            approval,
        }));

        const eventNodes = realtime.events.slice(0, 8).map<CanvasNode>((event) => {
            const meta = getRealtimeEventMeta(event);
            return {
                id: `event:${event.eventId}`,
                kind: 'event',
                title: meta.title,
                subtitle: meta.body,
                detail: `${meta.canonicalType} · ${event.source}`,
                tone: meta.logLevel === 'error'
                    ? 'critical'
                    : meta.logLevel === 'warn'
                        ? 'warning'
                        : meta.logLevel === 'info'
                            ? 'live'
                            : 'muted',
                route: meta.route,
                event,
            };
        });

        return [...approvalNodes, ...eventNodes].slice(0, 12);
    }, [approvals.data?.items, realtime.events]);

    const selectedNode = useMemo(
        () => nodes.find((item) => item.id === selectedNodeId) ?? nodes[0],
        [nodes, selectedNodeId],
    );

    useEffect(() => {
        if (!nodes.length) {
            if (selectedNodeId) {
                setSelectedNodeId(undefined);
            }
            return;
        }
        if (!selectedNodeId || !nodes.some((item) => item.id === selectedNodeId)) {
            setSelectedNodeId(nodes[0].id);
        }
    }, [nodes, selectedNodeId]);

    const onRefresh = async () => {
        await Promise.allSettled([
            parity.refresh(),
            companionInfo.refresh(),
            approvals.refresh(),
            realtime.refreshSnapshot(),
        ]);
    };

    const onCreateSceneSession = async () => {
        setSceneBusy(true);
        setActionError(undefined);
        try {
            const session = await createChatSession();
            router.push(`/(tabs)/chat/${session.sessionId}` as any);
        } catch (error) {
            setActionError((error as Error).message || 'Unable to create a signed scene session.');
        } finally {
            setSceneBusy(false);
        }
    };

    const onResolveApproval = async (approvalId: string, decision: 'approve' | 'reject') => {
        setApprovalBusyId(`${approvalId}:${decision}`);
        setActionError(undefined);
        try {
            await resolveApproval(approvalId, decision, `Companion canvas ${decision}`);
            await Promise.allSettled([approvals.refresh(), realtime.refreshSnapshot()]);
        } catch (error) {
            setActionError((error as Error).message || `Unable to ${decision} approval.`);
        } finally {
            setApprovalBusyId(undefined);
        }
    };

    const canvasContract = parity.data?.canvas.contract;
    const companionContract = parity.data?.companion.contract;
    const canvasBlockingIssues = parity.data?.canvas.blockingIssues ?? [];

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Companion"
                title="Canvas"
                subtitle={hasCompanionSession
                    ? `${realtime.status} scene feed · signed companion lane`
                    : 'Companion session required for the A2UI lane'}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
                refreshControl={
                    <RefreshControl
                        refreshing={parity.refreshing || companionInfo.refreshing || approvals.refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.cyan}
                        colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                }
            >
                {!hasCompanionSession ? (
                    <GCCard variant="warning" style={styles.section}>
                        <Text style={styles.sectionTitle}>COMPANION SESSION REQUIRED</Text>
                        <Text style={styles.copy}>
                            Sign in through the approved-device companion lane first. This screen only enables scene
                            selection, inspection, and apply actions when the app has an active
                            `companion.android.v1` session.
                        </Text>
                        {lastCompanionBootstrapError ? (
                            <Text style={styles.metaHint}>
                                Last bootstrap error: {lastCompanionBootstrapError}
                            </Text>
                        ) : null}
                    </GCCard>
                ) : null}

                {hasCompanionSession ? (
                    <GCCard style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <View>
                                <Text style={styles.sectionTitle}>SIGNED LANE</Text>
                                <Text style={styles.sectionSubtitle}>
                                    {companionInfo.data?.deviceLabel || 'Resolving companion session'} ·{' '}
                                    {companionInfo.data?.platform || 'android'}
                                </Text>
                            </View>
                            <GCStatusChip tone={realtime.status === 'live' ? 'live' : realtime.status === 'degraded' ? 'warning' : 'muted'}>
                                {realtime.status.toUpperCase()}
                            </GCStatusChip>
                        </View>
                        <Text style={styles.copy}>
                            {parity.data?.companion.paritySummary
                                || 'Companion lane is loading from the live follow-on parity report.'}
                        </Text>
                        <View style={styles.metaGrid}>
                            <MetaStat label="Contract" value={companionInfo.data?.contractId || companionContract?.contractId || 'companion.android.v1'} />
                            <MetaStat label="Signature" value={companionInfo.data?.signatureAlgorithm || 'ed25519'} />
                            <MetaStat label="Transport" value={companionContract?.transportLanes.join(', ') || 'foreground_sse'} />
                            <MetaStat label="Surface" value={canvasContract?.operatorSurface || 'mission_control'} />
                        </View>
                        <View style={styles.capabilityWrap}>
                            {(canvasContract?.uiCapabilities ?? []).map((capability) => (
                                <GCStatusChip key={`ui:${capability}`} tone="live">{capability}</GCStatusChip>
                            ))}
                            {(companionContract?.deviceCapabilities ?? []).map((capability) => (
                                <GCStatusChip key={`device:${capability}`} tone="muted">{capability}</GCStatusChip>
                            ))}
                        </View>
                        <View style={styles.buttonRow}>
                            <GCButton
                                title={sceneBusy ? 'Creating…' : 'New Scene Session'}
                                onPress={() => void onCreateSceneSession()}
                                variant="primary"
                                size="sm"
                                disabled={sceneBusy}
                            />
                            {companionInfo.data?.accessTokenExpiresAt ? (
                                <Text style={styles.metaHint}>
                                    Token until {new Date(companionInfo.data.accessTokenExpiresAt).toLocaleTimeString()}
                                </Text>
                            ) : null}
                        </View>
                    </GCCard>
                ) : null}

                <GCCard style={styles.section}>
                    <Text style={styles.sectionTitle}>SCENE VIEW</Text>
                    <Text style={styles.sectionSubtitle}>
                        Pending approvals and live realtime nodes from the shared foreground stream.
                    </Text>
                    {nodes.length === 0 ? (
                        <Text style={styles.emptyText}>
                            No scene nodes yet. Create a scene session or wait for the companion event feed to publish activity.
                        </Text>
                    ) : (
                        <View style={styles.nodeList}>
                            {nodes.map((node) => (
                                <Pressable
                                    key={node.id}
                                    onPress={() => setSelectedNodeId(node.id)}
                                    style={({ pressed }) => [
                                        styles.nodeCard,
                                        selectedNode?.id === node.id && styles.nodeCardSelected,
                                        pressed && styles.nodeCardPressed,
                                    ]}
                                >
                                    <View style={styles.nodeTitleRow}>
                                        <Text style={styles.nodeTitle} numberOfLines={1}>{node.title}</Text>
                                        <GCStatusChip tone={node.tone}>{node.kind.toUpperCase()}</GCStatusChip>
                                    </View>
                                    <Text style={styles.nodeSubtitle} numberOfLines={2}>{node.subtitle}</Text>
                                    <Text style={styles.nodeDetail}>{node.detail}</Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </GCCard>

                <GCCard style={styles.section}>
                    <Text style={styles.sectionTitle}>INSPECTOR</Text>
                    <Text style={styles.sectionSubtitle}>
                        Selection and apply actions for the current companion-backed scene node.
                    </Text>
                    {!selectedNode ? (
                        <Text style={styles.emptyText}>Select a scene node to inspect it.</Text>
                    ) : selectedNode.kind === 'approval' ? (
                        <>
                            <Text style={styles.inspectorTitle}>{selectedNode.approval.kind}</Text>
                            <Text style={styles.copy}>{summarizeApprovalPreview(selectedNode.approval)}</Text>
                            <View style={styles.metaGrid}>
                                <MetaStat label="Risk" value={selectedNode.approval.riskLevel} />
                                <MetaStat label="Status" value={selectedNode.approval.status} />
                                <MetaStat label="Created" value={new Date(selectedNode.approval.createdAt).toLocaleString()} />
                                <MetaStat label="Explainer" value={selectedNode.approval.explanationStatus} />
                            </View>
                            <Text style={styles.jsonPreview}>{truncateJson(selectedNode.approval.preview)}</Text>
                            <View style={styles.buttonRow}>
                                <GCButton
                                    title={approvalBusyId === `${selectedNode.approval.approvalId}:approve` ? 'Approving…' : 'Approve'}
                                    onPress={() => void onResolveApproval(selectedNode.approval.approvalId, 'approve')}
                                    variant="primary"
                                    size="sm"
                                    disabled={!!approvalBusyId}
                                />
                                <GCButton
                                    title={approvalBusyId === `${selectedNode.approval.approvalId}:reject` ? 'Rejecting…' : 'Reject'}
                                    onPress={() => void onResolveApproval(selectedNode.approval.approvalId, 'reject')}
                                    variant="danger"
                                    size="sm"
                                    disabled={!!approvalBusyId}
                                />
                                <GCButton
                                    title="Open Gatehouse"
                                    onPress={() => router.push(selectedNode.route as any)}
                                    variant="ghost"
                                    size="sm"
                                />
                            </View>
                        </>
                    ) : (
                        <>
                            <Text style={styles.inspectorTitle}>{selectedNode.title}</Text>
                            <Text style={styles.copy}>{selectedNode.subtitle}</Text>
                            <View style={styles.metaGrid}>
                                <MetaStat label="Event type" value={selectedNode.event.eventType} />
                                <MetaStat label="Source" value={selectedNode.event.source} />
                                <MetaStat label="Sequence" value={String(readRealtimeSequence(selectedNode.event) || 'n/a')} />
                                <MetaStat label="When" value={new Date(selectedNode.event.timestamp).toLocaleTimeString()} />
                            </View>
                            <Text style={styles.jsonPreview}>{truncateJson(selectedNode.event.payload)}</Text>
                            <View style={styles.buttonRow}>
                                {selectedNode.route ? (
                                    <GCButton
                                        title="Open Surface"
                                        onPress={() => router.push(selectedNode.route as any)}
                                        variant="secondary"
                                        size="sm"
                                    />
                                ) : null}
                                <GCButton
                                    title={sceneBusy ? 'Creating…' : 'Apply To New Session'}
                                    onPress={() => void onCreateSceneSession()}
                                    variant="primary"
                                    size="sm"
                                    disabled={sceneBusy}
                                />
                            </View>
                        </>
                    )}
                    {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
                </GCCard>

                {canvasBlockingIssues.length > 0 ? (
                    <GCCard variant="warning" style={styles.section}>
                        <Text style={styles.sectionTitle}>REMAINING BLOCKERS</Text>
                        {canvasBlockingIssues.slice(0, 3).map((issue) => (
                            <Text key={issue} style={styles.bulletText}>- {issue}</Text>
                        ))}
                    </GCCard>
                ) : null}
            </ScrollView>
        </View>
    );
}

function MetaStat({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>{label}</Text>
            <Text style={styles.metaValue}>{value}</Text>
        </View>
    );
}

function summarizeApprovalPreview(approval: ApprovalRequest): string {
    const preview = approval.preview && typeof approval.preview === 'object' ? approval.preview : {};
    const previewText = Object.entries(preview)
        .slice(0, 2)
        .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join(' · ');
    if (previewText.trim()) {
        return previewText;
    }
    return `${approval.kind} requires ${approval.riskLevel} review.`;
}

function truncateJson(value: unknown): string {
    const formatted = JSON.stringify(value ?? {}, null, 2);
    if (formatted.length <= 420) {
        return formatted;
    }
    return `${formatted.slice(0, 417)}...`;
}

function readRealtimeSequence(event: RealtimeEvent): number | undefined {
    const sequence = (event as RealtimeEvent & { sequence?: unknown }).sequence;
    return typeof sequence === 'number' && Number.isFinite(sequence) ? sequence : undefined;
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 32, gap: spacing.lg },
    section: { marginBottom: spacing.lg },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    sectionTitle: { ...typography.eyebrow, color: colors.textDim, marginBottom: 4 },
    sectionSubtitle: { ...typography.caption, color: colors.textDim, marginBottom: spacing.md },
    copy: { ...typography.bodySm, color: colors.textSecondary, lineHeight: 20 },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    metaCard: {
        flexBasis: '48%',
        backgroundColor: colors.bgPanelSolid,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderDefault,
        padding: spacing.md,
    },
    metaLabel: { ...typography.caption, color: colors.textDim, marginBottom: 4 },
    metaValue: { ...typography.bodySm, color: colors.textPrimary },
    capabilityWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: spacing.md,
    },
    buttonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    metaHint: { ...typography.caption, color: colors.textDim },
    nodeList: { gap: spacing.sm },
    nodeCard: {
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderDefault,
        backgroundColor: colors.bgPanelSolid,
        padding: spacing.md,
    },
    nodeCardSelected: {
        borderColor: colors.borderStrong,
        backgroundColor: colors.bgCardElevated,
    },
    nodeCardPressed: { opacity: 0.8 },
    nodeTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: 4,
    },
    nodeTitle: { ...typography.bodyMd, color: colors.textPrimary, flex: 1 },
    nodeSubtitle: { ...typography.bodySm, color: colors.textSecondary, marginBottom: 4 },
    nodeDetail: { ...typography.caption, color: colors.textDim },
    emptyText: { ...typography.bodySm, color: colors.textDim },
    inspectorTitle: { ...typography.displaySm, color: colors.textPrimary, marginBottom: spacing.xs },
    jsonPreview: {
        ...typography.caption,
        color: colors.textMuted,
        marginTop: spacing.md,
        padding: spacing.md,
        borderRadius: radii.sm,
        backgroundColor: colors.bgPanelSolid,
        borderWidth: 1,
        borderColor: colors.borderDefault,
        fontFamily: 'monospace',
    },
    errorText: { ...typography.bodySm, color: colors.crimson, marginTop: spacing.sm },
    bulletText: { ...typography.bodySm, color: colors.textSecondary, marginBottom: 6 },
});
