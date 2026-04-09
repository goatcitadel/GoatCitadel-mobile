/**
 * GoatCitadel Mobile — Skills Screen
 * Real state management for skills with tablet detail context.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    AdaptiveContainer,
    ContextPane,
    MasterDetailShell,
} from '../../src/components/layout';
import { GCHeader, GCStatusChip, GCButton } from '../../src/components/ui';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { fetchSkills, reloadSkills, updateSkillState } from '../../src/api/client';
import type { SkillListItem, SkillRuntimeState } from '../../src/api/types';
import { useToast } from '../../src/context/ToastContext';

const STATE_CYCLE: SkillRuntimeState[] = ['enabled', 'sleep', 'disabled'];
const STATE_TONE = {
    enabled: 'success' as const,
    sleep: 'warning' as const,
    disabled: 'muted' as const,
};

function getSkillSummary(skill: SkillListItem): string | undefined {
    if (skill.note?.trim()) {
        return skill.note.trim();
    }

    const parts: string[] = [];
    if (skill.declaredTools.length > 0) {
        parts.push(`${skill.declaredTools.length} tool${skill.declaredTools.length === 1 ? '' : 's'}`);
    }
    if (skill.requires.length > 0) {
        parts.push(`${skill.requires.length} requirement${skill.requires.length === 1 ? '' : 's'}`);
    }

    return parts.length > 0 ? parts.join(' · ') : undefined;
}

export default function SkillsScreen() {
    const router = useRouter();
    const layout = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const { showToast } = useToast();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [selectedSkillId, setSelectedSkillId] = useState<string | undefined>(undefined);
    const skills = useApiData<{ items: SkillListItem[] }>(
        useCallback(() => fetchSkills(), []),
    );

    const items = skills.data?.items ?? [];
    const enabled = items.filter((skill) => skill.state === 'enabled');
    const sleeping = items.filter((skill) => skill.state === 'sleep');
    const selectedSkill = items.find((skill) => skill.skillId === selectedSkillId) ?? items[0];

    useEffect(() => {
        if (!layout.dualPane) {
            return;
        }
        if (items.length > 0 && !selectedSkillId) {
            setSelectedSkillId(items[0].skillId);
        } else if (selectedSkillId && !items.some((skill) => skill.skillId === selectedSkillId)) {
            setSelectedSkillId(items[0]?.skillId);
        }
    }, [items, layout.dualPane, selectedSkillId]);

    const onCycleState = async (skill: SkillListItem) => {
        const currentIdx = STATE_CYCLE.indexOf(skill.state);
        const nextState = STATE_CYCLE[(currentIdx + 1) % STATE_CYCLE.length];
        setBusyId(skill.skillId);
        try {
            await updateSkillState(skill.skillId, { state: nextState });
            await skills.refresh();
            showToast({ message: `${skill.name} -> ${nextState}`, type: 'success' });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setBusyId(null);
        }
    };

    const onReload = async () => {
        try {
            await reloadSkills();
            await skills.refresh();
            showToast({ message: 'Skills reloaded from disk', type: 'success' });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const listComponent = (
        <ContextPane style={styles.listPane}>
            <FlatList
                data={items}
                keyExtractor={(item) => item.skillId}
                renderItem={({ item }) => {
                    const selected = layout.dualPane && item.skillId === selectedSkill?.skillId;
                    return (
                        <Pressable
                            style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
                            onPress={() => {
                                if (layout.dualPane) {
                                    setSelectedSkillId(item.skillId);
                                    return;
                                }
                                void onCycleState(item);
                            }}
                            disabled={busyId === item.skillId}
                        >
                            <View style={[styles.icon, item.state !== 'enabled' && styles.iconDim]}>
                                <Ionicons
                                    name="extension-puzzle"
                                    size={16}
                                    color={item.state === 'enabled' ? colors.ember : item.state === 'sleep' ? colors.ember : colors.textDim}
                                />
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={styles.rowName}>{item.name}</Text>
                                {getSkillSummary(item) ? (
                                    <Text style={styles.rowDesc} numberOfLines={2}>{getSkillSummary(item)}</Text>
                                ) : null}
                                {item.source ? <Text style={styles.rowSource}>{item.source}</Text> : null}
                            </View>
                            <View style={styles.stateCol}>
                                <GCStatusChip tone={STATE_TONE[item.state]}>{item.state.toUpperCase()}</GCStatusChip>
                                <Text style={styles.tapHint}>{layout.dualPane ? 'select' : 'tap to change'}</Text>
                            </View>
                        </Pressable>
                    );
                }}
                refreshControl={(
                    <RefreshControl
                        refreshing={skills.refreshing}
                        onRefresh={skills.refresh}
                        tintColor={colors.cyan}
                        colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                )}
                contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
                ListEmptyComponent={(
                    <View style={styles.empty}>
                        <Ionicons name="extension-puzzle-outline" size={48} color={colors.textDim} />
                        <Text style={styles.emptyText}>{skills.error || 'No skills found.'}</Text>
                    </View>
                )}
            />
        </ContextPane>
    );

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Capabilities"
                title="Skills"
                subtitle={`${enabled.length} enabled · ${sleeping.length} sleep · ${items.length} total`}
                right={(
                    <View style={styles.headerActions}>
                        <GCButton title="Reload" onPress={onReload} variant="ghost" size="sm" />
                        <GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />
                    </View>
                )}
            />

            <AdaptiveContainer style={styles.content}>
                {layout.dualPane ? (
                    <MasterDetailShell
                        style={styles.shell}
                        master={listComponent}
                        detail={(
                            <ContextPane style={styles.detailPane}>
                                <View style={styles.detailHeader}>
                                    <Text style={styles.sectionTitle}>SKILL DETAIL</Text>
                                    {selectedSkill ? (
                                        <GCStatusChip tone={STATE_TONE[selectedSkill.state]}>
                                            {selectedSkill.state.toUpperCase()}
                                        </GCStatusChip>
                                    ) : null}
                                </View>
                                {selectedSkill ? (
                                    <>
                                        <Text style={styles.detailTitle}>{selectedSkill.name}</Text>
                                        <Text style={styles.detailSummary}>
                                            {getSkillSummary(selectedSkill) || 'No summary provided for this skill yet.'}
                                        </Text>
                                        {selectedSkill.source ? (
                                            <Text style={styles.detailSource}>{selectedSkill.source}</Text>
                                        ) : null}
                                        <View style={styles.detailSection}>
                                            <Text style={styles.detailSectionTitle}>Declared tools</Text>
                                            <TagWrap items={selectedSkill.declaredTools} emptyLabel="No declared tools" />
                                        </View>
                                        <View style={styles.detailSection}>
                                            <Text style={styles.detailSectionTitle}>Requirements</Text>
                                            <TagWrap items={selectedSkill.requires} emptyLabel="No explicit requirements" />
                                        </View>
                                        <GCButton
                                            title={busyId === selectedSkill.skillId ? 'Updating…' : 'Cycle state'}
                                            onPress={() => void onCycleState(selectedSkill)}
                                            variant="primary"
                                            size="sm"
                                            disabled={busyId === selectedSkill.skillId}
                                        />
                                    </>
                                ) : (
                                    <View style={styles.emptyDetail}>
                                        <Ionicons name="extension-puzzle-outline" size={34} color={colors.textDim} />
                                        <Text style={styles.emptyDetailTitle}>Select a skill</Text>
                                        <Text style={styles.emptyDetailText}>
                                            Tablet keeps runtime state and requirements visible while the full list stays on the left.
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

function TagWrap({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
    if (items.length === 0) {
        return <Text style={styles.emptyInline}>{emptyLabel}</Text>;
    }
    return (
        <View style={styles.tagWrap}>
            {items.map((item) => (
                <View key={item} style={styles.tag}>
                    <Text style={styles.tagText}>{item}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { flex: 1, paddingBottom: spacing.lg },
    headerActions: { flexDirection: 'row', gap: spacing.sm },
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
    icon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.emberMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconDim: { backgroundColor: colors.statusMutedBg },
    rowContent: { flex: 1, minWidth: 0 },
    rowName: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    rowDesc: { ...typography.caption, color: colors.textDim, marginTop: 2 },
    rowSource: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace', marginTop: 1 },
    stateCol: { alignItems: 'flex-end', gap: 2 },
    tapHint: { ...typography.caption, color: colors.textDim, fontSize: 9 },
    detailPane: { gap: spacing.lg },
    detailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
    },
    sectionTitle: { ...typography.eyebrow, color: colors.textPrimary },
    detailTitle: { ...typography.displayMd, color: colors.textPrimary },
    detailSummary: { ...typography.bodyMd, color: colors.textSecondary, lineHeight: 22 },
    detailSource: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },
    detailSection: { gap: spacing.sm },
    detailSectionTitle: { ...typography.eyebrow, color: colors.textMuted },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tag: {
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    tagText: { ...typography.caption, color: colors.textSecondary },
    emptyInline: { ...typography.bodySm, color: colors.textDim },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim },
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
