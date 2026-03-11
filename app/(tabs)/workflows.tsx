/**
 * GoatCitadel Mobile — Workflows Screen
 * Read-only view of cron/scheduled jobs from the backend.
 * There is currently no backend contract for creating or saving custom
 * multi-step automation workflows from mobile. This screen shows what
 * the gateway exposes (cron jobs / scheduled tasks) and is honest about
 * what is not yet available.
 */
import React, { useCallback } from 'react';
import {
    View, Text, ScrollView, StyleSheet, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    GCHeader, GCCard, GCStatusChip, GCButton,
} from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchCronJobs } from '../../src/api/client';
import type { CronJobRecord } from '../../src/api/types';

export default function WorkflowsScreen() {
    const router = useRouter();
    const cron = useApiData<{ items: CronJobRecord[] }>(
        useCallback(() => fetchCronJobs(), []),
        { pollMs: 30000 },
    );
    const items = cron.data?.items ?? [];
    const active = items.filter(j => j.enabled);

    return (
        <View style={s.safe} >
            <GCHeader
                eyebrow="Automation"
                title="Scheduled Jobs"
                subtitle={cron.data ? `${active.length} active · ${items.length} total` : 'Loading…'}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView
                contentContainerStyle={s.content}
                refreshControl={
                    <RefreshControl refreshing={cron.refreshing} onRefresh={cron.refresh}
                        tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard} />
                }
            >
                {/* Info about what's available */}
                <GCCard style={s.infoCard}>
                    <View style={s.infoIcon}>
                        <Ionicons name="time" size={24} color={colors.ember} />
                    </View>
                    <Text style={s.infoTitle}>SCHEDULED AUTOMATION</Text>
                    <Text style={s.infoDesc}>
                        View cron jobs and scheduled tasks managed by your GoatCitadel gateway.
                        New jobs are configured from Mission Control on desktop.
                    </Text>
                </GCCard>

                {/* Cron Jobs List */}
                {cron.error ? (
                    <GCCard>
                        <Text style={s.errorText}>Could not load jobs: {cron.error}</Text>
                    </GCCard>
                ) : items.length === 0 && !cron.loading ? (
                    <GCCard>
                        <View style={s.emptyState}>
                            <Ionicons name="time-outline" size={48} color={colors.textDim} />
                            <Text style={s.emptyText}>No scheduled jobs configured.</Text>
                            <Text style={s.emptySubtext}>
                                Configure cron jobs from Mission Control's Cron page on desktop.
                            </Text>
                        </View>
                    </GCCard>
                ) : (
                    items.map((job) => (
                        <GCCard key={job.jobId} style={s.jobCard}>
                            <View style={s.jobHeader}>
                                <View style={s.jobHeaderLeft}>
                                    <View style={[s.dotIndicator, { backgroundColor: job.enabled ? colors.success : colors.textDim }]} />
                                    <Text style={s.jobLabel}>{job.label || job.jobId}</Text>
                                </View>
                                <GCStatusChip tone={job.enabled ? 'success' : 'muted'}>
                                    {job.enabled ? 'ACTIVE' : 'PAUSED'}
                                </GCStatusChip>
                            </View>
                            {job.schedule ? (
                                <Text style={s.jobSchedule}>{job.schedule}</Text>
                            ) : null}
                            {job.lastRunAt ? (
                                <Text style={s.jobMeta}>
                                    Last run: {new Date(job.lastRunAt).toLocaleString()}
                                    {job.lastRunStatus ? ` · ${job.lastRunStatus}` : ''}
                                </Text>
                            ) : (
                                <Text style={s.jobMeta}>Never run</Text>
                            )}
                        </GCCard>
                    ))
                )}

                <View style={{ height: 32 }} />
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 32 },
    infoCard: { marginBottom: spacing.lg },
    infoIcon: { marginBottom: spacing.sm },
    infoTitle: { ...typography.eyebrow, color: colors.ember, marginBottom: spacing.xs },
    infoDesc: { ...typography.bodyMd, color: colors.textMuted },
    jobCard: { marginBottom: spacing.md },
    jobHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 4,
    },
    jobHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    dotIndicator: { width: 8, height: 8, borderRadius: 4 },
    jobLabel: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600', flex: 1 },
    jobSchedule: {
        ...typography.caption, color: colors.cyan, fontFamily: 'monospace',
        marginBottom: 4,
    },
    jobMeta: { ...typography.caption, color: colors.textDim },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
    emptyText: { ...typography.bodyMd, color: colors.textMuted },
    emptySubtext: { ...typography.caption, color: colors.textDim, textAlign: 'center', maxWidth: 240 },
    errorText: { ...typography.bodySm, color: colors.crimson },
});
