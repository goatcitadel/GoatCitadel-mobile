/**
 * GoatCitadel Mobile — System Logs Screen
 * Real-time log viewer with severity filtering and auto-scroll.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    AdaptiveContainer,
    ContextPane,
    MasterDetailShell,
} from '../../src/components/layout';
import { GCHeader, GCButton, PulseDot, GCStatusChip } from '../../src/components/ui';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import type { RealtimeEvent } from '../../src/api/types';
import { getRealtimeEventMeta } from '../../src/utils/realtimeEvents';
import { useRealtimeEvents } from '../../src/context/RealtimeEventsContext';

type LogLevel = 'all' | 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
    id: string;
    level: LogLevel;
    message: string;
    source: string;
    timestamp: string;
}

function eventToLog(event: RealtimeEvent): LogEntry {
    const meta = getRealtimeEventMeta(event);
    return {
        id: event.eventId,
        level: meta.logLevel,
        message: `[${meta.canonicalType}] ${meta.body}`,
        source: event.source,
        timestamp: event.timestamp,
    };
}

const LEVEL_COLORS: Record<LogLevel, string> = {
    all: colors.textDim,
    info: colors.cyan,
    warn: colors.ember,
    error: colors.crimson,
    debug: colors.textMuted,
};

export default function LogsScreen() {
    const router = useRouter();
    const layout = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const [filter, setFilter] = useState<LogLevel>('all');
    const [autoScroll, setAutoScroll] = useState(true);
    const [selectedLogId, setSelectedLogId] = useState<string | undefined>(undefined);
    const listRef = useRef<any>(null);
    const { events, status, error, refreshSnapshot } = useRealtimeEvents();
    const logs = useMemo(() => events.map(eventToLog), [events]);
    const filtered = useMemo(
        () => filter === 'all' ? logs : logs.filter((log) => log.level === filter),
        [filter, logs],
    );
    const selectedLog = filtered.find((item) => item.id === selectedLogId) ?? filtered[0];
    const levels: LogLevel[] = ['all', 'info', 'warn', 'error', 'debug'];

    useEffect(() => {
        if (!autoScroll || filtered.length === 0) {
            return;
        }
        listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    }, [autoScroll, filtered.length]);

    useEffect(() => {
        if (!layout.dualPane) {
            return;
        }
        if (filtered.length > 0 && !selectedLogId) {
            setSelectedLogId(filtered[0].id);
        } else if (selectedLogId && !filtered.some((log) => log.id === selectedLogId)) {
            setSelectedLogId(filtered[0]?.id);
        }
    }, [filtered, layout.dualPane, selectedLogId]);

    const liveLabel = status === 'live'
        ? 'Live foreground SSE with resume'
        : status === 'connecting'
            ? 'Connecting realtime stream…'
            : 'Realtime stream degraded';

    const listComponent = (
        <ContextPane style={styles.listPane}>
            <FlashList
                ref={listRef}
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const selected = layout.dualPane && selectedLog?.id === item.id;
                    return (
                        <Pressable
                            style={({ pressed }) => [styles.logRow, selected && styles.logRowSelected, pressed && styles.logRowPressed]}
                            onPress={() => {
                                if (layout.dualPane) {
                                    setSelectedLogId(item.id);
                                }
                            }}
                        >
                            <View style={[styles.logLevelBar, { backgroundColor: LEVEL_COLORS[item.level] }]} />
                            <View style={styles.logContent}>
                                <View style={styles.logHeader}>
                                    <Text style={[styles.logLevel, { color: LEVEL_COLORS[item.level] }]}>
                                        {item.level.toUpperCase()}
                                    </Text>
                                    <Text style={styles.logTime}>{formatLogTime(item.timestamp)}</Text>
                                </View>
                                <Text style={styles.logMessage} numberOfLines={layout.dualPane ? 3 : 2}>
                                    {item.message}
                                </Text>
                            </View>
                        </Pressable>
                    );
                }}
                refreshControl={(
                    <RefreshControl
                        refreshing={status === 'connecting'}
                        onRefresh={refreshSnapshot}
                        tintColor={colors.cyan}
                        colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                )}
                contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
                removeClippedSubviews
                ListEmptyComponent={(
                    <View style={styles.empty}>
                        <Ionicons name="terminal-outline" size={48} color={colors.textDim} />
                        <Text style={styles.emptyText}>{error || 'No log entries. Waiting for system events...'}</Text>
                    </View>
                )}
            />
        </ContextPane>
    );

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Debug & Monitoring"
                title="System Logs"
                subtitle={`${filtered.length} entries · foreground SSE`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />

            <AdaptiveContainer style={styles.content}>
                <View style={styles.toolbar}>
                    <View style={styles.filterRow}>
                        {levels.map((level) => (
                            <Pressable
                                key={level}
                                style={[
                                    styles.levelPill,
                                    filter === level && {
                                        backgroundColor: `${LEVEL_COLORS[level]}33`,
                                        borderColor: LEVEL_COLORS[level],
                                    },
                                ]}
                                onPress={() => setFilter(level)}
                            >
                                <View style={[styles.levelDot, { backgroundColor: LEVEL_COLORS[level] }]} />
                                <Text style={[styles.levelText, filter === level && { color: LEVEL_COLORS[level] }]}>
                                    {level.toUpperCase()}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                    <Pressable
                        style={[styles.autoScrollBtn, autoScroll && styles.autoScrollActive]}
                        onPress={() => setAutoScroll(!autoScroll)}
                    >
                        <Ionicons
                            name={autoScroll ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                            size={16}
                            color={autoScroll ? colors.cyan : colors.textDim}
                        />
                        <Text style={[styles.autoScrollText, autoScroll && { color: colors.cyan }]}>AUTO</Text>
                    </Pressable>
                </View>

                <View style={styles.liveBar}>
                    <PulseDot color={status === 'live' ? colors.success : status === 'degraded' ? colors.ember : colors.textDim} size={5} />
                    <Text style={styles.liveText}>{liveLabel}</Text>
                </View>

                {layout.dualPane ? (
                    <MasterDetailShell
                        style={styles.shell}
                        master={listComponent}
                        detail={(
                            <ContextPane style={styles.detailPane}>
                                <View style={styles.detailHeader}>
                                    <Text style={styles.sectionTitle}>LOG CONTEXT</Text>
                                    <GCStatusChip tone={status === 'live' ? 'success' : status === 'degraded' ? 'warning' : 'muted'}>
                                        {status.toUpperCase()}
                                    </GCStatusChip>
                                </View>
                                <View style={styles.detailMetaGrid}>
                                    <MetaStat label="Filter" value={filter.toUpperCase()} />
                                    <MetaStat label="Auto-scroll" value={autoScroll ? 'ON' : 'OFF'} />
                                    <MetaStat label="Visible" value={String(filtered.length)} />
                                </View>
                                {selectedLog ? (
                                    <View style={styles.detailCard}>
                                        <Text style={[styles.detailLevel, { color: LEVEL_COLORS[selectedLog.level] }]}>
                                            {selectedLog.level.toUpperCase()}
                                        </Text>
                                        <Text style={styles.detailMessage}>{selectedLog.message}</Text>
                                        <View style={styles.detailMetaRow}>
                                            <Text style={styles.detailMetaText}>Source: {selectedLog.source}</Text>
                                            <Text style={styles.detailMetaText}>{new Date(selectedLog.timestamp).toLocaleString()}</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.emptyDetail}>
                                        <Ionicons name="terminal-outline" size={34} color={colors.textDim} />
                                        <Text style={styles.emptyDetailTitle}>Select a log entry</Text>
                                        <Text style={styles.emptyDetailText}>
                                            Tablet keeps the list live while the selected log stays readable beside it.
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

function MetaStat({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.metaStat}>
            <Text style={styles.metaStatLabel}>{label}</Text>
            <Text style={styles.metaStatValue}>{value}</Text>
        </View>
    );
}

function formatLogTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#040608' },
    content: { flex: 1, paddingBottom: spacing.lg },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        flex: 1,
    },
    levelPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: spacing.xs,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        backgroundColor: colors.bgInset,
    },
    levelDot: { width: 6, height: 6, borderRadius: 3 },
    levelText: { ...typography.caption, color: colors.textDim, fontSize: 9 },
    autoScrollBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.sm,
    },
    autoScrollActive: { backgroundColor: colors.cyanMuted },
    autoScrollText: { ...typography.caption, color: colors.textDim, fontSize: 9 },
    liveBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginBottom: spacing.md,
        backgroundColor: '#030506',
        borderRadius: radii.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderQuiet,
    },
    liveText: { ...typography.caption, color: colors.textSecondary, fontSize: 10 },
    shell: { flex: 1 },
    listPane: { flex: 1, padding: 0, overflow: 'hidden' },
    list: { paddingVertical: spacing.xs },
    logRow: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(62, 81, 101, 0.15)',
    },
    logRowSelected: { backgroundColor: colors.cyanMuted },
    logRowPressed: { backgroundColor: colors.bgPanelSolid },
    logLevelBar: { width: 3, alignSelf: 'stretch' },
    logContent: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    logLevel: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
    logTime: { fontFamily: 'monospace', fontSize: 9, color: colors.textDim },
    logMessage: { fontFamily: 'monospace', fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
    detailPane: { gap: spacing.lg },
    detailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
    },
    sectionTitle: { ...typography.eyebrow, color: colors.textPrimary },
    detailMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    metaStat: {
        minWidth: 110,
        flexGrow: 1,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        padding: spacing.sm,
    },
    metaStatLabel: { ...typography.caption, color: colors.textDim },
    metaStatValue: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
    detailCard: {
        backgroundColor: colors.bgInset,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    detailLevel: { ...typography.eyebrow },
    detailMessage: { ...typography.bodyMd, color: colors.textPrimary, fontFamily: 'monospace' },
    detailMetaRow: { gap: spacing.xs },
    detailMetaText: { ...typography.caption, color: colors.textDim },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim, textAlign: 'center', maxWidth: 280 },
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
