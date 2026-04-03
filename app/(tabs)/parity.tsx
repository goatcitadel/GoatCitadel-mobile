import React, { useMemo, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    exportBrowserProofLane,
    exportCompanionBootstrapBrief,
    exportExtensionSdkBrief,
    exportVoiceProofLane,
    fetchFollowOnParityReport,
    getCompanionSession,
} from '../../src/api/client';
import type {
    FollowOnParityEpicRecord,
    FollowOnParityEpicState,
    FollowOnParityReport,
    FollowOnProofLaneArtifactRecord,
} from '../../src/api/types';
import { GCButton, GCCard, GCHeader, GCStatusChip } from '../../src/components/ui';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';

type ExportLaneId = 'browser' | 'voice' | 'companion' | 'extensions';

const EPIC_ORDER = [
    'GC-P0-01',
    'GC-P0-02',
    'GC-P0-03',
    'GC-P0-05',
    'GC-P1-04',
    'GC-P0-06',
    'GC-P0-07',
    'GC-P1-08',
    'GC-P1-09',
    'GC-P1-10',
    'GC-P2-11',
    'GC-P2-12',
] as const;

export default function ParityScreen() {
    const router = useRouter();
    const bottomPad = useBottomInsetPadding(32);
    const [busyLane, setBusyLane] = useState<ExportLaneId | undefined>(undefined);
    const [actionError, setActionError] = useState<string | undefined>(undefined);
    const [artifacts, setArtifacts] = useState<Partial<Record<ExportLaneId, FollowOnProofLaneArtifactRecord>>>({});
    const hasCompanionSession = !!getCompanionSession();

    const parity = useApiData<FollowOnParityReport>(
        () => fetchFollowOnParityReport(),
        { pollMs: 30000 },
    );

    const epics = useMemo(() => {
        const byId = new Map((parity.data?.epics ?? []).map((epic) => [epic.epicId, epic]));
        const ordered = EPIC_ORDER
            .map((epicId) => byId.get(epicId))
            .filter((epic): epic is FollowOnParityEpicRecord => Boolean(epic));
        const remaining = (parity.data?.epics ?? []).filter((epic) => !EPIC_ORDER.includes(epic.epicId as typeof EPIC_ORDER[number]));
        return [...ordered, ...remaining];
    }, [parity.data?.epics]);

    const onRefresh = async () => {
        await parity.refresh();
    };

    const runExport = async (
        lane: ExportLaneId,
        exporter: () => Promise<FollowOnProofLaneArtifactRecord>,
    ) => {
        setBusyLane(lane);
        setActionError(undefined);
        try {
            const artifact = await exporter();
            setArtifacts((current) => ({ ...current, [lane]: artifact }));
            await parity.refresh();
        } catch (error) {
            setActionError((error as Error).message || `Unable to export ${lane} artifact.`);
        } finally {
            setBusyLane(undefined);
        }
    };

    const report = parity.data;
    const epicStateById = useMemo(
        () => new Map(epics.map((epic) => [epic.epicId, epic.state])),
        [epics],
    );
    const latestBrowserArtifact = artifacts.browser ?? report?.browser.latestArtifact;
    const latestVoiceArtifact = artifacts.voice ?? report?.voice.latestArtifact;
    const latestCompanionArtifact = artifacts.companion ?? report?.companion.latestArtifact;
    const latestExtensionArtifact = artifacts.extensions ?? report?.plugins.latestArtifact;

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Follow-On"
                title="Parity Lanes"
                subtitle="Browser, voice, companion, and extension proof surfaces"
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
                refreshControl={
                    <RefreshControl
                        refreshing={parity.refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.cyan}
                        colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                }
            >
                <GCCard style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionHeaderCopy}>
                            <Text style={styles.sectionTitle}>CONTROL BOARD</Text>
                            <Text style={styles.sectionSubtitle}>
                                Live parity status from the gateway-backed follow-on report.
                            </Text>
                        </View>
                        <GCStatusChip tone={report ? 'live' : 'muted'}>
                            {report ? 'LIVE' : 'LOADING'}
                        </GCStatusChip>
                    </View>
                    {report ? (
                        <>
                            <Text style={styles.copy}>
                                Deployment `{report.deploymentProfile}` · auth `{report.authMode}` · generated{' '}
                                {new Date(report.generatedAt).toLocaleString()}
                            </Text>
                            <View style={styles.metaGrid}>
                                <MetaStat label="Add-ons" value={String(report.addons.catalogCount)} />
                                <MetaStat label="Installed" value={String(report.addons.installedCount)} />
                                <MetaStat label="Plugins" value={String(report.plugins.totalCount)} />
                                <MetaStat label="Voice" value={report.voice.runtimeReadiness} />
                            </View>
                        </>
                    ) : (
                        <Text style={styles.emptyText}>
                            {parity.error || 'Loading live parity report...'}
                        </Text>
                    )}
                </GCCard>

                {report ? (
                    <>
                        <ParityCard
                            icon="globe-outline"
                            title="Browser"
                            subtitle={report.browser.guardrailSummary}
                            state={epicStateById.get('GC-P0-06') ?? 'partial'}
                            metrics={[
                                { label: 'Tools', value: String(report.browser.totalToolCount) },
                                { label: 'Read', value: String(report.browser.readToolCount) },
                                { label: 'Control', value: String(report.browser.controlToolCount) },
                            ]}
                            blockers={report.browser.blockingIssues}
                            actions={report.browser.recommendedActions}
                            artifact={latestBrowserArtifact}
                            buttonTitle={busyLane === 'browser' ? 'Exporting…' : 'Export Browser Lane'}
                            onPress={() => void runExport('browser', exportBrowserProofLane)}
                            disabled={busyLane !== undefined}
                        />

                        <ParityCard
                            icon="mic-outline"
                            title="Voice"
                            subtitle={`Talk ${report.voice.talkState} · wake ${report.voice.wakeState} · model ${report.voice.selectedModelId || 'unset'}`}
                            state={epicStateById.get('GC-P2-12') ?? (report.voice.runtimeReadiness === 'ready' ? 'have_foundation' : 'partial')}
                            metrics={[
                                { label: 'Runtime', value: report.voice.runtimeReadiness },
                                { label: 'Talk', value: report.voice.talkState },
                                { label: 'Wake', value: report.voice.wakeEnabled ? 'enabled' : 'disabled' },
                            ]}
                            blockers={report.voice.lastError
                                ? [report.voice.lastError, ...report.voice.blockingIssues, ...report.voice.recoveryActions]
                                : [...report.voice.blockingIssues, ...report.voice.recoveryActions]}
                            actions={report.voice.recommendedActions}
                            artifact={latestVoiceArtifact}
                            buttonTitle={busyLane === 'voice' ? 'Exporting…' : 'Export Voice Lane'}
                            onPress={() => void runExport('voice', exportVoiceProofLane)}
                            disabled={busyLane !== undefined}
                        />

                        <ParityCard
                            icon="phone-portrait-outline"
                            title="Companion"
                            subtitle={report.companion.paritySummary}
                            state={epicStateById.get('GC-P1-08') ?? (hasCompanionSession ? 'have_foundation' : 'partial')}
                            metrics={[
                                { label: 'Session', value: hasCompanionSession ? 'signed' : 'missing' },
                                { label: 'Targets', value: String(report.companion.platformTargets.length) },
                                { label: 'Surface', value: report.canvas.contract?.operatorSurface || 'mission_control' },
                            ]}
                            blockers={report.companion.blockingIssues}
                            actions={report.companion.recommendedActions}
                            artifact={latestCompanionArtifact}
                            buttonTitle={busyLane === 'companion' ? 'Exporting…' : 'Export Companion Brief'}
                            onPress={() => void runExport('companion', exportCompanionBootstrapBrief)}
                            disabled={busyLane !== undefined}
                            secondaryAction={(
                                <GCButton
                                    title="Open Canvas"
                                    onPress={() => router.push('/(tabs)/canvas' as any)}
                                    variant="ghost"
                                    size="sm"
                                />
                            )}
                        />

                        <ParityCard
                            icon="extension-puzzle-outline"
                            title="Extensions"
                            subtitle={report.plugins.sdkSummary}
                            state={epicStateById.get('GC-P2-11') ?? (report.plugins.totalCount > 0 ? 'have_foundation' : 'partial')}
                            metrics={[
                                { label: 'Plugins', value: String(report.plugins.totalCount) },
                                { label: 'Enabled', value: String(report.plugins.enabledCount) },
                                { label: 'Running', value: String(report.addons.runningCount) },
                            ]}
                            blockers={report.plugins.blockingIssues}
                            actions={report.plugins.recommendedActions}
                            artifact={latestExtensionArtifact}
                            buttonTitle={busyLane === 'extensions' ? 'Exporting…' : 'Export SDK Brief'}
                            onPress={() => void runExport('extensions', exportExtensionSdkBrief)}
                            disabled={busyLane !== undefined}
                        />

                        <GCCard style={styles.section}>
                            <Text style={styles.sectionTitle}>TRANCHES</Text>
                            <Text style={styles.sectionSubtitle}>
                                The next slices currently exposed by the live parity report.
                            </Text>
                            <View style={styles.epicList}>
                                {epics.map((epic) => (
                                    <View key={epic.epicId} style={styles.epicCard}>
                                        <View style={styles.epicHeader}>
                                            <View style={styles.epicHeaderCopy}>
                                                <Text style={styles.epicTitle}>{epic.label}</Text>
                                                <Text style={styles.epicId}>{epic.epicId}</Text>
                                            </View>
                                            <GCStatusChip tone={toneForState(epic.state)}>
                                                {epic.state.replace('_', ' ').toUpperCase()}
                                            </GCStatusChip>
                                        </View>
                                        <Text style={styles.copy}>{epic.summary}</Text>
                                        <Text style={styles.nextSliceLabel}>Next slice</Text>
                                        <Text style={styles.nextSliceValue}>{epic.nextSlice}</Text>
                                    </View>
                                ))}
                            </View>
                        </GCCard>
                    </>
                ) : null}

                {actionError ? (
                    <GCCard variant="warning" style={styles.section}>
                        <Text style={styles.sectionTitle}>EXPORT ERROR</Text>
                        <Text style={styles.copy}>{actionError}</Text>
                    </GCCard>
                ) : null}
            </ScrollView>
        </View>
    );
}

function ParityCard(props: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    state: FollowOnParityEpicState;
    metrics: Array<{ label: string; value: string }>;
    blockers: string[];
    actions: string[];
    artifact?: FollowOnProofLaneArtifactRecord;
    buttonTitle: string;
    onPress: () => void;
    disabled?: boolean;
    secondaryAction?: React.ReactNode;
}) {
    return (
        <GCCard style={styles.section}>
            <View style={styles.sectionHeaderRow}>
                <View style={styles.titleRow}>
                    <View style={styles.iconCircle}>
                        <Ionicons name={props.icon} size={18} color={colors.cyan} />
                    </View>
                    <View style={styles.sectionHeaderCopy}>
                        <Text style={styles.sectionTitle}>{props.title}</Text>
                        <Text style={styles.sectionSubtitle}>{props.subtitle}</Text>
                    </View>
                </View>
                <GCStatusChip tone={toneForState(props.state)}>
                    {props.state.replace('_', ' ').toUpperCase()}
                </GCStatusChip>
            </View>

            <View style={styles.metaGrid}>
                {props.metrics.map((metric) => (
                    <MetaStat key={`${props.title}:${metric.label}`} label={metric.label} value={metric.value} />
                ))}
            </View>

            {props.blockers.length > 0 ? (
                <>
                    <Text style={styles.groupLabel}>Blocking issues</Text>
                    {props.blockers.slice(0, 3).map((item) => (
                        <Text key={`${props.title}:blocker:${item}`} style={styles.bulletText}>- {item}</Text>
                    ))}
                </>
            ) : null}

            {props.actions.length > 0 ? (
                <>
                    <Text style={styles.groupLabel}>Recommended actions</Text>
                    {props.actions.slice(0, 3).map((item) => (
                        <Text key={`${props.title}:action:${item}`} style={styles.bulletText}>- {item}</Text>
                    ))}
                </>
            ) : null}

            <View style={styles.buttonRow}>
                <GCButton
                    title={props.buttonTitle}
                    onPress={props.onPress}
                    variant="primary"
                    size="sm"
                    disabled={props.disabled}
                />
                {props.secondaryAction}
            </View>

            {props.artifact ? (
                <View style={styles.artifactCard}>
                    <Text style={styles.artifactTitle}>Latest export</Text>
                    <Text style={styles.artifactPath}>{props.artifact.relativePath}</Text>
                    <Text style={styles.artifactSummary}>{props.artifact.summary}</Text>
                </View>
            ) : null}
        </GCCard>
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

function toneForState(state: FollowOnParityEpicState): 'live' | 'warning' | 'muted' {
    switch (state) {
    case 'have_foundation':
        return 'live';
    case 'partial':
        return 'warning';
    default:
        return 'muted';
    }
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
    sectionHeaderCopy: { flex: 1 },
    titleRow: { flexDirection: 'row', gap: spacing.md, flex: 1 },
    iconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.cyanGlow,
    },
    sectionTitle: { ...typography.eyebrow, color: colors.textDim, marginBottom: 4 },
    sectionSubtitle: { ...typography.caption, color: colors.textDim },
    copy: { ...typography.bodySm, color: colors.textSecondary, lineHeight: 20 },
    emptyText: { ...typography.bodySm, color: colors.textDim },
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
    groupLabel: {
        ...typography.caption,
        color: colors.textMuted,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
    },
    bulletText: { ...typography.bodySm, color: colors.textSecondary, marginBottom: 6 },
    buttonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    artifactCard: {
        marginTop: spacing.md,
        padding: spacing.md,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderDefault,
        backgroundColor: colors.bgPanelSolid,
    },
    artifactTitle: { ...typography.caption, color: colors.textDim, marginBottom: 4 },
    artifactPath: { ...typography.bodySm, color: colors.textPrimary, marginBottom: 4 },
    artifactSummary: { ...typography.caption, color: colors.textSecondary },
    epicList: { gap: spacing.sm, marginTop: spacing.sm },
    epicCard: {
        padding: spacing.md,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderDefault,
        backgroundColor: colors.bgPanelSolid,
    },
    epicHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    epicHeaderCopy: { flex: 1 },
    epicTitle: { ...typography.bodyMd, color: colors.textPrimary, marginBottom: 2 },
    epicId: { ...typography.caption, color: colors.textDim },
    nextSliceLabel: {
        ...typography.caption,
        color: colors.textMuted,
        marginTop: spacing.md,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    nextSliceValue: { ...typography.bodySm, color: colors.textPrimary, lineHeight: 18 },
});
