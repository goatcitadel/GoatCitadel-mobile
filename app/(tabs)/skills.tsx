/**
 * GoatCitadel Mobile — Skills Screen (read-only list)
 */
import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCCard, GCStatusChip, GCButton } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchSkills } from '../../src/api/client';
import type { SkillListItem } from '../../src/api/types';

export default function SkillsScreen() {
    const router = useRouter();
    const skills = useApiData<{ items: SkillListItem[] }>(
        useCallback(() => fetchSkills(), []),
    );
    const items = skills.data?.items ?? [];
    const enabled = items.filter(s => s.state === 'enabled');

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <GCHeader eyebrow="Capabilities" title="Skills"
                subtitle={`${enabled.length} enabled · ${items.length} total`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />} />
            <FlatList data={items} keyExtractor={i => i.skillId}
                renderItem={({ item }) => (
                    <View style={s.row}>
                        <View style={[s.icon, item.state !== 'enabled' && s.iconDim]}>
                            <Ionicons name="extension-puzzle" size={16}
                                color={item.state === 'enabled' ? colors.ember : colors.textDim} />
                        </View>
                        <View style={s.rowContent}>
                            <Text style={s.rowName}>{item.name}</Text>
                            {item.description ? <Text style={s.rowDesc} numberOfLines={2}>{item.description}</Text> : null}
                        </View>
                        <GCStatusChip tone={item.state === 'enabled' ? 'success' : item.state === 'sleep' ? 'warning' : 'muted'}>
                            {item.state.toUpperCase()}
                        </GCStatusChip>
                    </View>
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
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim },
});
