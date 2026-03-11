/**
 * GoatCitadel Mobile — Workflow Builder Screen
 * Create and manage multi-step automation workflows.
 */
import React, { useState } from 'react';
import {
    View, Text, ScrollView, TextInput, Pressable, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    GCHeader, GCCard, GCButton, GCStatusChip, FadeIn,
} from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useToast } from '../../src/context/ToastContext';

interface WorkflowStep {
    id: string;
    type: 'prompt' | 'tool' | 'approval' | 'condition';
    label: string;
    config: string;
}

const STEP_TYPES: { type: WorkflowStep['type']; icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [
    { type: 'prompt', icon: 'chatbubble', label: 'AI Prompt', color: colors.cyan },
    { type: 'tool', icon: 'hammer', label: 'Tool Call', color: colors.ember },
    { type: 'approval', icon: 'lock-closed', label: 'Approval Gate', color: colors.crimson },
    { type: 'condition', icon: 'git-branch', label: 'Condition', color: colors.success },
];

export default function WorkflowsScreen() {
    const router = useRouter();
    const { showToast } = useToast();
    const [workflowName, setWorkflowName] = useState('');
    const [steps, setSteps] = useState<WorkflowStep[]>([]);
    const [showStepPicker, setShowStepPicker] = useState(false);

    const addStep = (type: WorkflowStep['type']) => {
        const stepType = STEP_TYPES.find(s => s.type === type)!;
        const newStep: WorkflowStep = {
            id: `step-${Date.now()}`,
            type,
            label: `${stepType.label} ${steps.length + 1}`,
            config: '',
        };
        setSteps(prev => [...prev, newStep]);
        setShowStepPicker(false);
    };

    const removeStep = (id: string) => {
        setSteps(prev => prev.filter(s => s.id !== id));
    };

    const moveStep = (id: string, direction: 'up' | 'down') => {
        setSteps(prev => {
            const idx = prev.findIndex(s => s.id === id);
            if (idx < 0) return prev;
            const newIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= prev.length) return prev;
            const copy = [...prev];
            [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
            return copy;
        });
    };

    const handleSave = () => {
        if (!workflowName.trim()) {
            showToast({ message: 'Please enter a workflow name', type: 'warning' });
            return;
        }
        if (steps.length === 0) {
            showToast({ message: 'Add at least one step', type: 'warning' });
            return;
        }
        showToast({ message: `Workflow "${workflowName}" saved with ${steps.length} steps`, type: 'success' });
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <GCHeader
                eyebrow="Automation"
                title="Workflows"
                subtitle="Build multi-step automation pipelines"
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView contentContainerStyle={s.content}>
                {/* Workflow Name */}
                <FadeIn delay={100}>
                    <GCCard style={s.section}>
                        <Text style={s.sectionTitle}>WORKFLOW NAME</Text>
                        <TextInput
                            style={s.nameInput}
                            value={workflowName}
                            onChangeText={setWorkflowName}
                            placeholder="My Automation Workflow"
                            placeholderTextColor={colors.textDim}
                        />
                    </GCCard>
                </FadeIn>

                {/* Pipeline Visualization */}
                <FadeIn delay={200}>
                    <GCCard style={s.section}>
                        <View style={s.pipelineHeader}>
                            <Text style={s.sectionTitle}>PIPELINE STEPS</Text>
                            <Text style={s.stepCount}>{steps.length} step{steps.length !== 1 ? 's' : ''}</Text>
                        </View>

                        {steps.length === 0 ? (
                            <View style={s.emptyPipeline}>
                                <Ionicons name="layers-outline" size={36} color={colors.textDim} />
                                <Text style={s.emptyText}>No steps yet</Text>
                                <Text style={s.emptySubtext}>Add steps to build your workflow</Text>
                            </View>
                        ) : (
                            steps.map((step, idx) => {
                                const stepType = STEP_TYPES.find(t => t.type === step.type)!;
                                return (
                                    <View key={step.id}>
                                        <View style={s.stepCard}>
                                            <View style={s.stepLeft}>
                                                <View style={s.stepNumber}>
                                                    <Text style={s.stepNumText}>{idx + 1}</Text>
                                                </View>
                                                {idx < steps.length - 1 && <View style={s.stepLine} />}
                                            </View>
                                            <View style={s.stepContent}>
                                                <View style={s.stepHeader}>
                                                    <View style={[s.stepIcon, { backgroundColor: stepType.color + '22', borderColor: stepType.color + '44' }]}>
                                                        <Ionicons name={stepType.icon} size={14} color={stepType.color} />
                                                    </View>
                                                    <Text style={s.stepLabel}>{step.label}</Text>
                                                    <GCStatusChip tone="muted">{step.type.toUpperCase()}</GCStatusChip>
                                                </View>
                                                <TextInput
                                                    style={s.stepConfig}
                                                    value={step.config}
                                                    onChangeText={text => {
                                                        setSteps(prev => prev.map(s =>
                                                            s.id === step.id ? { ...s, config: text } : s
                                                        ));
                                                    }}
                                                    placeholder="Step configuration..."
                                                    placeholderTextColor={colors.textDim}
                                                    multiline
                                                />
                                                <View style={s.stepActions}>
                                                    <Pressable onPress={() => moveStep(step.id, 'up')} disabled={idx === 0}>
                                                        <Ionicons name="arrow-up" size={16} color={idx === 0 ? colors.textDim : colors.cyan} />
                                                    </Pressable>
                                                    <Pressable onPress={() => moveStep(step.id, 'down')} disabled={idx === steps.length - 1}>
                                                        <Ionicons name="arrow-down" size={16} color={idx === steps.length - 1 ? colors.textDim : colors.cyan} />
                                                    </Pressable>
                                                    <Pressable onPress={() => removeStep(step.id)}>
                                                        <Ionicons name="trash-outline" size={16} color={colors.crimson} />
                                                    </Pressable>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        )}

                        {/* Add Step Button */}
                        <Pressable
                            style={s.addStepBtn}
                            onPress={() => setShowStepPicker(!showStepPicker)}
                        >
                            <Ionicons name="add-circle" size={20} color={colors.cyan} />
                            <Text style={s.addStepText}>ADD STEP</Text>
                        </Pressable>

                        {/* Step Type Picker */}
                        {showStepPicker && (
                            <View style={s.stepPicker}>
                                {STEP_TYPES.map(st => (
                                    <Pressable
                                        key={st.type}
                                        style={({ pressed }) => [s.pickerItem, pressed && s.pickerItemPressed]}
                                        onPress={() => addStep(st.type)}
                                    >
                                        <View style={[s.pickerIcon, { borderColor: st.color + '44' }]}>
                                            <Ionicons name={st.icon} size={16} color={st.color} />
                                        </View>
                                        <Text style={s.pickerLabel}>{st.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </GCCard>
                </FadeIn>

                {/* Save Button */}
                <FadeIn delay={300}>
                    <View style={s.actionRow}>
                        <GCButton title="Save Workflow" onPress={handleSave} variant="primary" size="md" />
                    </View>
                </FadeIn>

                <View style={{ height: 32 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 32 },
    section: { marginBottom: spacing.lg },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.sm },
    nameInput: {
        backgroundColor: colors.bgInput, borderRadius: radii.sm,
        borderWidth: 1, borderColor: colors.borderCyan,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
        color: colors.textPrimary, ...typography.bodyMd,
    },

    pipelineHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: spacing.md,
    },
    stepCount: { ...typography.caption, color: colors.textDim },

    emptyPipeline: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
    emptyText: { ...typography.bodyMd, color: colors.textMuted },
    emptySubtext: { ...typography.caption, color: colors.textDim },

    stepCard: { flexDirection: 'row', marginBottom: spacing.sm },
    stepLeft: { alignItems: 'center', width: 32 },
    stepNumber: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: colors.cyanMuted, alignItems: 'center', justifyContent: 'center',
    },
    stepNumText: { ...typography.caption, color: colors.cyan, fontWeight: '700' },
    stepLine: {
        width: 2, flex: 1,
        backgroundColor: colors.borderCyan, marginTop: 4,
    },
    stepContent: {
        flex: 1, backgroundColor: colors.bgInset,
        borderRadius: radii.sm, padding: spacing.md,
        borderWidth: 1, borderColor: colors.borderQuiet, marginLeft: spacing.sm,
    },
    stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    stepIcon: {
        width: 28, height: 28, borderRadius: 14, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    stepLabel: { ...typography.bodySm, color: colors.textPrimary, flex: 1, fontWeight: '600' },
    stepConfig: {
        backgroundColor: colors.bgCore, borderRadius: radii.sm,
        borderWidth: 1, borderColor: colors.borderQuiet,
        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        color: colors.textSecondary, ...typography.bodySm,
        fontFamily: 'monospace', minHeight: 40,
    },
    stepActions: {
        flexDirection: 'row', gap: spacing.lg, justifyContent: 'flex-end',
        marginTop: spacing.sm,
    },

    addStepBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.sm, paddingVertical: spacing.md,
        borderWidth: 1, borderColor: colors.borderCyan, borderStyle: 'dashed',
        borderRadius: radii.sm, marginTop: spacing.sm,
    },
    addStepText: { ...typography.eyebrow, color: colors.cyan },

    stepPicker: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
        marginTop: spacing.md, paddingTop: spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderQuiet,
    },
    pickerItem: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: colors.bgCard, borderRadius: radii.sm,
        borderWidth: 1, borderColor: colors.borderQuiet,
    },
    pickerItemPressed: { opacity: 0.7 },
    pickerIcon: {
        width: 28, height: 28, borderRadius: 14, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(84,221,255,0.04)',
    },
    pickerLabel: { ...typography.bodySm, color: colors.textPrimary },

    actionRow: { marginTop: spacing.md },
});
