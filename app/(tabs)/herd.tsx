/**
 * GoatCitadel Mobile — Herd HQ / Simplified Office
 */
import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCCard, GCStatusChip } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useLayout } from '../../src/hooks/useLayout';
import { fetchAgents } from '../../src/api/client';
import type { AgentProfileRecord } from '../../src/api/types';

const GOAT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    architect: 'construct', coder: 'code-slash', qa: 'bug', researcher: 'search',
    assistant: 'person', product: 'bulb', ops: 'server',
};
const GOAT_COLORS: Record<string, string> = {
    architect: '#54ddff', coder: '#6ef5a5', qa: '#ff9a45', researcher: '#a78bfa',
    assistant: '#54ddff', product: '#f472b6', ops: '#fbbf24',
};

export default function HerdScreen() {
    const { isTablet } = useLayout();
    const agents = useApiData<{ items: AgentProfileRecord[] }>(
        useCallback(() => fetchAgents(), []),
        { pollMs: 15000 },
    );
    const items = agents.data?.items ?? [];
    const active = items.filter((a) => a.activeSessions > 0);

    return (
        <View style={s.safe} >
            <GCHeader eyebrow="Herd HQ" title="The Herd"
                subtitle={`${items.length} agents · ${active.length} active`} />
            <FlatList data={items} keyExtractor={(a) => a.agentId}
                numColumns={isTablet ? 3 : 2}
                columnWrapperStyle={s.gridRow}
                renderItem={({ item }) => <AgentCard agent={item} />}
                refreshControl={<RefreshControl refreshing={agents.refreshing} onRefresh={agents.refresh}
                    tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard} />}
                contentContainerStyle={s.list}
                ListEmptyComponent={agents.loading ? null : (
                    <View style={s.empty}>
                        <Ionicons name="people-outline" size={48} color={colors.textDim} />
                        <Text style={s.emptyText}>{agents.error || 'No agents found.'}</Text>
                    </View>
                )} />
        </View>
    );
}

function AgentCard({ agent }: { agent: AgentProfileRecord }) {
    const router = useRouter();
    const iconName = GOAT_ICONS[agent.roleId] || 'person';
    const iconColor = GOAT_COLORS[agent.roleId] || colors.cyan;
    const isActive = agent.activeSessions > 0;

    return (
        <Pressable onPress={() => router.push(`/(tabs)/agent/${agent.agentId}` as any)}>
            <GCCard style={s.card}>
                <View style={[s.avatarCircle, { borderColor: iconColor }]}>
                    <Ionicons name={iconName} size={22} color={iconColor} />
                </View>
                <Text style={s.agentName}>{agent.name}</Text>
                <Text style={s.agentTitle}>{agent.title}</Text>
                <View style={s.specRow}>
                    {agent.specialties.slice(0, 2).map((sp) => (
                        <Text key={sp} style={s.specBadge}>{sp}</Text>
                    ))}
                </View>
                <View style={s.statusRow}>
                    <GCStatusChip tone={isActive ? 'live' : 'muted'}>
                        {isActive ? `${agent.activeSessions} active` : 'Idle'}
                    </GCStatusChip>
                </View>
            </GCCard>
        </Pressable>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    list: { paddingHorizontal: spacing.md, paddingBottom: 32 },
    gridRow: { gap: spacing.md, marginBottom: spacing.md },
    card: { flex: 1, alignItems: 'center', paddingVertical: spacing.xl },
    avatarCircle: {
        width: 48, height: 48, borderRadius: 24, borderWidth: 2,
        alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
        backgroundColor: 'rgba(84,221,255,0.06)',
    },
    agentName: { ...typography.displaySm, color: colors.textPrimary, textAlign: 'center' },
    agentTitle: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
    specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.sm, justifyContent: 'center' },
    specBadge: {
        ...typography.caption, color: colors.textDim, backgroundColor: colors.bgInset,
        borderRadius: radii.sm, paddingHorizontal: 6, paddingVertical: 2, fontSize: 9,
    },
    statusRow: { marginTop: spacing.sm },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim, textAlign: 'center', maxWidth: 260 },
});
