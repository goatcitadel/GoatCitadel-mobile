import React from 'react';
import { render } from '@testing-library/react-native';
import TabLayout from '../app/(tabs)/_layout';

const mockUseLayout = jest.fn();
const mockUseSafeAreaInsets = jest.fn();
const tabProps: Array<Record<string, unknown>> = [];

jest.mock('../src/hooks/useLayout', () => ({
    useLayout: () => mockUseLayout(),
}));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => mockUseSafeAreaInsets(),
}));

jest.mock('expo-router', () => {
    const React = require('react');

    const Tabs = ({ children, ...props }: any) => {
        tabProps.push(props);
        return <>{children}</>;
    };

    Tabs.Screen = () => null;

    return { Tabs };
});

describe('tab shell regression harness', () => {
    beforeEach(() => {
        tabProps.length = 0;
        mockUseSafeAreaInsets.mockReturnValue({ top: 0, bottom: 0 });
    });

    it('keeps phone navigation on the bottom tab bar', () => {
        mockUseLayout.mockReturnValue({
            navMode: 'bottom-tabs',
            gutter: 20,
        });

        render(<TabLayout />);

        const options = (tabProps[0]?.screenOptions ?? {}) as {
            tabBarPosition?: string;
            tabBarVariant?: string;
        };

        expect(options.tabBarPosition).toBe('bottom');
        expect(options.tabBarVariant).toBe('uikit');
    });

    it('switches tablets onto the persistent left rail', () => {
        mockUseLayout.mockReturnValue({
            navMode: 'sidebar',
            gutter: 28,
        });

        render(<TabLayout />);

        const options = (tabProps[0]?.screenOptions ?? {}) as {
            tabBarPosition?: string;
            tabBarVariant?: string;
        };

        expect(options.tabBarPosition).toBe('left');
        expect(options.tabBarVariant).toBe('material');
    });
});
