/**
 * GoatCitadel Mobile — Gatehouse / Approvals List
 */
import React, { useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, Animated, Alert, Platform } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCStatusChip } from '../../../src/components/ui';
import { colors, spacing, typography } from '../../../src/theme/tokens';
import { useApiData } from '../../../src/hooks/useApiData';
import { fetchApprovals, resolveApproval } from '../../../src/api/client';
import type { ApprovalRequest } from '../../../src/api/types';
export default function ApprovalListScreen() {
    const router = useRouter();
    const approvals = useApiData<{ items: ApprovalRequest[] }>(
        useCallback(() => fetchApprovals(), []),
        { pollMs: 5000 },
    );

    const mockItems: ApprovalRequest[] = [
        {
            approvalId: 'req-001',
            status: 'pending',
            kind: 'ToolExecution',
            riskLevel: 'caution',
            preview: { tool: 'deploy_prod', target: 'api-server' },
            payload: {},
            explanationStatus: 'completed',
            createdAt: new Date().toISOString(),
        },
        {
            approvalId: 'req-002',
            status: 'pending',
            kind: 'FileSystemWrite',
            riskLevel: 'danger',
            preview: { path: '/etc/nginx/nginx.conf', size: '2KB' },
            payload: {},
            explanationStatus: 'not_requested',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
        }
    ];

    // Use mockItems when not connected to gateway for demo purposes
    const items = approvals.data?.items ?? mockItems;
    const pending = items.filter((a) => a.status === 'pending');
    const resolved = items.filter((a) => a.status !== 'pending');

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <GCHeader eyebrow="Gatehouse" title="Approvals"
                subtitle={`${pending.length} pending · ${resolved.length} resolved`} />
            <FlatList data={[...pending, ...resolved]} keyExtractor={(i) => i.approvalId}
                renderItem={({ item }) => (
                    <ApprovalRow approval={item}
                        onPress={() => router.push(`/(tabs)/approvals/${item.approvalId}`)}
                        onAction={approvals.refresh}
                    />
                )}
                refreshControl={<RefreshControl refreshing={approvals.refreshing} onRefresh={approvals.refresh}
                    tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard} />}
                contentContainerStyle={s.list}
                ListEmptyComponent={
                    approvals.loading ? null : (
                        <View style={s.empty}>
                            <Ionicons name="lock-open-outline" size={48} color={colors.textDim} />
                            <Text style={s.emptyText}>{approvals.error || 'No approvals in the queue.'}</Text>
                        </View>
                    )
                } />
        </SafeAreaView>
    );
}
function ApprovalRow({ approval, onPress, onAction }: { approval: ApprovalRequest; onPress: () => void; onAction: () => void }) {
    const riskColor = approval.riskLevel === 'danger' || approval.riskLevel === 'nuclear' ? colors.crimson
        : approval.riskLevel === 'caution' ? colors.ember : colors.success;
    const riskTone = approval.riskLevel === 'danger' || approval.riskLevel === 'nuclear' ? 'critical' as const
        : approval.riskLevel === 'caution' ? 'warning' as const : 'success' as const;
    const isPending = approval.status === 'pending';

    const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const trans = dragX.interpolate({ inputRange: [0, 50, 100, 101], outputRange: [-20, 0, 0, 1], extrapolate: 'clamp' });
        const opacity = dragX.interpolate({ inputRange: [0, 50, 100], outputRange: [0, 1, 1], extrapolate: 'clamp' });
        return (
            <Animated.View style={[s.actionApprove, { opacity, transform: [{ translateX: trans }] }]}>
                <Ionicons name="checkmark-circle" size={24} color={colors.bgCore} />
                <Text style={s.actionText}>APPROVE</Text>
            </Animated.View>
        );
    };

    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const trans = dragX.interpolate({ inputRange: [-100, -50, 0], outputRange: [0, 0, 20], extrapolate: 'clamp' });
        const opacity = dragX.interpolate({ inputRange: [-100, -50, 0], outputRange: [1, 1, 0], extrapolate: 'clamp' });
        return (
            <Animated.View style={[s.actionReject, { opacity, transform: [{ translateX: trans }] }]}>
                <Ionicons name="close-circle" size={24} color={colors.bgCore} />
                <Text style={s.actionText}>REJECT</Text>
            </Animated.View>
        );
    };

    const handleSwipeableOpen = async (direction: 'left' | 'right') => {
        const decision = direction === 'left' ? 'approve' : 'reject';
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(
                decision === 'approve' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
            );
        }
        try {
            await resolveApproval(approval.approvalId, decision);
            onAction();
        } catch (e: any) {
            Alert.alert('Error', e.message);
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
            <Pressable style={({ pressed }) => [s.row, isPending && s.rowPending, pressed && s.rowPressed]}
                onPress={onPress}>
                <View style={[s.riskStripe, { backgroundColor: riskColor }]} />
                <View style={s.rowContent}>
                    <View style={s.rowTop}>
                        <Text style={s.rowKind}>{approval.kind}</Text>
                        <GCStatusChip tone={isPending ? riskTone : 'muted'}>
                            {isPending ? approval.riskLevel.toUpperCase() : approval.status.toUpperCase()}
                        </GCStatusChip>
                    </View>
                    <Text style={s.rowPreview} numberOfLines={2}>{JSON.stringify(approval.preview).slice(0, 120)}</Text>
                    <Text style={s.rowTime}>{new Date(approval.createdAt).toLocaleString()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </Pressable>
        </Swipeable>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    list: { paddingBottom: 32 },
    row: {
        flexDirection: 'row', alignItems: 'center', paddingRight: spacing.lg, paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderQuiet
    },
    rowPending: { backgroundColor: 'rgba(255,154,69,0.04)' },
    rowPressed: { backgroundColor: colors.bgPanelSolid },
    riskStripe: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: spacing.md, marginLeft: spacing.lg },
    rowContent: { flex: 1, gap: 4 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowKind: { ...typography.displaySm, color: colors.textPrimary, textTransform: 'uppercase' },
    rowPreview: { ...typography.bodySm, color: colors.textMuted },
    rowTime: { ...typography.caption, color: colors.textDim },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim, textAlign: 'center', maxWidth: 260 },
    actionApprove: {
        flex: 1, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'flex-start',
        paddingLeft: spacing.xl,
    },
    actionReject: {
        flex: 1, backgroundColor: colors.crimson, justifyContent: 'center', alignItems: 'flex-end',
        paddingRight: spacing.xl,
    },
    actionText: {
        ...typography.eyebrow, color: colors.bgCore, marginTop: 4,
    },
});
