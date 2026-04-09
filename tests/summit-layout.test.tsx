import React from 'react';
import { render, screen } from '@testing-library/react-native';
import SummitScreen from '../app/(tabs)/index';

const mockUseLayout = jest.fn();
const mockUseApiData = jest.fn();

jest.mock('../src/hooks/useLayout', () => ({
    useLayout: () => mockUseLayout(),
}));

jest.mock('../src/hooks/useApiData', () => ({
    useApiData: (...args: unknown[]) => mockUseApiData(...args),
}));

jest.mock('../src/hooks/useBottomInsetPadding', () => ({
    useBottomInsetPadding: () => 32,
}));

jest.mock('../src/context/NotificationContext', () => ({
    useNotifications: () => ({ unreadCount: 2 }),
}));

jest.mock('../src/context/QuickCommandContext', () => ({
    useQuickCommand: () => ({ toggle: jest.fn() }),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../src/components/layout', () => ({
    AdaptiveContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ContextPane: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    MasterDetailShell: ({ master, detail, inspector }: any) => {
        const React = require('react');
        const { Text } = require('react-native');

        return (
            <>
                <Text testID="master-detail-shell">master-detail-shell</Text>
                {master}
                {detail}
                {inspector}
            </>
        );
    },
    SectionGrid: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../src/components/ui', () => ({
    GCHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => {
        const React = require('react');
        const { Text } = require('react-native');

        return (
            <>
                <Text>{title}</Text>
                {subtitle ? <Text>{subtitle}</Text> : null}
            </>
        );
    },
    GCCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    GCStatCard: ({ label, value }: { label: string; value: string }) => {
        const React = require('react');
        const { Text } = require('react-native');
        return <Text>{`${label}:${value}`}</Text>;
    },
    GCStatusChip: ({ children }: { children: React.ReactNode }) => {
        const React = require('react');
        const { Text } = require('react-native');
        return <Text>{children}</Text>;
    },
    GCButton: ({ title }: { title: string }) => {
        const React = require('react');
        const { Text } = require('react-native');
        return <Text>{title}</Text>;
    },
    FadeIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SkeletonBlock: () => {
        const React = require('react');
        const { Text } = require('react-native');
        return <Text>Skeleton</Text>;
    },
    PulseDot: () => {
        const React = require('react');
        const { Text } = require('react-native');
        return <Text>PulseDot</Text>;
    },
    AnimatedCounter: ({ value }: { value: number }) => {
        const React = require('react');
        const { Text } = require('react-native');
        return <Text>{String(value)}</Text>;
    },
    GlowBorder: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Summit adaptive regression harness', () => {
    beforeEach(() => {
        mockUseApiData.mockReset();
    });

    it('avoids mounting the split shell when the tablet detail column is empty', () => {
        mockUseLayout.mockReturnValue({
            dualPane: true,
            triplePane: false,
        });
        mockUseApiData
            .mockReturnValueOnce({
                data: {
                    pendingApprovals: 1,
                    activeSubagents: 0,
                    dailyCostUsd: 0.0018,
                    sessions: [],
                    taskStatusCounts: [],
                    recentEvents: [],
                },
                loading: false,
                refreshing: false,
                refresh: jest.fn(),
                reload: jest.fn(),
            })
            .mockReturnValueOnce({
                data: undefined,
                loading: false,
                refreshing: false,
                refresh: jest.fn(),
                reload: jest.fn(),
            });

        render(<SummitScreen />);

        expect(screen.queryByTestId('master-detail-shell')).toBeNull();
        expect(screen.queryByText('COMMAND CONTEXT')).toBeNull();
    });

    it('keeps command context visible on wide tablet layouts', () => {
        mockUseLayout.mockReturnValue({
            dualPane: true,
            triplePane: true,
        });
        mockUseApiData
            .mockReturnValueOnce({
                data: {
                    pendingApprovals: 1,
                    activeSubagents: 2,
                    dailyCostUsd: 0.0018,
                    sessions: [],
                    taskStatusCounts: [],
                    recentEvents: [],
                },
                loading: false,
                refreshing: false,
                refresh: jest.fn(),
                reload: jest.fn(),
            })
            .mockReturnValueOnce({
                data: undefined,
                loading: false,
                refreshing: false,
                refresh: jest.fn(),
                reload: jest.fn(),
            });

        render(<SummitScreen />);

        expect(screen.getByTestId('master-detail-shell')).toBeTruthy();
        expect(screen.getByText('COMMAND CONTEXT')).toBeTruthy();
    });
});
