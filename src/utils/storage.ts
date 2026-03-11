/**
 * GoatCitadel Mobile — Platform-safe secure storage
 * Uses expo-secure-store on native, falls back to localStorage on web.
 */
import { Platform } from 'react-native';

let SecureStore: any = null;

if (Platform.OS !== 'web') {
    try {
        SecureStore = require('expo-secure-store');
    } catch { }
}

export async function getSecureItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
        try { return localStorage.getItem(key); } catch { return null; }
    }
    if (SecureStore) {
        try { return await SecureStore.getItemAsync(key); } catch { return null; }
    }
    return null;
}

export async function setSecureItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
        try { localStorage.setItem(key, value); } catch { }
        return;
    }
    if (SecureStore) {
        try { await SecureStore.setItemAsync(key, value); } catch { }
    }
}

export async function deleteSecureItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
        try { localStorage.removeItem(key); } catch { }
        return;
    }
    if (SecureStore) {
        try { await SecureStore.deleteItemAsync(key); } catch { }
    }
}
