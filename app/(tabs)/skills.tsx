/**
 * GoatCitadel Mobile — Skills Screen
 * Real state management for skills — mirrors desktop SkillsPage governance.
 * Supports reading, state changes, and reload from the backend.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCCard, GCStatusChip, GCButton } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchSkills, updateSkillState, reloadSkills } from '../../src/api/client';
import type { SkillListItem, SkillRuntimeState } from '../../src/api/types';
import { useToast } from '../../src/context/ToastContext';

const STATE_CYCLE: SkillRuntimeState[] = ['enabled', 'sleep', 'disabled'];
const STATE_TONE = {
    enabled: 'success' as const,
    sleep: 'warning' as const,
    disabled: 'muted' as const,
};

export default function SkillsScreen() {
    const router = useRouter();
    const { showToast } = useToast();
    const [busyId, setBusyId] = useState<string | null>(null);
    const skills = useApiData<{ items: SkillListItem[] }>(
        useCallback(() => fetchSkills(), []),
    );
    const items = skills.data?.items ?? [];
    const enabled = items.filter(s => s.state === 'enabled');
    const sleeping = items.filter(s => s.state === 'sleep');

    const onCycleState = async (skill: SkillListItem) => {
        const currentIdx = STATE_CYCLE.indexOf(skill.state);
        const nextState = STATE_CYCLE[(currentIdx + 1) % STATE_CYCLE.length];
        setBusyId(skill.skillId);
        try {
            await updateSkillState(skill.skillId, { state: nextState });
            await skills.refresh();
            showToast({ message: `${skill.name} → ${nextState}`, type: 'success' });
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setBusyId(null);
        }
    };

    const onReload = async () => {
        try {
            await reloadSkills();
            await skills.refresh();
            showToast({ message: 'Skills reloaded from disk', type: 'success' });
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <GCHeader eyebrow="Capabilities" title="Skills"
                subtitle={`${enabled.length} enabled · ${sleeping.length} sleep · ${items.length} total`}
                right={
                    <View style={s.headerActions}>
                        <GCButton title="Reload" onPress={onReload} variant="ghost" size="sm" />
                        <GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />
                    </View>
                } />
            <FlatList data={items} keyExtractor={i => i.skillId}
                renderItem={({ item }) => (
                    <Pressable
                        style={s.row}
                        onPress={() => onCycleState(item)}
                        disabled={busyId === item.skillId}
                    >
                        <View style={[s.icon, item.state !== 'enabled' && s.iconDim]}>
                            <Ionicons name="extension-puzzle" size={16}
                                color={item.state === 'enabled' ? colors.ember : item.state === 'sleep' ? colors.ember : colors.textDim} />
                        </View>
                        <View style={s.rowContent}>
                            <Text style={s.rowName}>{item.name}</Text>
                            {item.description ? <Text style={s.rowDesc} numberOfLines={2}>{item.description}</Text> : null}
                            {item.source ? <Text style={s.rowSource}>{item.source}</Text> : null}
                        </View>
                        <View style={s.stateCol}>
                            <GCStatusChip tone={STATE_TONE[item.state]}>
                                {item.state.toUpperCase()}
                            </GCStatusChip>
                            <Text style={s.tapHint}>tap to change</Text>
                        </View>
                    </Pressable>
                )}
                refreshControl={
                    <RefreshControl refreshing={skills.refreshing} onRefresh={skills.refresh}
                        tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard} />
                }
                contentContainerStyle={s.list}
                ListEmptyComponent={
                    <View style={s.empty}>
                        <Ionicons name="extension-puzzle-outline" size={48} color={colors.textDim} />
                        <Text style={s.emptyText}>{skills.error || 'No skills found.'}</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    list: { paddingBottom: 32 },
    headerActions: { flexDirection: 'row', gap: spacing.sm },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderQuiet,
    },
    icon: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: colors.emberMuted,
        alignItems: 'center', justifyContent: 'center',
    },
    iconDim: { backgroundColor: colors.statusMutedBg },
    rowContent: { flex: 1 },
    rowName: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    rowDesc: { ...typography.caption, color: colors.textDim, marginTop: 2 },
    rowSource: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace', marginTop: 1 },
    stateCol: { alignItems: 'flex-end', gap: 2 },
    tapHint: { ...typography.caption, color: colors.textDim, fontSize: 9 },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim },
});
