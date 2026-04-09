/**
 * GoatCitadel Mobile — Workflows Screen
 * Read-only view of cron and scheduled jobs from the backend.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    AdaptiveContainer,
    ContextPane,
    MasterDetailShell,
    SectionGrid,
} from '../../src/components/layout';
import { GCCard, GCHeader, GCStatusChip, GCButton, GCStatCard } from '../../src/components/ui';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { fetchCronJobs } from '../../src/api/client';
import type { CronJobRecord } from '../../src/api/types';

export default function WorkflowsScreen() {
    const router = useRouter();
    const layout = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const [selectedJobId, setSelectedJobId] = useState<string | undefined>(undefined);
    const cron = useApiData<{ items: CronJobRecord[] }>(
        useCallback(() => fetchCronJobs(), []),
        { pollMs: 30000 },
    );
    const items = cron.data?.items ?? [];
    const active = items.filter((job) => job.enabled);
    const selectedJob = items.find((job) => job.jobId === selectedJobId) ?? items[0];

    useEffect(() => {
        if (!layout.dualPane) {
            return;
        }
        if (items.length > 0 && !selectedJobId) {
            setSelectedJobId(items[0].jobId);
        } else if (selectedJobId && !items.some((job) => job.jobId === selectedJobId)) {
            setSelectedJobId(items[0]?.jobId);
        }
    }, [items, layout.dualPane, selectedJobId]);

    const listComponent = (
        <ContextPane style={styles.listPane}>
            <FlatList
                data={items}
                keyExtractor={(item) => item.jobId}
                renderItem={({ item }) => {
                    const selected = layout.dualPane && item.jobId === selectedJob?.jobId;
                    return (
                        <Pressable
                            style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
                            onPress={() => {
                                if (layout.dualPane) {
                                    setSelectedJobId(item.jobId);
                                }
                            }}
                        >
                            <View style={[styles.dotIndicator, { backgroundColor: item.enabled ? colors.success : colors.textDim }]} />
                            <View style={styles.rowContent}>
                                <Text style={styles.rowLabel}>{item.name || item.jobId}</Text>
                                {item.schedule ? <Text style={styles.rowSchedule}>{item.schedule}</Text> : null}
                                <Text style={styles.rowMeta}>
                                    {item.lastRunAt ? `Last run ${new Date(item.lastRunAt).toLocaleString()}` : 'Never run'}
                                </Text>
                            </View>
                            <GCStatusChip tone={item.enabled ? 'success' : 'muted'}>
                                {item.enabled ? 'ACTIVE' : 'PAUSED'}
                            </GCStatusChip>
                        </Pressable>
                    );
                }}
                refreshControl={(
                    <RefreshControl
                        refreshing={cron.refreshing}
                        onRefresh={cron.refresh}
                        tintColor={colors.cyan}
                        colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                )}
                contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
                ListEmptyComponent={(
                    <View style={styles.emptyState}>
                        <Ionicons name="time-outline" size={48} color={colors.textDim} />
                        <Text style={styles.emptyText}>{cron.error || 'No scheduled jobs configured.'}</Text>
                        <Text style={styles.emptySubtext}>
                            Configure cron jobs from Mission Control on desktop.
                        </Text>
                    </View>
                )}
            />
        </ContextPane>
    );

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Automation"
                title="Scheduled Jobs"
                subtitle={cron.data ? `${active.length} active · ${items.length} total` : 'Loading…'}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />

            <AdaptiveContainer style={styles.content}>
                <SectionGrid style={styles.kpiGrid} minItemWidthPhone={140} minItemWidthTablet={220}>
                    <GCStatCard label="Active" value={String(active.length)} tone="default" />
                    <GCStatCard label="Total" value={String(items.length)} tone="default" />
                    <GCStatCard
                        label="Last run"
                        value={items[0]?.lastRunAt ? new Date(items[0].lastRunAt).toLocaleDateString() : '—'}
                        tone="default"
                    />
                </SectionGrid>

                <GCCard style={styles.infoCard}>
                    <View style={styles.infoIcon}>
                        <Ionicons name="time" size={24} color={colors.ember} />
                    </View>
                    <Text style={styles.infoTitle}>SCHEDULED AUTOMATION</Text>
                    <Text style={styles.infoDesc}>
                        View cron jobs and scheduled tasks managed by your GoatCitadel gateway.
                        New jobs are configured from Mission Control on desktop.
                    </Text>
                </GCCard>

                {layout.dualPane ? (
                    <MasterDetailShell
                        style={styles.shell}
                        master={listComponent}
                        detail={(
                            <ContextPane style={styles.detailPane}>
                                <Text style={styles.sectionTitle}>JOB DETAIL</Text>
                                {selectedJob ? (
                                    <>
                                        <Text style={styles.detailTitle}>{selectedJob.name || selectedJob.jobId}</Text>
                                        <View style={styles.detailMetaGrid}>
                                            <MetaCard label="Schedule" value={selectedJob.schedule || 'n/a'} mono />
                                            <MetaCard label="Updated" value={selectedJob.updatedAt ? new Date(selectedJob.updatedAt).toLocaleString() : 'n/a'} />
                                            <MetaCard label="Last run" value={selectedJob.lastRunAt ? new Date(selectedJob.lastRunAt).toLocaleString() : 'Never'} />
                                        </View>
                                        <GCStatusChip tone={selectedJob.enabled ? 'success' : 'muted'}>
                                            {selectedJob.enabled ? 'ACTIVE' : 'PAUSED'}
                                        </GCStatusChip>
                                    </>
                                ) : (
                                    <View style={styles.emptyDetail}>
                                        <Ionicons name="time-outline" size={34} color={colors.textDim} />
                                        <Text style={styles.emptyDetailTitle}>Select a workflow</Text>
                                        <Text style={styles.emptyDetailText}>
                                            Tablet keeps job timing visible while the full automation roster remains in view.
                                        </Text>
                                    </View>
                                )}
                            </ContextPane>
                        )}
                    />
                ) : listComponent}
            </AdaptiveContainer>
        </View>
    );
}

function MetaCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>{label}</Text>
            <Text style={[styles.metaValue, mono && styles.metaValueMono]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { flex: 1, paddingBottom: spacing.lg },
    kpiGrid: { marginBottom: spacing.md },
    infoCard: { marginBottom: spacing.lg },
    infoIcon: { marginBottom: spacing.sm },
    infoTitle: { ...typography.eyebrow, color: colors.ember, marginBottom: spacing.xs },
    infoDesc: { ...typography.bodyMd, color: colors.textMuted },
    shell: { flex: 1 },
    listPane: { flex: 1, padding: 0, overflow: 'hidden' },
    list: { paddingVertical: spacing.sm },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    rowSelected: { backgroundColor: colors.cyanMuted },
    rowPressed: { backgroundColor: colors.bgPanelSolid },
    dotIndicator: { width: 8, height: 8, borderRadius: 4 },
    rowContent: { flex: 1, minWidth: 0 },
    rowLabel: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    rowSchedule: { ...typography.caption, color: colors.cyan, fontFamily: 'monospace', marginTop: 2 },
    rowMeta: { ...typography.caption, color: colors.textDim, marginTop: 2 },
    detailPane: { gap: spacing.lg },
    sectionTitle: { ...typography.eyebrow, color: colors.textPrimary },
    detailTitle: { ...typography.displayMd, color: colors.textPrimary },
    detailMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    metaCard: {
        minWidth: 140,
        flexGrow: 1,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        padding: spacing.sm,
        gap: 2,
    },
    metaLabel: { ...typography.caption, color: colors.textDim },
    metaValue: { ...typography.bodySm, color: colors.textPrimary },
    metaValueMono: { fontFamily: 'monospace', fontSize: 11 },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
    emptyText: { ...typography.bodyMd, color: colors.textMuted },
    emptySubtext: { ...typography.caption, color: colors.textDim, textAlign: 'center', maxWidth: 240 },
    emptyDetail: {
        minHeight: 220,
        backgroundColor: colors.bgInset,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        gap: spacing.sm,
    },
    emptyDetailTitle: { ...typography.displaySm, color: colors.textPrimary, textAlign: 'center' },
    emptyDetailText: { ...typography.bodySm, color: colors.textDim, textAlign: 'center' },
});
