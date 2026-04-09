/**
 * GoatCitadel Mobile — More Menu (secondary surfaces)
 */
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AdaptiveContainer, SectionGrid } from '../../src/components/layout';
import { GCHeader } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';

interface MenuItem {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    desc: string;
    color: string;
    route: string;
    group: 'Activity' | 'Sessions' | 'Systems' | 'Build';
}

const MENU: MenuItem[] = [
    { icon: 'notifications', label: 'Notifications', desc: 'Alerts & event feed', color: colors.cyan, route: '/(tabs)/notifications', group: 'Activity' },
    { icon: 'pulse', label: 'Pulse', desc: 'Live event stream', color: colors.cyan, route: '/(tabs)/pulse', group: 'Activity' },
    { icon: 'terminal', label: 'System Logs', desc: 'Real-time log viewer', color: '#10b981', route: '/(tabs)/logs', group: 'Activity' },
    { icon: 'wallet', label: 'Cost Tracker', desc: 'Spend analytics & budgets', color: '#f59e0b', route: '/(tabs)/costs', group: 'Activity' },
    { icon: 'git-branch', label: 'Mission Sessions', desc: 'Mission-scope session list', color: colors.ember, route: '/(tabs)/cowork', group: 'Sessions' },
    { icon: 'code-slash', label: 'Code Sessions', desc: 'Sessions with project context', color: colors.success, route: '/(tabs)/code', group: 'Sessions' },
    { icon: 'list', label: 'Sessions', desc: 'Run history & costs', color: colors.cyan, route: '/(tabs)/sessions', group: 'Sessions' },
    { icon: 'bookmarks', label: 'Bookmarks', desc: 'Pinned & saved sessions', color: '#ec4899', route: '/(tabs)/bookmarks', group: 'Sessions' },
    { icon: 'extension-puzzle', label: 'Skills', desc: 'Manage skill states', color: colors.ember, route: '/(tabs)/skills', group: 'Systems' },
    { icon: 'server', label: 'MCP Servers', desc: 'Connect & monitor tool servers', color: '#f472b6', route: '/(tabs)/mcp', group: 'Systems' },
    { icon: 'heart-circle', label: 'Health', desc: 'System vitals & monitoring', color: colors.success, route: '/(tabs)/health', group: 'Systems' },
    { icon: 'settings', label: 'Settings', desc: 'Providers, profiles & config', color: colors.textMuted, route: '/(tabs)/settings', group: 'Systems' },
    { icon: 'easel', label: 'Canvas', desc: 'Companion-backed A2UI lane', color: colors.cyan, route: '/(tabs)/canvas', group: 'Build' },
    { icon: 'layers', label: 'Parity Lanes', desc: 'Browser, voice & plugin proofs', color: '#a78bfa', route: '/(tabs)/parity', group: 'Build' },
    { icon: 'time', label: 'Scheduled Jobs', desc: 'Cron jobs from gateway', color: '#8b5cf6', route: '/(tabs)/workflows', group: 'Build' },
];

export default function MoreScreen() {
    const router = useRouter();
    const layout = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const groupedMenu = MENU.reduce<Record<string, MenuItem[]>>((acc, item) => {
        acc[item.group] = [...(acc[item.group] ?? []), item];
        return acc;
    }, {});
    const useListLayout = !layout.isTablet;
    return (
        <View style={s.safe} >
            <GCHeader eyebrow="GoatCitadel" title="More" subtitle="Additional surfaces and configuration" />
            <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
                <AdaptiveContainer style={s.content}>
                    {useListLayout ? (
                        <View style={s.listStack}>
                            {MENU.map((item) => (
                                <Pressable key={item.label}
                                    style={({ pressed }) => [s.tile, s.tilePhone, pressed && s.tilePressed]}
                                    onPress={() => router.push(item.route as any)}>
                                    <View style={[s.iconCircle, s.iconCirclePhone, { borderColor: item.color + '44' }]}>
                                        <Ionicons name={item.icon} size={22} color={item.color} />
                                    </View>
                                    <View style={s.tileBody}>
                                        <Text style={[s.tileLabel, s.tileLabelPhone]}>{item.label}</Text>
                                        <Text style={s.tileDesc}>{item.desc}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
                                </Pressable>
                            ))}
                        </View>
                    ) : (
                        <View style={s.groupStack}>
                            {Object.entries(groupedMenu).map(([group, items]) => (
                                <View key={group} style={s.groupSection}>
                                    <Text style={s.groupTitle}>{group}</Text>
                                    <Text style={s.groupSubtitle}>
                                        {group === 'Activity'
                                            ? 'Keep live status, spend, and alerts visible.'
                                            : group === 'Sessions'
                                                ? 'Jump straight into the right workspace.'
                                                : group === 'Systems'
                                                    ? 'Governance, health, and connected services.'
                                                    : 'Proof lanes and companion work surfaces.'}
                                    </Text>
                                    <SectionGrid minItemWidthTablet={220} minItemWidthWideTablet={240}>
                                        {items.map((item) => (
                                            <Pressable key={item.label}
                                                style={({ pressed }) => [s.tile, pressed && s.tilePressed]}
                                                onPress={() => router.push(item.route as any)}>
                                                <View style={[s.iconCircle, { borderColor: item.color + '44' }]}>
                                                    <Ionicons name={item.icon} size={22} color={item.color} />
                                                </View>
                                                <View style={s.tileBody}>
                                                    <Text style={s.tileLabel}>{item.label}</Text>
                                                    <Text style={s.tileDesc}>{item.desc}</Text>
                                                </View>
                                            </Pressable>
                                        ))}
                                    </SectionGrid>
                                </View>
                            ))}
                        </View>
                    )}
                </AdaptiveContainer>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingBottom: spacing.xl },
    listStack: { gap: spacing.md },
    groupStack: { gap: spacing.xl },
    groupSection: { gap: spacing.md },
    groupTitle: { ...typography.eyebrow, color: colors.textMuted },
    groupSubtitle: { ...typography.bodySm, color: colors.textDim },
    tile: {
        backgroundColor: colors.bgCard, borderRadius: radii.md,
        borderWidth: 1, borderColor: colors.borderCyan, padding: spacing.lg,
        minHeight: 110, overflow: 'hidden',
    },
    tilePhone: {
        width: '100%',
        minHeight: 84,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    tilePressed: { opacity: 0.7, backgroundColor: colors.bgPanelSolid },
    iconCircle: {
        width: 40, height: 40, borderRadius: 20, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
        backgroundColor: 'rgba(84,221,255,0.04)',
    },
    iconCirclePhone: {
        marginBottom: 0,
        flexShrink: 0,
    },
    tileBody: { flex: 1 },
    tileLabel: { ...typography.displaySm, color: colors.textPrimary },
    tileLabelPhone: {
        fontSize: 18,
        lineHeight: 22,
        letterSpacing: 0.2,
    },
    tileDesc: { ...typography.caption, color: colors.textDim, marginTop: 2 },
});
