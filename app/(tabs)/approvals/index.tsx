/**
 * GoatCitadel Mobile — Gatehouse / Approvals List
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Animated,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AdaptiveContainer, ContextPane, MasterDetailShell } from '../../../src/components/layout';
import { GCButton, GCHeader, GCCard, GCStatusChip } from '../../../src/components/ui';
import { useApiData } from '../../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../../src/hooks/useLayout';
import { fetchApprovals, resolveApproval } from '../../../src/api/client';
import type { ApprovalRequest } from '../../../src/api/types';
import { colors, radii, spacing, typography } from '../../../src/theme/tokens';

export default function ApprovalListScreen() {
    const router = useRouter();
    const layout = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const [selectedApprovalId, setSelectedApprovalId] = useState<string | undefined>(undefined);
    const approvals = useApiData<{ items: ApprovalRequest[] }>(
        useCallback(() => fetchApprovals(), []),
        { pollMs: 5000 },
    );

    const items = approvals.data?.items ?? [];
    const pending = items.filter((approval) => approval.status === 'pending');
    const resolved = items.filter((approval) => approval.status !== 'pending');
    const ordered = [...pending, ...resolved];
    const selectedApproval = ordered.find((item) => item.approvalId === selectedApprovalId) ?? ordered[0];

    useEffect(() => {
        if (!layout.dualPane) {
            return;
        }
        if (ordered.length > 0 && !selectedApprovalId) {
            setSelectedApprovalId(ordered[0].approvalId);
        } else if (selectedApprovalId && !ordered.some((item) => item.approvalId === selectedApprovalId)) {
            setSelectedApprovalId(ordered[0]?.approvalId);
        }
    }, [layout.dualPane, ordered, selectedApprovalId]);

    const listComponent = (
        <ContextPane style={styles.listPane}>
            <FlatList
                data={ordered}
                keyExtractor={(item) => item.approvalId}
                renderItem={({ item }) => (
                    <ApprovalRow
                        approval={item}
                        selected={item.approvalId === selectedApproval?.approvalId && layout.dualPane}
                        onPress={() => {
                            if (layout.dualPane) {
                                setSelectedApprovalId(item.approvalId);
                                return;
                            }
                            router.push(`/(tabs)/approvals/${item.approvalId}`);
                        }}
                        onAction={approvals.refresh}
                    />
                )}
                refreshControl={
                    <RefreshControl
                        refreshing={approvals.refreshing}
                        onRefresh={approvals.refresh}
                        tintColor={colors.cyan}
                        colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                }
                contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
                ListEmptyComponent={
                    approvals.loading ? null : (
                        <View style={styles.empty}>
                            <Ionicons name="lock-open-outline" size={48} color={colors.textDim} />
                            <Text style={styles.emptyText}>{approvals.error || 'No approvals in the queue.'}</Text>
                        </View>
                    )
                }
            />
        </ContextPane>
    );

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Gatehouse"
                title="Approvals"
                subtitle={`${pending.length} pending · ${resolved.length} resolved`}
            />
            <AdaptiveContainer style={styles.content}>
                {layout.dualPane ? (
                    <MasterDetailShell
                        master={listComponent}
                        detail={(
                            <ApprovalDetailPanel
                                approval={selectedApproval}
                                onResolve={async (approvalId, decision) => {
                                    await resolveApproval(approvalId, decision);
                                    await approvals.refresh();
                                }}
                            />
                        )}
                    />
                ) : listComponent}
            </AdaptiveContainer>
        </View>
    );
}

function ApprovalRow({
    approval,
    selected,
    onPress,
    onAction,
}: {
    approval: ApprovalRequest;
    selected?: boolean;
    onPress: () => void;
    onAction: () => void;
}) {
    const riskColor = approval.riskLevel === 'danger' || approval.riskLevel === 'nuclear' ? colors.crimson
        : approval.riskLevel === 'caution' ? colors.ember : colors.success;
    const riskTone = approval.riskLevel === 'danger' || approval.riskLevel === 'nuclear' ? 'critical' as const
        : approval.riskLevel === 'caution' ? 'warning' as const : 'success' as const;
    const isPending = approval.status === 'pending';

    const renderLeftActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const trans = dragX.interpolate({ inputRange: [0, 50, 100, 101], outputRange: [-20, 0, 0, 1], extrapolate: 'clamp' });
        const opacity = dragX.interpolate({ inputRange: [0, 50, 100], outputRange: [0, 1, 1], extrapolate: 'clamp' });
        return (
            <Animated.View style={[styles.actionApprove, { opacity, transform: [{ translateX: trans }] }]}>
                <Ionicons name="checkmark-circle" size={24} color={colors.bgCore} />
                <Text style={styles.actionText}>APPROVE</Text>
            </Animated.View>
        );
    };

    const renderRightActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const trans = dragX.interpolate({ inputRange: [-100, -50, 0], outputRange: [0, 0, 20], extrapolate: 'clamp' });
        const opacity = dragX.interpolate({ inputRange: [-100, -50, 0], outputRange: [1, 1, 0], extrapolate: 'clamp' });
        return (
            <Animated.View style={[styles.actionReject, { opacity, transform: [{ translateX: trans }] }]}>
                <Ionicons name="close-circle" size={24} color={colors.bgCore} />
                <Text style={styles.actionText}>REJECT</Text>
            </Animated.View>
        );
    };

    const handleSwipeableOpen = async (direction: 'left' | 'right') => {
        const decision = direction === 'left' ? 'approve' : 'reject';
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(
                decision === 'approve'
                    ? Haptics.NotificationFeedbackType.Success
                    : Haptics.NotificationFeedbackType.Error,
            );
        }
        try {
            await resolveApproval(approval.approvalId, decision);
            onAction();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    return (
        <Swipeable
            renderLeftActions={isPending ? renderLeftActions : undefined}
            renderRightActions={isPending ? renderRightActions : undefined}
            onSwipeableOpen={isPending ? handleSwipeableOpen : undefined}
            friction={2}
            leftThreshold={40}
            rightThreshold={40}
        >
            <Pressable
                style={({ pressed }) => [
                    styles.row,
                    isPending && styles.rowPending,
                    selected && styles.rowSelected,
                    pressed && styles.rowPressed,
                ]}
                onPress={onPress}
            >
                <View style={[styles.riskStripe, { backgroundColor: riskColor }]} />
                <View style={styles.rowContent}>
                    <View style={styles.rowTop}>
                        <Text style={styles.rowKind}>{approval.kind}</Text>
                        <GCStatusChip tone={isPending ? riskTone : 'muted'}>
                            {isPending ? approval.riskLevel.toUpperCase() : approval.status.toUpperCase()}
                        </GCStatusChip>
                    </View>
                    <Text style={styles.rowPreview} numberOfLines={2}>{JSON.stringify(approval.preview).slice(0, 120)}</Text>
                    <Text style={styles.rowTime}>{new Date(approval.createdAt).toLocaleString()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={selected ? colors.cyan : colors.textDim} />
            </Pressable>
        </Swipeable>
    );
}

function ApprovalDetailPanel({
    approval,
    onResolve,
}: {
    approval?: ApprovalRequest;
    onResolve: (approvalId: string, decision: 'approve' | 'reject') => Promise<void>;
}) {
    const [resolving, setResolving] = useState<'approve' | 'reject' | undefined>(undefined);

    if (!approval) {
        return (
            <ContextPane style={styles.detailPane}>
                <Text style={styles.sectionTitle}>APPROVAL DETAIL</Text>
                <View style={styles.empty}>
                    <Ionicons name="shield-half-outline" size={42} color={colors.textDim} />
                    <Text style={styles.emptyText}>Select an approval to inspect its payload and risk.</Text>
                </View>
            </ContextPane>
        );
    }

    const riskColor = approval.riskLevel === 'danger' || approval.riskLevel === 'nuclear'
        ? colors.crimson
        : approval.riskLevel === 'caution'
            ? colors.ember
            : colors.success;
    const isPending = approval.status === 'pending';

    return (
        <ContextPane style={styles.detailPane}>
            <View style={styles.detailHeader}>
                <View>
                    <Text style={styles.sectionTitle}>APPROVAL DETAIL</Text>
                    <Text style={styles.detailTitle}>{approval.kind}</Text>
                </View>
                <GCStatusChip tone={isPending ? 'warning' : 'muted'}>
                    {approval.status.toUpperCase()}
                </GCStatusChip>
            </View>

            <GCCard variant={approval.riskLevel === 'danger' || approval.riskLevel === 'nuclear' ? 'critical' : 'default'}>
                <View style={styles.riskRow}>
                    <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
                    <Text style={[styles.riskLabel, { color: riskColor }]}>
                        {approval.riskLevel.toUpperCase()} RISK
                    </Text>
                </View>
                <Text style={styles.timestamp}>Created: {new Date(approval.createdAt).toLocaleString()}</Text>
                {approval.resolvedAt ? (
                    <Text style={styles.timestamp}>Resolved: {new Date(approval.resolvedAt).toLocaleString()}</Text>
                ) : null}
            </GCCard>

            {approval.explanation ? (
                <GCCard style={styles.detailCard}>
                    <Text style={styles.sectionTitle}>EXPLANATION</Text>
                    <Text style={styles.explanationText}>{approval.explanation.summary}</Text>
                    <Text style={styles.explanationRisk}>{approval.explanation.riskExplanation}</Text>
                    {approval.explanation.saferAlternative ? (
                        <View style={styles.altBox}>
                            <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                            <Text style={styles.altText}>{approval.explanation.saferAlternative}</Text>
                        </View>
                    ) : null}
                </GCCard>
            ) : null}

            <GCCard style={styles.detailCard}>
                <Text style={styles.sectionTitle}>PAYLOAD PREVIEW</Text>
                <Text style={styles.payloadText}>{JSON.stringify(approval.preview, null, 2)}</Text>
            </GCCard>

            {isPending ? (
                <View style={styles.actions}>
                    <GCButton
                        title={resolving === 'approve' ? 'Approving…' : 'Approve'}
                        onPress={async () => {
                            setResolving('approve');
                            try {
                                await onResolve(approval.approvalId, 'approve');
                            } finally {
                                setResolving(undefined);
                            }
                        }}
                        variant="primary"
                        size="lg"
                        disabled={Boolean(resolving)}
                        style={{ flex: 1 }}
                    />
                    <GCButton
                        title={resolving === 'reject' ? 'Rejecting…' : 'Reject'}
                        onPress={async () => {
                            setResolving('reject');
                            try {
                                await onResolve(approval.approvalId, 'reject');
                            } finally {
                                setResolving(undefined);
                            }
                        }}
                        variant="danger"
                        size="lg"
                        disabled={Boolean(resolving)}
                        style={{ flex: 1 }}
                    />
                </View>
            ) : null}
        </ContextPane>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { flex: 1, paddingBottom: spacing.lg },
    listPane: { flex: 1, padding: 0, overflow: 'hidden' },
    list: { paddingVertical: spacing.sm },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    rowPending: { backgroundColor: 'rgba(255,154,69,0.04)' },
    rowSelected: { backgroundColor: colors.cyanMuted },
    rowPressed: { backgroundColor: colors.bgPanelSolid },
    riskStripe: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: spacing.md, marginLeft: spacing.lg },
    rowContent: { flex: 1, gap: 4 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowKind: { ...typography.displaySm, color: colors.textPrimary, textTransform: 'uppercase' },
    rowPreview: { ...typography.bodySm, color: colors.textMuted },
    rowTime: { ...typography.caption, color: colors.textDim },
    empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim, textAlign: 'center', maxWidth: 280 },
    actionApprove: {
        flex: 1, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'flex-start',
        paddingLeft: spacing.xl,
    },
    actionReject: {
        flex: 1, backgroundColor: colors.crimson, justifyContent: 'center', alignItems: 'flex-end',
        paddingRight: spacing.xl,
    },
    actionText: { ...typography.eyebrow, color: colors.bgCore, marginTop: 4 },
    detailPane: { flex: 1, gap: spacing.lg },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
    detailTitle: { ...typography.displayMd, color: colors.textPrimary, marginTop: spacing.xs },
    detailCard: { marginTop: 0 },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.sm },
    riskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    riskDot: { width: 10, height: 10, borderRadius: 5 },
    riskLabel: { ...typography.displaySm, fontWeight: '700' },
    timestamp: { ...typography.caption, color: colors.textDim, marginTop: 2 },
    explanationText: { ...typography.bodyMd, color: colors.textSecondary, marginBottom: spacing.sm },
    explanationRisk: { ...typography.bodySm, color: colors.ember, marginBottom: spacing.sm },
    altBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.bgInset,
        borderRadius: radii.sm, padding: spacing.md,
    },
    altText: { ...typography.bodySm, color: colors.success, flex: 1 },
    payloadText: { ...typography.mono, color: colors.textMuted },
    actions: { flexDirection: 'row', gap: spacing.md },
});
