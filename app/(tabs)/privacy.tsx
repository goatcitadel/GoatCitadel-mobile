import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { AdaptiveContainer } from '../../src/components/layout';
import { GCButton, GCCard, GCHeader, GCStatusChip } from '../../src/components/ui';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import {
    PHONE_ASSIST_CAPABILITY_DEFINITIONS,
    type PhoneAssistCapabilityId,
    type PhoneAssistConsentRecord,
    type PhoneAssistPrivacySettings,
    type PhoneAssistAuditEvent,
    type PhoneAssistCapabilityDefinition,
    grantCapabilityConsent,
    revokeCapabilityConsent,
    getPhoneAssistPrivacyState,
    triggerPhoneAssistPanicOff,
    updatePhoneAssistPrivacySettings,
    fetchNativePhoneAssistCapabilities,
    requestNativePhoneAssistEnable,
    revokeNativePhoneAssist,
    triggerNativePhoneAssistPanicOff,
    evaluateCapabilityPolicy,
} from '../../src/features/phoneAssist';
import { useToast } from '../../src/context/ToastContext';
import { useShareIntents } from '../../src/context/ShareIntentContext';

type CapabilityViewModel = {
    definition: PhoneAssistCapabilityDefinition;
    id: PhoneAssistCapabilityId;
    label: string;
    summary: string;
    stateLabel: string;
    tone: 'success' | 'warning' | 'critical' | 'muted';
    canAccess: string[];
    mustNeverAccess: string[];
    retention: string;
    disclosure: string;
    implementationStatus: string;
    consentRequired: boolean;
    actionMode: 'grant' | 'revoke' | 'none' | 'blocked';
    actionLabel?: string;
    actionDisabled?: boolean;
    actionNote?: string;
};

export default function PrivacyCenterScreen() {
    const router = useRouter();
    const bottomPad = useBottomInsetPadding(32);
    const { showToast } = useToast();
    const { pendingDrafts, dismissDraft, clearDrafts, refreshDrafts } = useShareIntents();
    const [settings, setSettings] = useState<PhoneAssistPrivacySettings | null>(null);
    const [consents, setConsents] = useState<PhoneAssistConsentRecord[]>([]);
    const [audit, setAudit] = useState<PhoneAssistAuditEvent[]>([]);
    const [nativeStates, setNativeStates] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        const [{ settings: nextSettings, consents: nextConsents, audit: nextAudit }, nativeCapabilities] = await Promise.all([
            getPhoneAssistPrivacyState(),
            fetchNativePhoneAssistCapabilities(),
        ]);
        setSettings(nextSettings);
        setConsents(nextConsents);
        setAudit(nextAudit);
        setNativeStates(
            nativeCapabilities.reduce<Record<string, string>>((acc, capability) => {
                acc[capability.id] = capability.state.kind;
                return acc;
            }, {}),
        );
        setLoading(false);
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const activeConsentIds = useMemo(() => new Set(
        consents
            .filter((record) => record.granted && !record.revokedAt)
            .map((record) => record.capability),
    ), [consents]);

    const capabilityModels = useMemo<CapabilityViewModel[]>(() => (
        Object.values(PHONE_ASSIST_CAPABILITY_DEFINITIONS).map((definition) => {
            const nativeState = nativeStates[definition.id];
            const hasConsent = activeConsentIds.has(definition.id);
            const futureBlocked = definition.featureFlag !== 'consumer_mvp';
            const tone = hasConsent
                ? 'success'
                : futureBlocked
                    ? 'critical'
                    : definition.consentRequired
                    ? 'warning'
                    : 'muted';
            const stateLabel = hasConsent
                ? 'ENABLED'
                : futureBlocked
                    ? 'BLOCKED'
                    : nativeState === 'available'
                    ? 'READY'
                    : nativeState === 'needs-consent' || definition.consentRequired
                        ? 'CONSENT NEEDED'
                        : 'READY';
            const actionMode = hasConsent
                ? 'revoke'
                : futureBlocked
                    ? 'blocked'
                    : definition.consentRequired
                        ? 'grant'
                        : 'none';

            return {
                definition,
                id: definition.id,
                label: definition.label,
                summary: definition.summary,
                stateLabel,
                tone,
                canAccess: definition.canAccess,
                mustNeverAccess: definition.mustNeverAccess,
                retention: definition.retention,
                disclosure: definition.userDisclosure,
                implementationStatus: definition.implementationStatus,
                consentRequired: definition.consentRequired,
                actionMode,
                actionLabel: actionMode === 'grant'
                    ? 'Review Disclosure'
                    : actionMode === 'revoke'
                        ? 'Revoke'
                        : undefined,
                actionDisabled: loading,
                actionNote: futureBlocked
                    ? definition.defaultState.kind === 'blocked'
                        ? definition.defaultState.reason
                        : 'This capability is not available in this build.'
                    : !definition.consentRequired
                        ? 'This lane is user-initiated and available without special access.'
                        : undefined,
            };
        })
    ), [activeConsentIds, loading, nativeStates]);

    const handleConsentGrant = useCallback((capabilityId: PhoneAssistCapabilityId) => {
        const definition = PHONE_ASSIST_CAPABILITY_DEFINITIONS[capabilityId];
        Alert.alert(
            definition.label,
            `${definition.userDisclosure}\n\nCan access:\n- ${definition.canAccess.join('\n- ')}\n\nWill not access:\n- ${definition.mustNeverAccess.join('\n- ')}`,
            [
                { text: 'Not now', style: 'cancel' },
                {
                    text: 'I understand',
                    onPress: async () => {
                        await requestNativePhoneAssistEnable(capabilityId);
                        await grantCapabilityConsent(capabilityId);
                        await refresh();
                        showToast({ message: `${definition.label} consent recorded`, type: 'success' });
                    },
                },
            ],
        );
    }, [refresh, showToast]);

    const handleConsentRevoke = useCallback((capabilityId: PhoneAssistCapabilityId) => {
        const definition = PHONE_ASSIST_CAPABILITY_DEFINITIONS[capabilityId];
        Alert.alert(
            `Revoke ${definition.label}?`,
            'Citadel will stop using this capability and keep only the audit receipt.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Revoke',
                    style: 'destructive',
                    onPress: async () => {
                        await revokeNativePhoneAssist(capabilityId, 'Revoked from Privacy Center.');
                        await revokeCapabilityConsent(capabilityId);
                        await refresh();
                        showToast({ message: `${definition.label} revoked`, type: 'warning' });
                    },
                },
            ],
        );
    }, [refresh, showToast]);

    const toggleCloudSync = useCallback(async () => {
        if (!settings) {
            return;
        }
        const next = await updatePhoneAssistPrivacySettings({
            cloudSyncEnabled: !settings.cloudSyncEnabled,
        });
        setSettings(next);
        await refresh();
        showToast({
            message: next.cloudSyncEnabled
                ? 'Cloud sync enabled for sanitized exports'
                : 'Cloud sync disabled',
            type: next.cloudSyncEnabled ? 'success' : 'warning',
        });
    }, [refresh, settings, showToast]);

    const cycleRetention = useCallback(async () => {
        if (!settings) {
            return;
        }
        const nextDays = settings.retainAuditDays === 7
            ? 30
            : settings.retainAuditDays === 30
                ? 90
                : 7;
        const next = await updatePhoneAssistPrivacySettings({ retainAuditDays: nextDays });
        setSettings(next);
        await refresh();
        showToast({ message: `Audit retention set to ${nextDays} days`, type: 'success' });
    }, [refresh, settings, showToast]);

    const handlePanicOff = useCallback(() => {
        Alert.alert(
            'Emergency disable',
            'This revokes all active phone-assist consents, disables cloud sync defaults, and records a local audit receipt.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disable now',
                    style: 'destructive',
                    onPress: async () => {
                        await Promise.allSettled([
                            triggerPhoneAssistPanicOff(),
                            triggerNativePhoneAssistPanicOff(),
                        ]);
                        await refreshDrafts();
                        await refresh();
                        showToast({ message: 'Emergency disable triggered', type: 'warning' });
                    },
                },
            ],
        );
    }, [refresh, refreshDrafts, showToast]);

    const copyAuditTrail = useCallback(async () => {
        await Clipboard.setStringAsync(JSON.stringify(audit.slice(0, 25), null, 2));
        showToast({ message: 'Recent audit entries copied', type: 'success' });
    }, [audit, showToast]);

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Trust Controls"
                title="Privacy Center"
                subtitle="Consent receipts, local policy defaults, and emergency disable."
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
                <AdaptiveContainer style={styles.content}>
                    <GCCard variant="warning" style={styles.section}>
                        <Text style={styles.sectionTitle}>PLAY-SAFE POSTURE</Text>
                        <Text style={styles.body}>
                            Citadel Mobile only assists with content you share, sessions you start, or capability lanes you explicitly enable.
                            It does not read your SMS inbox, call log, or screen by default.
                        </Text>
                        <View style={styles.actionRow}>
                            <GCButton
                                title={settings?.cloudSyncEnabled ? 'Disable Cloud Sync' : 'Enable Cloud Sync'}
                                onPress={() => void toggleCloudSync()}
                                variant={settings?.cloudSyncEnabled ? 'danger' : 'secondary'}
                                size="sm"
                            />
                            <GCButton title="Emergency Disable" onPress={handlePanicOff} variant="danger" size="sm" />
                        </View>
                        <View style={styles.metaRow}>
                            <MetaStat label="Cloud sync" value={settings?.cloudSyncEnabled ? 'Sanitized only' : 'Off'} />
                            <MetaStat label="Audit retention" value={`${String(settings?.retainAuditDays ?? 30)} days`} />
                            <MetaStat label="Consent receipts" value={String(consents.length)} />
                        </View>
                    </GCCard>

                    <GCCard style={styles.section}>
                        <Text style={styles.sectionTitle}>LOCAL PRIVACY DEFAULTS</Text>
                        <View style={styles.settingsRow}>
                            <Pressable style={styles.settingChip} onPress={() => void cycleRetention()}>
                                <Text style={styles.settingLabel}>Rotate retention</Text>
                                <Text style={styles.settingValue}>{settings?.retainAuditDays ?? 30} days</Text>
                            </Pressable>
                            <View style={styles.settingChip}>
                                <Text style={styles.settingLabel}>Redacted export</Text>
                                <Text style={styles.settingValue}>{settings?.exportRedactedByDefault ? 'On' : 'Off'}</Text>
                            </View>
                            <View style={styles.settingChip}>
                                <Text style={styles.settingLabel}>Background indicators</Text>
                                <Text style={styles.settingValue}>{settings?.showBackgroundIndicators ? 'Required' : 'Off'}</Text>
                            </View>
                        </View>
                        {settings?.panicOffLatchedAt ? (
                            <Text style={styles.caption}>
                                Last emergency disable: {new Date(settings.panicOffLatchedAt).toLocaleString()}
                            </Text>
                        ) : null}
                    </GCCard>

                    <View style={styles.sectionStack}>
                        {capabilityModels.map((capability) => (
                            <CapabilityCard
                                key={capability.id}
                                capability={capability}
                                hasConsent={activeConsentIds.has(capability.id)}
                                loading={loading}
                                onGrant={() => handleConsentGrant(capability.id)}
                                onRevoke={() => handleConsentRevoke(capability.id)}
                            />
                        ))}
                    </View>

                    <GCCard style={styles.section}>
                        <View style={styles.headerRow}>
                            <Text style={styles.sectionTitle}>SHARE REVIEW QUEUE</Text>
                            <GCStatusChip tone={pendingDrafts.length > 0 ? 'warning' : 'muted'}>
                                {pendingDrafts.length === 1 ? '1 PENDING' : `${pendingDrafts.length} PENDING`}
                            </GCStatusChip>
                        </View>
                        {pendingDrafts.length === 0 ? (
                            <Text style={styles.caption}>No shared drafts are waiting for review.</Text>
                        ) : (
                            <>
                                {pendingDrafts.map((draft) => (
                                    <View key={draft.draftId} style={styles.listRow}>
                                        <View style={styles.listBody}>
                                            <Text style={styles.listTitle}>
                                                {draft.subject || draft.text || draft.attachment?.fileName || 'Shared content'}
                                            </Text>
                                            <Text style={styles.caption}>
                                                {new Date(draft.receivedAt).toLocaleString()}
                                                {draft.attachment ? ` · ${draft.attachment.mimeType}` : ''}
                                            </Text>
                                        </View>
                                        <GCButton
                                            title="Dismiss"
                                            onPress={() => void dismissDraft(draft.draftId)}
                                            variant="secondary"
                                            size="sm"
                                        />
                                    </View>
                                ))}
                                <View style={styles.actionRow}>
                                    <GCButton title="Open Review Queue" onPress={() => router.push('/share-review' as any)} variant="secondary" size="sm" />
                                    <GCButton title="Clear Queue" onPress={() => void clearDrafts()} variant="danger" size="sm" />
                                </View>
                            </>
                        )}
                    </GCCard>

                    <GCCard style={styles.section}>
                        <View style={styles.headerRow}>
                            <Text style={styles.sectionTitle}>CONSENT RECEIPTS</Text>
                            <GCStatusChip tone="muted">{`${consents.length} TOTAL`}</GCStatusChip>
                        </View>
                        {consents.length === 0 ? (
                            <Text style={styles.caption}>No capability consents recorded on this device yet.</Text>
                        ) : (
                            consents.slice(0, 6).map((consent) => (
                                <View key={consent.consentId} style={styles.listRow}>
                                    <View style={styles.listBody}>
                                        <Text style={styles.listTitle}>{PHONE_ASSIST_CAPABILITY_DEFINITIONS[consent.capability].label}</Text>
                                        <Text style={styles.caption}>
                                            {consent.granted ? 'Granted' : 'Denied'} · {new Date(consent.grantedAt).toLocaleString()}
                                            {consent.revokedAt ? ` · revoked ${new Date(consent.revokedAt).toLocaleString()}` : ''}
                                        </Text>
                                    </View>
                                    <GCStatusChip tone={consent.revokedAt ? 'warning' : 'success'}>
                                        {consent.revokedAt ? 'REVOKED' : 'ACTIVE'}
                                    </GCStatusChip>
                                </View>
                            ))
                        )}
                    </GCCard>

                    <GCCard style={styles.section}>
                        <View style={styles.headerRow}>
                            <Text style={styles.sectionTitle}>AUDIT TRAIL</Text>
                            <GCButton title="Copy JSON" onPress={() => void copyAuditTrail()} variant="secondary" size="sm" />
                        </View>
                        {audit.length === 0 ? (
                            <Text style={styles.caption}>No phone-assist audit entries yet.</Text>
                        ) : (
                            audit.slice(0, 8).map((event) => (
                                <View key={event.eventId} style={styles.auditRow}>
                                    <View style={styles.auditDot} />
                                    <View style={styles.listBody}>
                                        <Text style={styles.listTitle}>{event.summary}</Text>
                                        <Text style={styles.caption}>
                                            {new Date(event.at).toLocaleString()}
                                            {event.capability ? ` · ${PHONE_ASSIST_CAPABILITY_DEFINITIONS[event.capability].label}` : ''}
                                        </Text>
                                        {event.detail ? <Text style={styles.caption}>{event.detail}</Text> : null}
                                    </View>
                                </View>
                            ))
                        )}
                    </GCCard>

                    <GCCard style={styles.section}>
                        <Text style={styles.sectionTitle}>LOCAL POLICY ENGINE</Text>
                        {capabilityModels.map((capability) => (
                            <PolicyRow key={capability.id} capabilityId={capability.id} />
                        ))}
                    </GCCard>
                </AdaptiveContainer>
            </ScrollView>
        </View>
    );
}

function CapabilityCard({
    capability,
    hasConsent,
    loading,
    onGrant,
    onRevoke,
}: {
    capability: CapabilityViewModel;
    hasConsent: boolean;
    loading: boolean;
    onGrant: () => void;
    onRevoke: () => void;
}) {
    return (
        <GCCard
            style={styles.section}
            variant={capability.tone === 'critical' ? 'critical' : capability.tone === 'warning' ? 'warning' : 'default'}
        >
            <View style={styles.headerRow}>
                <View style={styles.listBody}>
                    <Text style={styles.sectionTitle}>{capability.label}</Text>
                    <Text style={styles.body}>{capability.summary}</Text>
                </View>
                <GCStatusChip tone={capability.tone}>{capability.stateLabel}</GCStatusChip>
            </View>
            <Text style={styles.caption}>Implementation: {capability.implementationStatus}</Text>
            <Text style={styles.disclosure}>{capability.disclosure}</Text>
            <Text style={styles.caption}>Background behavior: {capability.definition.disclosure.backgroundBehavior}</Text>
            <Text style={styles.caption}>Processing: {capability.definition.disclosure.processing}</Text>
            <View style={styles.dualList}>
                <View style={styles.dualListCol}>
                    <Text style={styles.listHeading}>Can access</Text>
                    {capability.canAccess.map((item) => <Text key={item} style={styles.caption}>- {item}</Text>)}
                </View>
                <View style={styles.dualListCol}>
                    <Text style={styles.listHeading}>Will never access</Text>
                    {capability.mustNeverAccess.map((item) => <Text key={item} style={styles.caption}>- {item}</Text>)}
                </View>
            </View>
            <Text style={styles.caption}>Retention: {capability.retention}</Text>
            {capability.actionMode === 'grant' ? (
                <View style={styles.actionRow}>
                    <GCButton title={capability.actionLabel || 'Review Disclosure'} onPress={onGrant} variant="secondary" size="sm" disabled={capability.actionDisabled || loading} />
                </View>
            ) : null}
            {capability.actionMode === 'revoke' ? (
                <View style={styles.actionRow}>
                    <GCButton title={capability.actionLabel || 'Revoke'} onPress={onRevoke} variant="danger" size="sm" disabled={capability.actionDisabled || loading} />
                </View>
            ) : null}
            {capability.actionMode === 'none' || capability.actionMode === 'blocked' ? (
                <Text style={styles.caption}>{capability.actionNote}</Text>
            ) : null}
        </GCCard>
    );
}

function PolicyRow({ capabilityId }: { capabilityId: PhoneAssistCapabilityId }) {
    const [reason, setReason] = useState('Evaluating…');
    const [tone, setTone] = useState<'success' | 'warning' | 'critical' | 'muted'>('muted');

    useEffect(() => {
        void (async () => {
            const decision = await evaluateCapabilityPolicy(capabilityId);
            setReason(decision.reason);
            setTone(
                decision.allowed
                    ? 'success'
                    : decision.requiresFeatureFlag
                        ? 'critical'
                        : decision.requiresConsent
                            ? 'warning'
                            : 'muted',
            );
        })();
    }, [capabilityId]);

    return (
        <View style={styles.listRow}>
            <View style={styles.listBody}>
                <Text style={styles.listTitle}>{PHONE_ASSIST_CAPABILITY_DEFINITIONS[capabilityId].label}</Text>
                <Text style={styles.caption}>{reason}</Text>
            </View>
            <GCStatusChip tone={tone}>
                {tone === 'success' ? 'ALLOW' : tone === 'warning' ? 'CONSENT' : tone === 'critical' ? 'BLOCK' : 'LOCAL'}
            </GCStatusChip>
        </View>
    );
}

function MetaStat({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.metaStat}>
            <Text style={styles.settingLabel}>{label}</Text>
            <Text style={styles.settingValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { gap: spacing.lg, paddingBottom: spacing.xl },
    section: { marginBottom: spacing.lg },
    sectionStack: { gap: spacing.lg },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.sm },
    body: { ...typography.bodyMd, color: colors.textSecondary },
    caption: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
    disclosure: {
        ...typography.bodySm,
        color: colors.textPrimary,
        marginTop: spacing.sm,
        marginBottom: spacing.md,
    },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    metaStat: {
        flexGrow: 1,
        minWidth: 110,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        borderRadius: radii.sm,
        padding: spacing.md,
        backgroundColor: colors.bgInset,
        gap: spacing.xs,
    },
    settingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    settingChip: {
        flexGrow: 1,
        minWidth: 110,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        borderRadius: radii.sm,
        padding: spacing.md,
        backgroundColor: colors.bgInset,
    },
    settingLabel: { ...typography.caption, color: colors.textDim },
    settingValue: { ...typography.bodySm, color: colors.textPrimary, marginTop: spacing.xs },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing.md,
    },
    dualList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm },
    dualListCol: { flex: 1, minWidth: 220, gap: spacing.xs },
    listHeading: { ...typography.caption, color: colors.cyan },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.borderQuiet,
    },
    auditRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.borderQuiet,
    },
    auditDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.cyan,
        marginTop: spacing.sm,
    },
    listBody: { flex: 1, minWidth: 0 },
    listTitle: { ...typography.bodyMd, color: colors.textPrimary },
});
