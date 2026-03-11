/**
 * GoatCitadel Mobile — System Logs Screen
 * Real-time log viewer with severity filtering and auto-scroll.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, Pressable, StyleSheet, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCButton, PulseDot } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchDashboard } from '../../src/api/client';
import type { DashboardState, RealtimeEvent } from '../../src/api/types';

type LogLevel = 'all' | 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
    id: string;
    level: LogLevel;
    message: string;
    source: string;
    timestamp: string;
}

function eventToLog(event: RealtimeEvent): LogEntry {
    const levelMap: Record<string, LogLevel> = {
        'system.health': 'info',
        'tool.executed': 'debug',
        'approval.created': 'warn',
        'approval.resolved': 'info',
        'chat.message': 'info',
        'agent.started': 'info',
        'agent.completed': 'info',
    };
    return {
        id: event.eventId,
        level: levelMap[event.eventType] || 'info',
        message: `[${event.eventType}] ${event.source}`,
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
    const [filter, setFilter] = useState<LogLevel>('all');
    const [autoScroll, setAutoScroll] = useState(true);
    const listRef = useRef<any>(null);

    const dashboard = useApiData<DashboardState>(
        useCallback(() => fetchDashboard(), []),
        { pollMs: 3000 },
    );

    const events = dashboard.data?.recentEvents ?? [];
    const logs = events.map(eventToLog);
    const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter);

    const levels: LogLevel[] = ['all', 'info', 'warn', 'error', 'debug'];

    return (
        <View style={s.safe} >
            <GCHeader
                eyebrow="Debug & Monitoring"
                title="System Logs"
                subtitle={`${filtered.length} entries · polling 3s`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />

            {/* Toolbar */}
            <View style={s.toolbar}>
                <View style={s.filterRow}>
                    {levels.map(level => (
                        <Pressable
                            key={level}
                            style={[s.levelPill, filter === level && { backgroundColor: LEVEL_COLORS[level] + '33', borderColor: LEVEL_COLORS[level] }]}
                            onPress={() => setFilter(level)}
                        >
                            <View style={[s.levelDot, { backgroundColor: LEVEL_COLORS[level] }]} />
                            <Text style={[s.levelText, filter === level && { color: LEVEL_COLORS[level] }]}>
                                {level.toUpperCase()}
                            </Text>
                        </Pressable>
                    ))}
                </View>
                <Pressable
                    style={[s.autoScrollBtn, autoScroll && s.autoScrollActive]}
                    onPress={() => setAutoScroll(!autoScroll)}
                >
                    <Ionicons
                        name={autoScroll ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                        size={16}
                        color={autoScroll ? colors.cyan : colors.textDim}
                    />
                    <Text style={[s.autoScrollText, autoScroll && { color: colors.cyan }]}>AUTO</Text>
                </Pressable>
            </View>

            {/* Live indicator */}
            <View style={s.liveBar}>
                <PulseDot color={colors.success} size={5} />
                <Text style={s.liveText}>Live — polling every 3 seconds</Text>
            </View>

            {/* Log Entries */}
            <View style={{ flex: 1 }}>
                <FlashList
                    ref={listRef}
                    data={filtered}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View style={s.logRow}>
                            <View style={[s.logLevelBar, { backgroundColor: LEVEL_COLORS[item.level] }]} />
                            <View style={s.logContent}>
                                <View style={s.logHeader}>
                                    <Text style={[s.logLevel, { color: LEVEL_COLORS[item.level] }]}>
                                        {item.level.toUpperCase()}
                                    </Text>
                                    <Text style={s.logTime}>
                                        {new Date(item.timestamp).toLocaleTimeString([], {
                                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                                        })}
                                    </Text>
                                </View>
                                <Text style={s.logMessage} numberOfLines={2}>{item.message}</Text>
                            </View>
                        </View>
                    )}
                    refreshControl={
                        <RefreshControl
                            refreshing={dashboard.refreshing}
                            onRefresh={dashboard.refresh}
                            tintColor={colors.cyan}
                            colors={[colors.cyan]}
                            progressBackgroundColor={colors.bgCard}
                        />
                    }
                    contentContainerStyle={s.list}
                    ListEmptyComponent={
                        <View style={s.empty}>
                            <Ionicons name="terminal-outline" size={48} color={colors.textDim} />
                            <Text style={s.emptyText}>
                                {dashboard.error || 'No log entries. Waiting for system events...'}
                            </Text>
                        </View>
                    }
                />
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#040608' },
    toolbar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingBottom: spacing.sm,
    },
    filterRow: {
        flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', flex: 1,
    },
    levelPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs,
        borderRadius: radii.sm, borderWidth: 1,
        borderColor: colors.borderQuiet, backgroundColor: colors.bgInset,
    },
    levelDot: { width: 6, height: 6, borderRadius: 3 },
    levelText: { ...typography.caption, color: colors.textDim, fontSize: 9, letterSpacing: 0.8 },
    autoScrollBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        borderRadius: radii.sm,
    },
    autoScrollActive: { backgroundColor: colors.cyanMuted },
    autoScrollText: { ...typography.caption, color: colors.textDim, fontSize: 9 },
    liveBar: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.xs,
        backgroundColor: '#030506',
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderQuiet,
    },
    liveText: { ...typography.caption, color: colors.success, fontSize: 10 },
    list: { paddingBottom: 32 },
    logRow: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(62, 81, 101, 0.15)',
    },
    logLevelBar: {
        width: 3, alignSelf: 'stretch',
    },
    logContent: {
        flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    logHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 2,
    },
    logLevel: {
        fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, fontWeight: '700',
    },
    logTime: {
        fontFamily: 'monospace', fontSize: 9, color: colors.textDim,
    },
    logMessage: {
        fontFamily: 'monospace', fontSize: 11, color: colors.textSecondary, lineHeight: 16,
    },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim, textAlign: 'center', maxWidth: 260 },
});
