/**
 * GoatCitadel Mobile — Approval Detail Screen
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCCard, GCButton, GCStatusChip } from '../../../src/components/ui';
import { colors, spacing, typography, radii } from '../../../src/theme/tokens';
import { useApiData } from '../../../src/hooks/useApiData';
import { fetchApprovals, resolveApproval } from '../../../src/api/client';
import type { ApprovalRequest } from '../../../src/api/types';

export default function ApprovalDetailScreen() {
    const { approvalId } = useLocalSearchParams<{ approvalId: string }>();
    const router = useRouter();
    const [resolving, setResolving] = useState(false);

    const approvals = useApiData<{ items: ApprovalRequest[] }>(
        useCallback(() => fetchApprovals(), []),
    );

    const approval = approvals.data?.items.find((a) => a.approvalId === approvalId);

    const handleResolve = async (decision: 'approve' | 'reject') => {
        if (!approvalId) return;
        setResolving(true);
        try {
            await resolveApproval(approvalId, decision);
            Alert.alert('Done', `Approval ${decision === 'approve' ? 'approved' : 'rejected'}.`);
            router.back();
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setResolving(false);
        }
    };

    if (!approval) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <GCHeader eyebrow="Gatehouse" title="Approval Detail" />
                <View style={s.loading}><Text style={s.loadingText}>Loading…</Text></View>
            </SafeAreaView>
        );
    }

    const riskColor = approval.riskLevel === 'danger' || approval.riskLevel === 'nuclear'
        ? colors.crimson : approval.riskLevel === 'caution' ? colors.ember : colors.success;
    const isPending = approval.status === 'pending';

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <GCHeader eyebrow="Gatehouse" title={approval.kind}
                right={<GCStatusChip tone={isPending ? 'warning' : 'muted'}>
                    {approval.status.toUpperCase()}
                </GCStatusChip>} />

            <ScrollView contentContainerStyle={s.content}>
                {/* Risk Badge */}
                <GCCard variant={approval.riskLevel === 'danger' || approval.riskLevel === 'nuclear' ? 'critical' : 'default'}>
                    <View style={s.riskRow}>
                        <View style={[s.riskDot, { backgroundColor: riskColor }]} />
                        <Text style={[s.riskLabel, { color: riskColor }]}>
                            {approval.riskLevel.toUpperCase()} RISK
                        </Text>
                    </View>
                    <Text style={s.timestamp}>Created: {new Date(approval.createdAt).toLocaleString()}</Text>
                    {approval.resolvedAt ? (
                        <Text style={s.timestamp}>Resolved: {new Date(approval.resolvedAt).toLocaleString()}</Text>
                    ) : null}
                </GCCard>

                {/* Explanation */}
                {approval.explanation ? (
                    <GCCard style={{ marginTop: spacing.md }}>
                        <Text style={s.sectionTitle}>EXPLANATION</Text>
                        <Text style={s.explanationText}>{approval.explanation.summary}</Text>
                        <Text style={s.explanationRisk}>{approval.explanation.riskExplanation}</Text>
                        {approval.explanation.saferAlternative ? (
                            <View style={s.altBox}>
                                <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                                <Text style={s.altText}>{approval.explanation.saferAlternative}</Text>
                            </View>
                        ) : null}
                    </GCCard>
                ) : null}

                {/* Payload Preview */}
                <GCCard style={{ marginTop: spacing.md }}>
                    <Text style={s.sectionTitle}>PAYLOAD PREVIEW</Text>
                    <Text style={s.payloadText}>{JSON.stringify(approval.preview, null, 2)}</Text>
                </GCCard>

                {/* Actions */}
                {isPending ? (
                    <View style={s.actions}>
                        <GCButton title="Approve" onPress={() => handleResolve('approve')}
                            variant="primary" size="lg" disabled={resolving} style={{ flex: 1 }} />
                        <GCButton title="Reject" onPress={() => handleResolve('reject')}
                            variant="danger" size="lg" disabled={resolving} style={{ flex: 1 }} />
                    </View>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { padding: spacing.xl, paddingBottom: 40 },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { color: colors.textDim, ...typography.bodyMd },
    riskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    riskDot: { width: 10, height: 10, borderRadius: 5 },
    riskLabel: { ...typography.displaySm, fontWeight: '700' },
    timestamp: { ...typography.caption, color: colors.textDim, marginTop: 2 },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.sm },
    explanationText: { ...typography.bodyMd, color: colors.textSecondary, marginBottom: spacing.sm },
    explanationRisk: { ...typography.bodySm, color: colors.ember, marginBottom: spacing.sm },
    altBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.bgInset,
        borderRadius: radii.sm, padding: spacing.md
    },
    altText: { ...typography.bodySm, color: colors.success, flex: 1 },
    payloadText: { ...typography.mono, color: colors.textMuted },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
});
