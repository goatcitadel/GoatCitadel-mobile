import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../theme/tokens';
import * as Haptics from 'expo-haptics';

export type ToastOptions = {
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    durationMs?: number;
};

interface ToastContextType {
    showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => { } });

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<ToastOptions | null>(null);
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showToast = (options: ToastOptions) => {
        setToast(options);

        if (Platform.OS !== 'web') {
            if (options.type === 'error') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } else if (options.type === 'success') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
        }

        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 50,
                useNativeDriver: true,
                speed: 12,
                bounciness: 4,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start();

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => hideToast(), options.durationMs || 3000);
    };

    const hideToast = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => setToast(null));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast ? (
                <Animated.View style={[s.toastContainer, { transform: [{ translateY }], opacity }]}>
                    <View style={[s.toast,
                    toast.type === 'error' && s.toastError,
                    toast.type === 'success' && s.toastSuccess,
                    toast.type === 'warning' && s.toastWarning
                    ]}>
                        <Ionicons
                            name={toast.type === 'error' ? 'alert-circle' : toast.type === 'warning' ? 'warning' : toast.type === 'success' ? 'checkmark-circle' : 'information-circle'}
                            size={20}
                            color={colors.bgCore}
                        />
                        <Text style={s.toastText}>{toast.message}</Text>
                    </View>
                </Animated.View>
            ) : null}
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);

const s = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.cyan,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radii.pill,
        gap: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    toastError: { backgroundColor: colors.crimson },
    toastSuccess: { backgroundColor: colors.success },
    toastWarning: { backgroundColor: colors.ember },
    toastText: {
        ...typography.bodyMd,
        color: colors.bgCore,
        fontWeight: '600',
    }
});
