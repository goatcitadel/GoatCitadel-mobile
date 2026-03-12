/**
 * GoatCitadel Mobile — Root Layout
 * Font loading, status bar, gesture handling, connection bar.
 */
import React, { useEffect, useState } from 'react';
import { View, StatusBar, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Rajdhani_600SemiBold } from '@expo-google-fonts/rajdhani';
import * as SplashScreen from 'expo-splash-screen';
import { getSecureItem } from '../src/utils/storage';
import { colors } from '../src/theme/tokens';
import { ConnectionBar } from '../src/components/ui';
import { setGatewayUrl, setAuthToken } from '../src/api/client';
import { ToastProvider } from '../src/context/ToastContext';
import { NotificationProvider } from '../src/context/NotificationContext';
import { QuickCommandProvider } from '../src/context/QuickCommandContext';
import { QuickCommandPalette } from '../src/components/ui/QuickCommandPalette';
import { GatewayAccessProvider } from '../src/context/GatewayAccessContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [fontsLoaded] = useFonts({ Rajdhani_600SemiBold });
    const [ready, setReady] = useState(false);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        if (!fontsLoaded) return;

        // Restore saved credentials from secure storage
        (async () => {
            try {
                const savedUrl = await getSecureItem('gc_gateway_url');
                const savedToken = await getSecureItem('gc_auth_token');
                if (savedUrl) setGatewayUrl(savedUrl);
                if (savedToken) setAuthToken(savedToken);
            } catch { }
            setReady(true);
            await SplashScreen.hideAsync();
        })();
    }, [fontsLoaded]);

    if (!fontsLoaded || !ready) return null;

    const isInApp = segments[0] === '(tabs)';

    return (
        <GestureHandlerRootView style={styles.root}>
            <ToastProvider>
                <GatewayAccessProvider>
                    <NotificationProvider>
                        <QuickCommandProvider>
                            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
                            {isInApp ? <ConnectionBar /> : null}
                            <Slot />
                            <QuickCommandPalette />
                        </QuickCommandProvider>
                    </NotificationProvider>
                </GatewayAccessProvider>
            </ToastProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgCore },
});

