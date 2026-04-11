/**
 * GoatCitadel Mobile — Root Layout
 * Font loading, status bar, gesture handling, connection bar.
 */
import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Rajdhani_600SemiBold } from '@expo-google-fonts/rajdhani';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '../src/theme/tokens';
import { ConnectionBar } from '../src/components/ui';
import { initializeStoredGatewayAccess } from '../src/api/client';
import { ToastProvider, useToast } from '../src/context/ToastContext';
import { NotificationProvider } from '../src/context/NotificationContext';
import { QuickCommandProvider } from '../src/context/QuickCommandContext';
import { QuickCommandPalette } from '../src/components/ui/QuickCommandPalette';
import { GatewayAccessProvider, useGatewayAccess } from '../src/context/GatewayAccessContext';
import { RealtimeEventsProvider } from '../src/context/RealtimeEventsContext';
import { ShareIntentProvider, useShareIntents } from '../src/context/ShareIntentContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [fontsLoaded] = useFonts({ Rajdhani_600SemiBold });
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!fontsLoaded) return;

        void (async () => {
            try {
                await initializeStoredGatewayAccess();
            } catch { }
            setReady(true);
            await SplashScreen.hideAsync();
        })();
    }, [fontsLoaded]);

    if (!fontsLoaded || !ready) return null;

    return (
        <GestureHandlerRootView style={styles.root}>
            <ToastProvider>
                <GatewayAccessProvider>
                    <RealtimeEventsProvider>
                        <NotificationProvider>
                            <ShareIntentProvider>
                                <QuickCommandProvider>
                                    <RootShell />
                                </QuickCommandProvider>
                            </ShareIntentProvider>
                        </NotificationProvider>
                    </RealtimeEventsProvider>
                </GatewayAccessProvider>
            </ToastProvider>
        </GestureHandlerRootView>
    );
}

function RootShell() {
    const router = useRouter();
    const segments = useSegments();
    const { access } = useGatewayAccess();
    const { pendingDrafts } = useShareIntents();
    const { showToast } = useToast();
    const [routingDraftId, setRoutingDraftId] = useState<string | null>(null);
    const isShareReviewRoute = String(segments[0] ?? '') === 'share-review';

    useEffect(() => {
        if (routingDraftId && !pendingDrafts.some((draft) => draft.draftId === routingDraftId)) {
            setRoutingDraftId(null);
        }
    }, [pendingDrafts, routingDraftId]);

    useEffect(() => {
        const nextDraft = pendingDrafts[0];
        if (!nextDraft || routingDraftId === nextDraft.draftId || isShareReviewRoute) {
            return;
        }

        setRoutingDraftId(nextDraft.draftId);
        router.push('/share-review' as any);
        if (access.status !== 'ready') {
            showToast({
                message: 'Shared content is waiting in the review queue. Connect this phone before opening it in chat.',
                type: 'warning',
            });
        }
    }, [access.status, isShareReviewRoute, pendingDrafts, router, routingDraftId, showToast]);

    const isInApp = segments[0] === '(tabs)';

    return (
        <>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
            {isInApp ? <ConnectionBar /> : null}
            <Slot />
            <QuickCommandPalette />
        </>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgCore },
});
