import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ApprovalListScreen from '../app/(tabs)/approvals/index';

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

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
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
    GCCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    GCStatusChip: ({ children }: { children: React.ReactNode }) => {
        const React = require('react');
        const { Text } = require('react-native');
        return <Text>{children}</Text>;
    },
}));

jest.mock('../src/api/client', () => ({
    fetchApprovals: jest.fn(),
    resolveApproval: jest.fn(),
}));

const approvalData = {
    data: {
        items: [
            {
                approvalId: 'approval-1',
                kind: 'tool_call',
                status: 'pending',
                riskLevel: 'caution',
                preview: { command: 'rm -rf /tmp' },
                createdAt: '2026-04-09T20:00:00.000Z',
                resolvedAt: undefined,
                explanation: {
                    summary: 'Potentially destructive command',
                    riskExplanation: 'Deletes files from temp storage.',
                    saferAlternative: 'Confirm path before continuing.',
                },
            },
        ],
    },
    loading: false,
    refreshing: false,
    error: null,
    refresh: jest.fn(),
};

describe('Approvals adaptive regression harness', () => {
    beforeEach(() => {
        mockUseApiData.mockReset();
    });

    it('keeps the approvals queue list-first on phones', () => {
        mockUseLayout.mockReturnValue({ dualPane: false });
        mockUseApiData.mockReturnValue(approvalData);

        render(<ApprovalListScreen />);

        expect(screen.queryByTestId('master-detail-shell')).toBeNull();
        expect(screen.getByText('tool_call')).toBeTruthy();
    });

    it('opens a list/detail review shell on tablets', () => {
        mockUseLayout.mockReturnValue({ dualPane: true });
        mockUseApiData.mockReturnValue(approvalData);

        render(<ApprovalListScreen />);

        expect(screen.getByTestId('master-detail-shell')).toBeTruthy();
        expect(screen.getByText('APPROVAL DETAIL')).toBeTruthy();
    });
});
