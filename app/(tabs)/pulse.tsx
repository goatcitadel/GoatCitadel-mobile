/**
 * GoatCitadel Mobile — Pulse / Live Event Stream
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, Animated } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCButton } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchDashboard } from '../../src/api/client';
import type { DashboardState, RealtimeEvent } from '../../src/api/types';

const EVENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    'chat.message': 'chatbubble',
    'chat.session_start': 'add-circle',
    'chat.session_end': 'remove-circle',
    'approval.created': 'lock-closed',
    'approval.resolved': 'lock-open',
    'tool.executed': 'hammer',
    'agent.started': 'person-add',
    'system.health': 'pulse',
};

export default function PulseScreen() {
    const router = useRouter();
    const dashboard = useApiData<DashboardState>(
        useCallback(() => fetchDashboard(), []),
        { pollMs: 5000 },
    );
    const events = dashboard.data?.recentEvents ?? [];

    return (
        <View style={s.safe} >
            <GCHeader
                eyebrow="Live Feed"
                title="Pulse"
                subtitle={`${events.length} recent events`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <View style={s.liveBar}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>Live — auto-refreshing every 5s</Text>
            </View>
            <View style={{ flex: 1 }}>
                <FlashList
                    data={events}
                    keyExtractor={(e) => e.eventId}
                    renderItem={({ item }) => <MemoizedEventRow event={item} />}
                    refreshControl={
                        <RefreshControl refreshing={dashboard.refreshing} onRefresh={dashboard.refresh}
                            tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard} />
                    }
                    contentContainerStyle={s.list}
                    ListEmptyComponent={
                        <View style={s.empty}>
                            <Ionicons name="pulse-outline" size={48} color={colors.textDim} />
                            <Text style={s.emptyText}>
                                {dashboard.error || 'No events yet. Activity will appear here in real time.'}
                            </Text>
                        </View>
                    }
                />
            </View>
        </View>
    );
}

const MemoizedEventRow = React.memo(EventRow, (prev, next) => {
    return prev.event.eventId === next.event.eventId;
});

function EventRow({ event }: { event: RealtimeEvent }) {
    const icon = EVENT_ICONS[event.eventType] || 'ellipse';
    const time = new Date(event.timestamp);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return (
        <View style={s.row}>
            <View style={s.iconBox}>
                <Ionicons name={icon} size={16} color={colors.cyan} />
            </View>
            <View style={s.rowContent}>
                <Text style={s.rowType}>{event.eventType}</Text>
                <Text style={s.rowSource}>{event.source}</Text>
            </View>
            <Text style={s.rowTime}>{timeStr}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    liveBar: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
        backgroundColor: colors.bgInset,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderQuiet,
    },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    liveText: { ...typography.caption, color: colors.success },
    list: { paddingBottom: 32 },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderQuiet,
    },
    iconBox: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cyanMuted,
        alignItems: 'center', justifyContent: 'center',
    },
    rowContent: { flex: 1 },
    rowType: { ...typography.bodySm, color: colors.textPrimary, fontFamily: 'monospace', fontSize: 12 },
    rowSource: { ...typography.caption, color: colors.textDim },
    rowTime: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace', fontSize: 10 },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim, textAlign: 'center', maxWidth: 260 },
});
