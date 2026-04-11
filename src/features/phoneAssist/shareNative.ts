import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { NativeSharedDraftPayload } from './shareInbox';

type ShareIntentModule = {
    getPendingShare: () => Promise<NativeSharedDraftPayload | null>;
    addListener?: (eventName: string) => void;
    removeListeners?: (count: number) => void;
};

const nativeModule: ShareIntentModule | undefined = (() => {
    if (Platform.OS !== 'android') {
        return undefined;
    }
    const mod = (NativeModules as Record<string, unknown>).ShareIntent;
    if (!mod || typeof mod !== 'object') {
        return undefined;
    }
    return mod as ShareIntentModule;
})();

const nativeEmitter = nativeModule ? new NativeEventEmitter(nativeModule as never) : null;

export async function getPendingNativeShareDraft(): Promise<NativeSharedDraftPayload | null> {
    if (!nativeModule?.getPendingShare) {
        return null;
    }
    return nativeModule.getPendingShare();
}

export function subscribeToNativeShareDrafts(
    callback: (payload: NativeSharedDraftPayload) => void,
): (() => void) {
    if (!nativeEmitter) {
        return () => {};
    }
    const subscription = nativeEmitter.addListener('GoatCitadelShareIntent', callback);
    return () => subscription.remove();
}
