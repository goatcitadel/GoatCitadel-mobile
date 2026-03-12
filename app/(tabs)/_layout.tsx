/**
 * GoatCitadel Mobile — Tab Navigation
 */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../src/theme/tokens';

export default function TabLayout() {
    const insets = useSafeAreaInsets();
    const bottomPad = Math.max(insets.bottom, 20);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    ...styles.tabBar,
                    height: 56 + bottomPad,
                    paddingBottom: bottomPad,
                },
                tabBarActiveTintColor: colors.tabActive,
                tabBarInactiveTintColor: colors.tabInactive,
                tabBarLabelStyle: styles.tabLabel,
                tabBarItemStyle: styles.tabItem,
                tabBarHideOnKeyboard: Platform.OS === 'android',
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
            <Tabs.Screen name="pulse" options={{ href: null }} />
            <Tabs.Screen name="sessions" options={{ href: null }} />
            <Tabs.Screen name="settings" options={{ href: null }} />
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
});
