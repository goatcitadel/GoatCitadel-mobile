/**
 * GoatCitadel Mobile — Agent Detail / Profile Screen
 * Deep view into individual agent capabilities, stats, and activity.
 */
import React, { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    GCHeader, GCCard, GCStatusChip, GCButton, FadeIn, PulseDot,
} from '../../../src/components/ui';
import { colors, spacing, typography, radii } from '../../../src/theme/tokens';
import { useApiData } from '../../../src/hooks/useApiData';
import { fetchAgents } from '../../../src/api/client';
import type { AgentProfileRecord } from '../../../src/api/types';

const GOAT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    architect: 'construct', coder: 'code-slash', qa: 'bug', researcher: 'search',
    assistant: 'person', product: 'bulb', ops: 'server',
};
const GOAT_COLORS: Record<string, string> = {
    architect: '#54ddff', coder: '#6ef5a5', qa: '#ff9a45', researcher: '#a78bfa',
    assistant: '#54ddff', product: '#f472b6', ops: '#fbbf24',
};

export default function AgentDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ agentId: string }>();
    const agentId = params.agentId;

    const agents = useApiData<{ items: AgentProfileRecord[] }>(
        useCallback(() => fetchAgents(), []),
    );

    const agent = agents.data?.items.find(a => a.agentId === agentId);

    if (!agent && !agents.loading) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <GCHeader eyebrow="Agent Profile" title="Not Found"
                    right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />} />
                <View style={s.empty}>
                    <Ionicons name="person-outline" size={48} color={colors.textDim} />
                    <Text style={s.emptyText}>Agent not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!agent) return null;

    const iconName = GOAT_ICONS[agent.roleId] || 'person';
    const iconColor = GOAT_COLORS[agent.roleId] || colors.cyan;
    const isActive = agent.activeSessions > 0;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <GCHeader
                eyebrow="Agent Profile"
                title={agent.name}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView
                contentContainerStyle={s.content}
                refreshControl={
                    <RefreshControl
                        refreshing={agents.refreshing} onRefresh={agents.refresh}
                        tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard}
                    />
                }
            >
                {/* Avatar and Identity */}
                <FadeIn delay={100}>
                    <GCCard style={s.profileCard}>
                        <View style={s.profileTop}>
                            <View style={[s.avatarLg, { borderColor: iconColor }]}>
                                <Ionicons name={iconName} size={36} color={iconColor} />
                            </View>
                            <View style={s.profileInfo}>
                                <Text style={s.profileName}>{agent.name}</Text>
                                <Text style={s.profileTitle}>{agent.title}</Text>
                                <View style={s.statusContainer}>
                                    {isActive && <PulseDot color={colors.success} size={5} />}
                                    <GCStatusChip tone={isActive ? 'live' : 'muted'}>
                                        {isActive ? 'ACTIVE' : 'IDLE'}
                                    </GCStatusChip>
                                </View>
                            </View>
                        </View>
                        <Text style={s.summary}>{agent.summary}</Text>
                    </GCCard>
                </FadeIn>

                {/* Stats Grid */}
                <FadeIn delay={200}>
                    <View style={s.statsGrid}>
                        <View style={s.statItem}>
                            <Text style={s.statValue}>{agent.sessionCount}</Text>
                            <Text style={s.statLabel}>Total Sessions</Text>
                        </View>
                        <View style={s.statItem}>
                            <Text style={[s.statValue, isActive && { color: colors.cyan }]}>
                                {agent.activeSessions}
                            </Text>
                            <Text style={s.statLabel}>Active Now</Text>
                        </View>
                        <View style={s.statItem}>
                            <Text style={s.statValue}>{agent.specialties.length}</Text>
                            <Text style={s.statLabel}>Specialties</Text>
                        </View>
                        <View style={s.statItem}>
                            <Ionicons
                                name={agent.isBuiltin ? 'shield-checkmark' : 'build'}
                                size={20}
                                color={agent.isBuiltin ? colors.cyan : colors.ember}
                            />
                            <Text style={s.statLabel}>{agent.isBuiltin ? 'Builtin' : 'Custom'}</Text>
                        </View>
                    </View>
                </FadeIn>

                {/* Specialties */}
                <FadeIn delay={300}>
                    <GCCard style={s.section}>
                        <Text style={s.sectionTitle}>SPECIALTIES</Text>
                        <View style={s.tagsGrid}>
                            {agent.specialties.map(spec => (
                                <View key={spec} style={[s.tag, { borderColor: iconColor + '44' }]}>
                                    <Ionicons name="sparkles" size={10} color={iconColor} />
                                    <Text style={[s.tagText, { color: iconColor }]}>{spec}</Text>
                                </View>
                            ))}
                        </View>
                    </GCCard>
                </FadeIn>

                {/* Role Details */}
                <FadeIn delay={400}>
                    <GCCard style={s.section}>
                        <Text style={s.sectionTitle}>ROLE DETAILS</Text>
                        <View style={s.detailRow}>
                            <Text style={s.detailLabel}>Role ID</Text>
                            <Text style={s.detailValue}>{agent.roleId}</Text>
                        </View>
                        <View style={s.detailRow}>
                            <Text style={s.detailLabel}>Agent ID</Text>
                            <Text style={s.detailValueMono}>{agent.agentId}</Text>
                        </View>
                        <View style={s.detailRow}>
                            <Text style={s.detailLabel}>Type</Text>
                            <Text style={s.detailValue}>{agent.isBuiltin ? 'System Built-in' : 'Custom Agent'}</Text>
                        </View>
                    </GCCard>
                </FadeIn>

                <View style={{ height: 32 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 32 },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim },

    profileCard: { marginBottom: spacing.lg },
    profileTop: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
    avatarLg: {
        width: 72, height: 72, borderRadius: 36, borderWidth: 2.5,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(84,221,255,0.06)',
    },
    profileInfo: { flex: 1, justifyContent: 'center' },
    profileName: { ...typography.displayMd, color: colors.textPrimary },
    profileTitle: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },
    statusContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
    summary: { ...typography.bodyMd, color: colors.textSecondary, lineHeight: 22 },

    statsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
        marginBottom: spacing.lg,
    },
    statItem: {
        flex: 1, minWidth: 80, backgroundColor: colors.bgCard,
        borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderCyan,
        padding: spacing.lg, alignItems: 'center', gap: spacing.xs,
    },
    statValue: { ...typography.displayMd, color: colors.textPrimary },
    statLabel: { ...typography.caption, color: colors.textDim, textAlign: 'center' },

    section: { marginBottom: spacing.lg },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.md },
    tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tag: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
        borderRadius: radii.pill, borderWidth: 1,
        backgroundColor: colors.bgInset,
    },
    tagText: { ...typography.bodySm, fontSize: 12 },

    detailRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderQuiet,
    },
    detailLabel: { ...typography.bodySm, color: colors.textMuted },
    detailValue: { ...typography.bodySm, color: colors.textPrimary },
    detailValueMono: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace', fontSize: 10 },
});
