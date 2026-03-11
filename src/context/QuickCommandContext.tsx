/**
 * GoatCitadel Mobile — Quick Command Context
 * Spotlight-style command palette for instant navigation and actions.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

export interface QuickCommand {
    id: string;
    label: string;
    icon: string;
    category: 'navigate' | 'action' | 'search';
    route?: string;
    action?: () => void;
    keywords: string[];
}

interface QuickCommandContextType {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
    commands: QuickCommand[];
}

const QuickCommandContext = createContext<QuickCommandContextType>({
    isOpen: false,
    open: () => { },
    close: () => { },
    toggle: () => { },
    commands: [],
});

const DEFAULT_COMMANDS: QuickCommand[] = [
    { id: 'nav-summit', label: 'Go to Summit', icon: 'shield-checkmark', category: 'navigate', route: '/(tabs)', keywords: ['dashboard', 'home', 'summit'] },
    { id: 'nav-chat', label: 'Open Chat', icon: 'chatbubbles', category: 'navigate', route: '/(tabs)/chat', keywords: ['chat', 'message', 'talk'] },
    { id: 'nav-approvals', label: 'View Approvals', icon: 'lock-closed', category: 'navigate', route: '/(tabs)/approvals', keywords: ['approvals', 'gatehouse', 'pending'] },
    { id: 'nav-herd', label: 'Herd HQ', icon: 'people', category: 'navigate', route: '/(tabs)/herd', keywords: ['agents', 'herd', 'team'] },
    { id: 'nav-pulse', label: 'Live Pulse', icon: 'pulse', category: 'navigate', route: '/(tabs)/pulse', keywords: ['events', 'live', 'pulse', 'stream'] },
    { id: 'nav-sessions', label: 'Session History', icon: 'list', category: 'navigate', route: '/(tabs)/sessions', keywords: ['sessions', 'history', 'costs'] },
    { id: 'nav-skills', label: 'Skills Library', icon: 'extension-puzzle', category: 'navigate', route: '/(tabs)/skills', keywords: ['skills', 'workflows'] },
    { id: 'nav-mcp', label: 'MCP Servers', icon: 'server', category: 'navigate', route: '/(tabs)/mcp', keywords: ['mcp', 'servers', 'tools'] },
    { id: 'nav-settings', label: 'Settings', icon: 'settings', category: 'navigate', route: '/(tabs)/settings', keywords: ['settings', 'config'] },
    { id: 'nav-cowork', label: 'Cowork Mode', icon: 'git-branch', category: 'navigate', route: '/(tabs)/cowork', keywords: ['cowork', 'delegation'] },
    { id: 'nav-code', label: 'Code Monitor', icon: 'code-slash', category: 'navigate', route: '/(tabs)/code', keywords: ['code', 'software'] },
    { id: 'nav-notifications', label: 'Notifications', icon: 'notifications', category: 'navigate', route: '/(tabs)/notifications', keywords: ['notifications', 'alerts'] },
    { id: 'nav-logs', label: 'System Logs', icon: 'terminal', category: 'navigate', route: '/(tabs)/logs', keywords: ['logs', 'terminal', 'debug'] },
    { id: 'action-new-chat', label: 'New Chat Session', icon: 'add-circle', category: 'action', keywords: ['new', 'create', 'session'] },
    { id: 'action-refresh', label: 'Refresh All Data', icon: 'refresh', category: 'action', keywords: ['refresh', 'reload', 'update'] },
];

export function QuickCommandProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);

    return (
        <QuickCommandContext.Provider value={{ isOpen, open, close, toggle, commands: DEFAULT_COMMANDS }}>
            {children}
        </QuickCommandContext.Provider>
    );
}

export const useQuickCommand = () => useContext(QuickCommandContext);
