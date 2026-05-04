import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AdaptiveContainer, SectionGrid } from '../../src/components/layout';
import { GCButton, GCCard, GCHeader, GCStatusChip } from '../../src/components/ui';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useApiData } from '../../src/hooks/useApiData';
import {
    fetchChatGeneratedArtifacts,
    fetchChatProjects,
    fetchFilesList,
    fetchInstalledAddons,
    fetchIntegrationConnections,
    fetchMemoryFiles,
    fetchMemoryItems,
    fetchToolCatalog,
    fetchWorkspaces,
} from '../../src/api/client';
import {
    MISSION_AREAS,
    MISSION_ROUTES,
    getMissionRoute,
    getMissionRoutesByArea,
    type MissionArea,
    type MissionRoute,
} from '../../src/navigation/missionRoutes';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';

const AREA_ORDER: MissionArea[] = ['projects', 'library', 'ops', 'settings', 'chat', 'cowork', 'code'];

export default function MissionDirectoryScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ area?: string; section?: string }>();
    const bottomPad = useBottomInsetPadding(32);
    const selected = useMemo(() => {
        const area = normalizeArea(params.area);
        if (!area || !params.section) {
            return undefined;
        }
        return getMissionRoute(area, String(params.section));
    }, [params.area, params.section]);

    const selectedArea = selected?.area ?? normalizeArea(params.area) ?? 'library';
    const areaMeta = MISSION_AREAS[selectedArea];

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow={areaMeta.kicker}
                title={selected ? selected.label : 'Mission Directory'}
                subtitle={selected ? selected.description : 'Mobile destinations mapped to Mission Control Next.'}
                accentColor={areaMeta.color}
            />
            <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
                <AdaptiveContainer style={styles.content}>
                    {selected ? (
                        <SelectedRouteCard route={selected} />
                    ) : (
                        <GCCard accent accentColor={areaMeta.color} style={styles.introCard}>
                            <Text style={styles.sectionTitle}>Parity ledger</Text>
                            <Text style={styles.sectionBody}>
                                Every Mission Control Next area and section has a mobile destination here. Native mobile
                                screens open directly; deeper desktop editors remain visible as summary lanes instead of
                                disappearing from the app.
                            </Text>
                        </GCCard>
                    )}

                    <View style={styles.areaStack}>
                        {AREA_ORDER.map((area) => (
                            <AreaSection key={area} area={area} selectedId={selected?.id} />
                        ))}
                    </View>
                </AdaptiveContainer>
            </ScrollView>
        </View>
    );
}

function AreaSection({ area, selectedId }: { area: MissionArea; selectedId?: string }) {
    const meta = MISSION_AREAS[area];
    const routes = getMissionRoutesByArea(area);

    return (
        <View style={styles.areaSection}>
            <View style={styles.areaHead}>
                <View style={[styles.areaMark, { backgroundColor: meta.color }]} />
                <View style={styles.areaCopy}>
                    <Text style={styles.areaKicker}>{meta.kicker}</Text>
                    <Text style={styles.areaTitle}>{meta.label}</Text>
                    <Text style={styles.areaDescription}>{meta.description}</Text>
                </View>
            </View>
            <SectionGrid minItemWidthPhone={160} minItemWidthTablet={220}>
                {routes.map((route) => (
                    <MissionTile key={route.id} route={route} active={route.id === selectedId} />
                ))}
            </SectionGrid>
        </View>
    );
}

function MissionTile({ route, active }: { route: MissionRoute; active?: boolean }) {
    const router = useRouter();
    const meta = MISSION_AREAS[route.area];
    const tone = route.status === 'mobile-native' ? 'live' : route.status === 'mobile-summary' ? 'warning' : 'muted';

    return (
        <Pressable
            style={({ pressed }) => [
                styles.tile,
                active && { borderColor: meta.color, backgroundColor: colors.bgCardElevated },
                pressed && styles.pressed,
            ]}
            onPress={() => router.push(route.mobileRoute as any)}
        >
            <View style={styles.tileTop}>
                <View style={[styles.tileIcon, { borderColor: `${meta.color}66` }]}>
                    <Ionicons name={iconForArea(route.area)} size={16} color={meta.color} />
                </View>
                <GCStatusChip tone={tone}>{labelForStatus(route.status)}</GCStatusChip>
            </View>
            <Text style={styles.tileTitle}>{route.label}</Text>
            <Text style={styles.tileBody}>{route.description}</Text>
        </Pressable>
    );
}

function SelectedRouteCard({ route }: { route: MissionRoute }) {
    const router = useRouter();
    const meta = MISSION_AREAS[route.area];
    const summary = useApiData(
        React.useCallback(() => fetchRouteSummary(route), [route]),
        { enabled: route.status !== 'mobile-native' },
    );
    return (
        <GCCard accent accentColor={meta.color} style={styles.selectedCard}>
            <View style={styles.selectedHead}>
                <View style={[styles.selectedIcon, { borderColor: `${meta.color}66` }]}>
                    <Ionicons name={iconForArea(route.area)} size={18} color={meta.color} />
                </View>
                <View style={styles.selectedCopy}>
                    <Text style={styles.sectionTitle}>{meta.label} / {route.label}</Text>
                    <Text style={styles.sectionBody}>{route.description}</Text>
                </View>
            </View>
            <View style={styles.statusRow}>
                <GCStatusChip tone={route.status === 'mobile-native' ? 'live' : route.status === 'mobile-summary' ? 'warning' : 'muted'}>
                    {labelForStatus(route.status)}
                </GCStatusChip>
                <Text style={styles.statusCopy}>
                    {route.status === 'mobile-native'
                        ? 'This section has a direct mobile surface.'
                        : route.status === 'mobile-summary'
                            ? 'This section is represented on mobile with summary/navigation coverage.'
                            : 'Desktop has deeper editors; mobile keeps the lane visible and linked for parity.'}
                </Text>
            </View>
            {summary.data && summary.data.length > 0 ? (
                <View style={styles.metricRow}>
                    {summary.data.map((item) => (
                        <View key={item.label} style={styles.metricTile}>
                            <Text style={styles.metricValue}>{item.value}</Text>
                            <Text style={styles.metricLabel}>{item.label}</Text>
                        </View>
                    ))}
                </View>
            ) : route.status !== 'mobile-native' && summary.error ? (
                <Text style={styles.statusCopy}>Summary data is not available from this gateway yet: {summary.error}</Text>
            ) : route.status !== 'mobile-native' && summary.loading ? (
                <Text style={styles.statusCopy}>Loading mobile summary...</Text>
            ) : null}
            <View style={styles.actionRow}>
                {route.availableRoute ? (
                    <GCButton title="Open Mobile Surface" variant="primary" onPress={() => router.push(route.availableRoute as any)} />
                ) : null}
                <GCButton title="Back to Directory" variant="secondary" onPress={() => router.push('/(tabs)/mission' as any)} />
            </View>
        </GCCard>
    );
}

async function fetchRouteSummary(route: MissionRoute): Promise<Array<{ label: string; value: string }>> {
    if (route.area === 'projects') {
        const [projects, workspaces] = await Promise.all([fetchChatProjects('active', 120), fetchWorkspaces('active', 120)]);
        return [
            { label: 'Projects', value: String(projects.items.length) },
            { label: 'Workspaces', value: String(workspaces.items.length) },
        ];
    }
    if (route.section === 'memory' || route.section === 'knowledge') {
        const [files, items] = await Promise.all([fetchMemoryFiles(), fetchMemoryItems({ limit: 80 })]);
        return [
            { label: 'Memory files', value: String(files.items.length) },
            { label: 'Items', value: String(items.items.length) },
        ];
    }
    if (route.section === 'files') {
        const files = await fetchFilesList('.', 120);
        return [{ label: 'Files', value: String(files.items.length) }];
    }
    if (route.section === 'artifacts' || route.section === 'prompt-packs') {
        const artifacts = await fetchChatGeneratedArtifacts({ limit: 120 });
        return [{ label: 'Artifacts', value: String(artifacts.items.length) }];
    }
    if (route.section === 'tools') {
        const tools = await fetchToolCatalog();
        return [{ label: 'Tools', value: String(tools.items.length) }];
    }
    if (route.section === 'addons') {
        const addons = await fetchInstalledAddons();
        return [{ label: 'Installed', value: String(addons.items.length) }];
    }
    if (route.section === 'integrations' || route.section === 'channels') {
        const connections = await fetchIntegrationConnections(route.section === 'channels' ? 'channel' : undefined);
        return [{ label: 'Connections', value: String(connections.items.length) }];
    }
    if (route.section === 'workspaces') {
        const workspaces = await fetchWorkspaces('all', 120);
        return [{ label: 'Workspaces', value: String(workspaces.items.length) }];
    }
    return [];
}

function normalizeArea(value: string | string[] | undefined): MissionArea | undefined {
    const next = Array.isArray(value) ? value[0] : value;
    return next && next in MISSION_AREAS ? (next as MissionArea) : undefined;
}

function labelForStatus(status: MissionRoute['status']) {
    if (status === 'mobile-native') return 'Native';
    if (status === 'mobile-summary') return 'Summary';
    return 'Desktop deep edit';
}

function iconForArea(area: MissionArea): keyof typeof Ionicons.glyphMap {
    switch (area) {
        case 'chat': return 'chatbubbles';
        case 'cowork': return 'git-network';
        case 'code': return 'code-slash';
        case 'projects': return 'folder-open';
        case 'library': return 'library';
        case 'ops': return 'pulse';
        case 'settings': return 'options';
        default: return 'grid';
    }
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingTop: spacing.lg, gap: spacing.lg },
    introCard: { gap: spacing.xs },
    selectedCard: { gap: spacing.md },
    selectedHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    selectedIcon: {
        width: 38,
        height: 38,
        borderRadius: radii.md,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgPanelElevated,
    },
    selectedCopy: { flex: 1, gap: spacing.xs },
    sectionTitle: { ...typography.displaySm, color: colors.textPrimary },
    sectionBody: { ...typography.bodySm, color: colors.textSecondary },
    statusRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
    statusCopy: { ...typography.caption, color: colors.textMuted, flex: 1, minWidth: 180 },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    metricTile: {
        minWidth: 96,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.borderDefault,
        borderRadius: radii.sm,
        backgroundColor: colors.bgPanelElevated,
    },
    metricValue: { ...typography.displaySm, color: colors.textPrimary },
    metricLabel: { ...typography.caption, color: colors.textMuted },
    areaStack: { gap: spacing.xl },
    areaSection: { gap: spacing.md },
    areaHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    areaMark: { width: 4, alignSelf: 'stretch', borderRadius: radii.pill },
    areaCopy: { flex: 1, gap: 2 },
    areaKicker: { ...typography.eyebrow, color: colors.textMuted },
    areaTitle: { ...typography.displayMd, color: colors.textPrimary },
    areaDescription: { ...typography.bodySm, color: colors.textMuted },
    tile: {
        minHeight: 138,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderDefault,
        borderRadius: radii.md,
        backgroundColor: colors.bgCard,
        gap: spacing.sm,
    },
    pressed: { opacity: 0.72, backgroundColor: colors.bgPanelElevated },
    tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    tileIcon: {
        width: 30,
        height: 30,
        borderRadius: radii.sm,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgPanelElevated,
    },
    tileTitle: { ...typography.displaySm, color: colors.textPrimary },
    tileBody: { ...typography.caption, color: colors.textMuted },
});
