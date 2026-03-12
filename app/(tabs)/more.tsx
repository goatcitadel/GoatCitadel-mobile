/**
 * GoatCitadel Mobile — More Menu (secondary surfaces)
 */
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
}

const MENU: MenuItem[] = [
    { icon: 'notifications', label: 'Notifications', desc: 'Alerts & event feed', color: colors.cyan, route: '/(tabs)/notifications' },
    { icon: 'git-branch', label: 'Mission Sessions', desc: 'Mission-scope session list', color: colors.ember, route: '/(tabs)/cowork' },
    { icon: 'code-slash', label: 'Code Sessions', desc: 'Sessions with project context', color: colors.success, route: '/(tabs)/code' },
    { icon: 'pulse', label: 'Pulse', desc: 'Live event stream', color: colors.cyan, route: '/(tabs)/pulse' },
    { icon: 'list', label: 'Sessions', desc: 'Run history & costs', color: colors.cyan, route: '/(tabs)/sessions' },
    { icon: 'extension-puzzle', label: 'Skills', desc: 'Manage skill states', color: colors.ember, route: '/(tabs)/skills' },
    { icon: 'server', label: 'MCP Servers', desc: 'Connect & monitor tool servers', color: '#f472b6', route: '/(tabs)/mcp' },
    { icon: 'terminal', label: 'System Logs', desc: 'Real-time log viewer', color: '#10b981', route: '/(tabs)/logs' },
    { icon: 'wallet', label: 'Cost Tracker', desc: 'Spend analytics & budgets', color: '#f59e0b', route: '/(tabs)/costs' },
    { icon: 'bookmarks', label: 'Bookmarks', desc: 'Pinned & saved sessions', color: '#ec4899', route: '/(tabs)/bookmarks' },
    { icon: 'heart-circle', label: 'Health', desc: 'System vitals & monitoring', color: colors.success, route: '/(tabs)/health' },
    { icon: 'time', label: 'Scheduled Jobs', desc: 'Cron jobs from gateway', color: '#8b5cf6', route: '/(tabs)/workflows' },
    { icon: 'settings', label: 'Settings', desc: 'Providers, profiles & config', color: colors.textMuted, route: '/(tabs)/settings' },
];

export default function MoreScreen() {
    const router = useRouter();
    const { isTablet } = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const useListLayout = !isTablet;
    return (
        <View style={s.safe} >
            <GCHeader eyebrow="GoatCitadel" title="More" subtitle="Additional surfaces and configuration" />
            <ScrollView contentContainerStyle={[s.grid, isTablet && s.gridTablet, { paddingBottom: bottomPad }]}>
                {MENU.map((item) => (
                    <Pressable key={item.label}
                        style={({ pressed }) => [s.tile, useListLayout && s.tilePhone, pressed && s.tilePressed]}
                        onPress={() => router.push(item.route as any)}>
                        <View style={[s.iconCircle, useListLayout && s.iconCirclePhone, { borderColor: item.color + '44' }]}>
                            <Ionicons name={item.icon} size={22} color={item.color} />
                        </View>
                        <View style={s.tileBody}>
                            <Text style={[s.tileLabel, useListLayout && s.tileLabelPhone]}>{item.label}</Text>
                            <Text style={s.tileDesc}>{item.desc}</Text>
                        </View>
                        {useListLayout ? (
                            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
                        ) : null}
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    grid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingBottom: 32,
    },
    gridTablet: { gap: spacing.lg },
    tile: {
        width: '47%', backgroundColor: colors.bgCard, borderRadius: radii.md,
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
