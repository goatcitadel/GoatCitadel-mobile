/**
 * GoatCitadel Mobile — Pulse / Live Event Stream
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    AdaptiveContainer,
    ContextPane,
    MasterDetailShell,
} from '../../src/components/layout';
import { GCHeader, GCButton, GCStatusChip } from '../../src/components/ui';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import type { RealtimeEvent } from '../../src/api/types';
import { getRealtimeEventMeta } from '../../src/utils/realtimeEvents';
import { useRealtimeEvents } from '../../src/context/RealtimeEventsContext';

export default function PulseScreen() {
    const router = useRouter();
    const layout = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);
    const { events, status, error, refreshSnapshot } = useRealtimeEvents();

    useEffect(() => {
        if (!layout.dualPane) {
            return;
        }
        if (events.length > 0 && !selectedEventId) {
            setSelectedEventId(events[0].eventId);
        } else if (selectedEventId && !events.some((event) => event.eventId === selectedEventId)) {
            setSelectedEventId(events[0]?.eventId);
        }
    }, [events, layout.dualPane, selectedEventId]);

    const selectedEvent = events.find((event) => event.eventId === selectedEventId) ?? events[0];
    const selectedMeta = selectedEvent ? getRealtimeEventMeta(selectedEvent) : undefined;
    const liveLabel = status === 'live'
        ? 'Live foreground SSE with resume'
        : status === 'connecting'
            ? 'Connecting realtime stream…'
            : 'Realtime stream degraded';

    const listComponent = (
        <ContextPane style={styles.listPane}>
            <FlashList
                data={events}
                keyExtractor={(event) => event.eventId}
                renderItem={({ item }) => {
                    const meta = getRealtimeEventMeta(item);
                    const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    });
                    const selected = layout.dualPane && item.eventId === selectedEvent?.eventId;

                    return (
                        <Pressable
                            style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
                            onPress={() => {
                                if (layout.dualPane) {
                                    setSelectedEventId(item.eventId);
                                }
                            }}
                        >
                            <View style={styles.iconBox}>
                                <Ionicons name={meta.icon} size={16} color={colors.cyan} />
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={styles.rowType}>{meta.title}</Text>
                                <Text style={styles.rowSource} numberOfLines={2}>{meta.body}</Text>
                            </View>
                            <Text style={styles.rowTime}>{timeStr}</Text>
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
                ListEmptyComponent={(
                    <View style={styles.empty}>
                        <Ionicons name="pulse-outline" size={48} color={colors.textDim} />
                        <Text style={styles.emptyText}>
                            {error || 'No events yet. Activity will appear here in real time.'}
                        </Text>
                    </View>
                )}
            />
        </ContextPane>
    );

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Live Feed"
                title="Pulse"
                subtitle={`${events.length} recent events`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />

            <AdaptiveContainer style={styles.content}>
                <View style={styles.liveBar}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>{liveLabel}</Text>
                </View>

                {layout.dualPane ? (
                    <MasterDetailShell
                        style={styles.shell}
                        master={listComponent}
                        detail={(
                            <ContextPane style={styles.detailPane}>
                                <View style={styles.detailHeader}>
                                    <Text style={styles.sectionTitle}>EVENT DETAIL</Text>
                                    <GCStatusChip tone={status === 'live' ? 'live' : status === 'degraded' ? 'warning' : 'muted'}>
                                        {status.toUpperCase()}
                                    </GCStatusChip>
                                </View>
                                {selectedEvent && selectedMeta ? (
                                    <>
                                        <Text style={styles.detailTitle}>{selectedMeta.title}</Text>
                                        <Text style={styles.detailBody}>{selectedMeta.body}</Text>
                                        <View style={styles.detailMeta}>
                                            <MetaPill label="Type" value={selectedMeta.canonicalType} />
                                            <MetaPill label="Source" value={selectedEvent.source} />
                                            <MetaPill label="Time" value={new Date(selectedEvent.timestamp).toLocaleString()} />
                                        </View>
                                    </>
                                ) : (
                                    <View style={styles.emptyDetail}>
                                        <Ionicons name="pulse-outline" size={34} color={colors.textDim} />
                                        <Text style={styles.emptyDetailTitle}>Select an event</Text>
                                        <Text style={styles.emptyDetailText}>
                                            Tablet keeps the event stream moving while the selected event stays expanded beside it.
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

function MetaPill({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.metaPill}>
            <Text style={styles.metaPillLabel}>{label}</Text>
            <Text style={styles.metaPillValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { flex: 1, paddingBottom: spacing.lg },
    liveBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginBottom: spacing.md,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderQuiet,
    },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    liveText: { ...typography.caption, color: colors.success },
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
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.cyanMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowContent: { flex: 1, minWidth: 0 },
    rowType: { ...typography.bodySm, color: colors.textPrimary, fontFamily: 'monospace', fontSize: 12 },
    rowSource: { ...typography.caption, color: colors.textDim },
    rowTime: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace', fontSize: 10 },
    detailPane: { gap: spacing.lg },
    detailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
    },
    sectionTitle: { ...typography.eyebrow, color: colors.textPrimary },
    detailTitle: { ...typography.displayMd, color: colors.textPrimary },
    detailBody: { ...typography.bodyMd, color: colors.textSecondary, lineHeight: 22 },
    detailMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    metaPill: {
        minWidth: 120,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        padding: spacing.sm,
        gap: 2,
    },
    metaPillLabel: { ...typography.caption, color: colors.textDim },
    metaPillValue: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim, textAlign: 'center', maxWidth: 260 },
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
