/**
 * GoatCitadel Mobile — Tab Navigation
 */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { adaptiveLayout, colors, typography } from '../../src/theme/tokens';

export default function TabLayout() {
    const insets = useSafeAreaInsets();
    const layout = useLayout();
    const bottomInset = useBottomInsetPadding(0, { androidFallbackInset: 20 });
    const bottomPad = Math.max(bottomInset, 20);
    const sidebarPad = Math.max(insets.top, 16);
    const isSidebar = layout.navMode === 'sidebar';

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    ...styles.tabBar,
                    ...(isSidebar
                        ? {
                            width: adaptiveLayout.railWidth,
                            paddingTop: sidebarPad,
                            paddingBottom: Math.max(insets.bottom, 16),
                            borderTopWidth: 0,
                            borderRightWidth: 1,
                            borderRightColor: colors.tabBarBorder,
                        }
                        : {
                            height: 56 + bottomPad,
                            paddingBottom: bottomPad,
                        }),
                },
                tabBarPosition: isSidebar ? 'left' : 'bottom',
                tabBarVariant: isSidebar ? 'material' : 'uikit',
                tabBarActiveTintColor: colors.tabActive,
                tabBarInactiveTintColor: colors.tabInactive,
                tabBarLabelStyle: styles.tabLabel,
                tabBarItemStyle: isSidebar ? styles.tabItemSidebar : styles.tabItem,
                tabBarHideOnKeyboard: Platform.OS === 'android',
                sceneStyle: {
                    backgroundColor: colors.bgCore,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Summit',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="shield-checkmark" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: 'Chat',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="chatbubbles" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="approvals"
                options={{
                    title: 'Gatehouse',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="lock-closed" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="herd"
                options={{
                    title: 'Herd',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="people" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="more"
                options={{
                    title: 'More',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="grid" size={size} color={color} />
                    ),
                }}
            />
            {/* Hidden tabs — accessible from More menu only */}
            <Tabs.Screen name="cowork" options={{ href: null }} />
            <Tabs.Screen name="code" options={{ href: null }} />
            <Tabs.Screen name="canvas" options={{ href: null }} />
            <Tabs.Screen name="parity" options={{ href: null }} />
            <Tabs.Screen name="pulse" options={{ href: null }} />
            <Tabs.Screen name="sessions" options={{ href: null }} />
            <Tabs.Screen name="settings" options={{ href: null }} />
            <Tabs.Screen name="privacy" options={{ href: null }} />
            <Tabs.Screen name="skills" options={{ href: null }} />
            <Tabs.Screen name="mcp" options={{ href: null }} />
            <Tabs.Screen name="notifications" options={{ href: null }} />
            <Tabs.Screen name="logs" options={{ href: null }} />
            <Tabs.Screen name="costs" options={{ href: null }} />
            <Tabs.Screen name="bookmarks" options={{ href: null }} />
            <Tabs.Screen name="health" options={{ href: null }} />
            <Tabs.Screen name="workflows" options={{ href: null }} />
            <Tabs.Screen name="agent" options={{ href: null }} />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: colors.tabBarBg,
        borderTopColor: colors.tabBarBorder,
        borderTopWidth: 1,
        paddingTop: 8,
        elevation: 0,
    },
    tabLabel: {
        fontFamily: typography.bodyFont,
        fontSize: 11,
        lineHeight: 13,
        letterSpacing: 0.2,
        fontWeight: '600',
    },
    tabItem: {
        paddingTop: 4,
    },
    tabItemSidebar: {
        paddingVertical: 10,
    },
});
