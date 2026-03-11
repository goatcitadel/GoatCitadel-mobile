/**
 * GoatCitadel Mobile — GCButton
 */
import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

interface Props {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    style?: ViewStyle;
}

export function GCButton({
    title,
    onPress,
    variant = 'secondary',
    size = 'md',
    disabled,
    style,
}: Props) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.base,
                sizeStyles[size],
                variantStyles[variant],
                pressed && styles.pressed,
                disabled && styles.disabled,
                style,
            ]}
        >
            <Text
                style={[
                    styles.text,
                    textSizeStyles[size],
                    variantTextStyles[variant],
                    disabled && styles.textDisabled,
                ]}
            >
                {title}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: radii.sm,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: {
        opacity: 0.8,
    },
    disabled: {
        opacity: 0.4,
    },
    text: {
        ...typography.eyebrow,
        fontSize: 12,
    },
    textDisabled: {
        color: colors.textDim,
    },
});

const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, minHeight: 32 },
    md: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minHeight: 40 },
    lg: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, minHeight: 48 },
};

const textSizeStyles: Record<string, TextStyle> = {
    sm: { fontSize: 10 },
    md: { fontSize: 12 },
    lg: { fontSize: 13 },
};

const variantStyles: Record<string, ViewStyle> = {
    primary: { backgroundColor: 'rgba(84, 221, 255, 0.15)', borderColor: colors.borderStrong },
    secondary: { backgroundColor: colors.bgCard, borderColor: colors.borderCyan },
    danger: { backgroundColor: colors.crimsonMuted, borderColor: 'rgba(255, 86, 120, 0.34)' },
    ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
};

const variantTextStyles: Record<string, TextStyle> = {
    primary: { color: colors.cyan },
    secondary: { color: colors.textPrimary },
    danger: { color: '#ffd7df' },
    ghost: { color: colors.textMuted },
};
