import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ChatSessionListScreen from '../app/(tabs)/chat/index';

const mockUseLayout = jest.fn();
const mockUseApiData = jest.fn();
const mockPush = jest.fn();

jest.mock('../src/hooks/useLayout', () => ({
    useLayout: () => mockUseLayout(),
}));

jest.mock('../src/hooks/useApiData', () => ({
    useApiData: (...args: unknown[]) => mockUseApiData(...args),
}));

jest.mock('../src/hooks/useBottomInsetPadding', () => ({
    useBottomInsetPadding: () => 32,
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
}));

jest.mock('../src/context/ToastContext', () => ({
    useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('../src/components/layout', () => ({
    AdaptiveContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ContextPane: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    MasterDetailShell: ({ master, detail }: any) => {
        const React = require('react');
        const { Text } = require('react-native');
        return (
            <>
                <Text testID="master-detail-shell">master-detail-shell</Text>
                {master}
                {detail}
            </>
        );
    },
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
    GCButton: ({ title }: { title: string }) => {
        const React = require('react');
        const { Text } = require('react-native');
        return <Text>{title}</Text>;
    },
}));

jest.mock('../src/features/chat/SessionDetailPane', () => ({
    SessionDetailPane: ({ heading, session }: { heading: string; session?: { title?: string } }) => {
        const React = require('react');
        const { Text } = require('react-native');
        return (
            <>
                <Text>{heading}</Text>
                <Text>{session?.title ?? 'empty'}</Text>
            </>
        );
    },
}));

const sessionData = {
    data: {
        items: [
            {
                sessionId: 'session-1',
                title: 'Primary thread',
                scope: 'mission',
                projectName: 'GoatCitadel',
                lastActivityAt: '2026-04-09T20:00:00.000Z',
                pinned: false,
                tokenTotal: 100,
                costUsdTotal: 0.12,
            },
        ],
    },
    loading: false,
    refreshing: false,
    error: null,
    refresh: jest.fn(),
};

describe('Chat session list adaptive regression harness', () => {
    beforeEach(() => {
        mockUseApiData.mockReset();
        mockPush.mockReset();
    });

    it('stays single-column on phones', () => {
        mockUseLayout.mockReturnValue({ dualPane: false });
        mockUseApiData.mockReturnValue(sessionData);

        render(<ChatSessionListScreen />);

        expect(screen.queryByTestId('master-detail-shell')).toBeNull();
        expect(screen.getByText('Primary thread')).toBeTruthy();
    });

    it('promotes sessions into a master-detail tablet layout', () => {
        mockUseLayout.mockReturnValue({ dualPane: true });
        mockUseApiData.mockReturnValue(sessionData);

        render(<ChatSessionListScreen />);

        expect(screen.getByTestId('master-detail-shell')).toBeTruthy();
        expect(screen.getByText('Selected session')).toBeTruthy();
    });
});
