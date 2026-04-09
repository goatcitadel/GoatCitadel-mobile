jest.mock('react-native-gesture-handler', () => {
    const React = require('react');
    return {
        Swipeable: ({ children }: { children: React.ReactNode }) => children,
    };
});

jest.mock('@shopify/flash-list', () => {
    const React = require('react');
    const { View } = require('react-native');

    return {
        FlashList: ({
            data = [],
            renderItem,
            ListEmptyComponent = null,
        }: {
            data?: any[];
            renderItem: (item: { item: any; index: number }) => React.ReactNode;
            ListEmptyComponent?: React.ReactNode;
        }) => React.createElement(
            View,
            null,
            data.length > 0
                ? data.map((item, index) => React.createElement(
                    React.Fragment,
                    { key: item?.id ?? item?.sessionId ?? item?.approvalId ?? index },
                    renderItem({ item, index }),
                ))
                : ListEmptyComponent,
        ),
    };
});

jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { Text } = require('react-native');

    return {
        Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
    };
});

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: {
        Light: 'Light',
        Heavy: 'Heavy',
    },
    NotificationFeedbackType: {
        Success: 'Success',
        Error: 'Error',
        Warning: 'Warning',
    },
}));
