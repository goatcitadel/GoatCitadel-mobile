/**
 * GoatCitadel Mobile — Quick Command Palette
 * Spotlight-style overlay for rapid navigation and actions.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, Pressable, StyleSheet, Modal,
    Animated, Easing, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLayout } from '../../hooks/useLayout';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radii } from '../../theme/tokens';
import { useQuickCommand, QuickCommand } from '../../context/QuickCommandContext';

export function QuickCommandPalette() {
    const router = useRouter();
    const layout = useLayout();
    const { isOpen, close, commands } = useQuickCommand();
    const [query, setQuery] = useState('');
    const slideAnim = useRef(new Animated.Value(0)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            Animated.parallel([
                Animated.timing(backdropAnim, {
                    toValue: 1, duration: 200, useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 1, speed: 14, bounciness: 3, useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(backdropAnim, {
                    toValue: 0, duration: 150, useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0, duration: 150, useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isOpen]);

    const filtered = commands.filter(cmd => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
            cmd.label.toLowerCase().includes(q) ||
            cmd.keywords.some(k => k.includes(q))
        );
    });

    const handleSelect = (cmd: QuickCommand) => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        close();
        if (cmd.route) {
            setTimeout(() => router.push(cmd.route as any), 100);
        } else if (cmd.action) {
            cmd.action();
        }
    };

    if (!isOpen) return null;

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-50, 0],
    });

    const categoryIcons: Record<string, string> = {
        navigate: 'arrow-forward-circle',
        action: 'flash',
        search: 'search',
    };

    const categoryColors: Record<string, string> = {
        navigate: colors.cyan,
        action: colors.ember,
        search: colors.success,
    };

    return (
        <Modal transparent visible={isOpen} animationType="none" onRequestClose={close}>
            <Pressable style={StyleSheet.absoluteFill} onPress={close}>
                <Animated.View style={[s.backdrop, { opacity: backdropAnim }]} />
            </Pressable>
            <KeyboardAvoidingView
                style={s.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                pointerEvents="box-none"
            >
                <Animated.View
                    style={[
                        s.palette,
                        {
                            opacity: slideAnim,
                            transform: [{ translateY }],
                            alignSelf: 'center',
                            width: '100%',
                            maxWidth: layout.isTablet ? 720 : undefined,
                        },
                    ]}
                >
                    {/* Search Input */}
                    <View style={s.searchRow}>
                        <Ionicons name="search" size={18} color={colors.cyan} />
                        <TextInput
                            style={s.searchInput}
                            placeholder="Type a command…"
                            placeholderTextColor={colors.textDim}
                            value={query}
                            onChangeText={setQuery}
                            autoFocus
                            autoCorrect={false}
                            returnKeyType="go"
                            onSubmitEditing={() => {
                                if (filtered.length > 0) handleSelect(filtered[0]);
                            }}
                        />
                        <Pressable onPress={close}>
                            <Ionicons name="close" size={20} color={colors.textDim} />
                        </Pressable>
                    </View>

                    {/* Results */}
                    <View style={s.results}>
                        {filtered.length === 0 ? (
                            <View style={s.noResults}>
                                <Text style={s.noResultsText}>No matching commands</Text>
                            </View>
                        ) : (
                            filtered.slice(0, 8).map((cmd) => (
                                <Pressable
                                    key={cmd.id}
                                    style={({ pressed }) => [s.resultRow, pressed && s.resultRowPressed]}
                                    onPress={() => handleSelect(cmd)}
                                >
                                    <View style={[s.resultIcon, { borderColor: (categoryColors[cmd.category] || colors.cyan) + '44' }]}>
                                        <Ionicons
                                            name={cmd.icon as any}
                                            size={16}
                                            color={categoryColors[cmd.category] || colors.cyan}
                                        />
                                    </View>
                                    <Text style={s.resultLabel}>{cmd.label}</Text>
                                    <Text style={s.resultCategory}>{cmd.category.toUpperCase()}</Text>
                                </Pressable>
                            ))
                        )}
                    </View>

                    {/* Footer hint */}
                    <View style={s.footer}>
                        <Text style={s.footerText}>
                            ⌘K Quick Command · {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                        </Text>
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    container: {
        flex: 1,
        paddingTop: 80,
        paddingHorizontal: spacing.xl,
    },
    palette: {
        backgroundColor: colors.bgPanelElevatedSolid,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.borderCyan,
        overflow: 'hidden',
        maxHeight: 500,
        shadowColor: colors.cyan,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md + 2,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderCyan,
    },
    searchInput: {
        flex: 1,
        color: colors.textPrimary,
        ...typography.bodyLg,
        paddingVertical: 0,
    },
    results: {
        maxHeight: 350,
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    resultRowPressed: {
        backgroundColor: colors.bgCard,
    },
    resultIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1.5,
        backgroundColor: 'rgba(84,221,255,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    resultLabel: {
        ...typography.bodyMd,
        color: colors.textPrimary,
        flex: 1,
    },
    resultCategory: {
        ...typography.caption,
        color: colors.textDim,
        fontSize: 9,
        letterSpacing: 1,
    },
    noResults: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    noResultsText: {
        ...typography.bodySm,
        color: colors.textDim,
        fontStyle: 'italic',
    },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.borderQuiet,
    },
    footerText: {
        ...typography.caption,
        color: colors.textDim,
        textAlign: 'center',
        fontSize: 10,
    },
});
