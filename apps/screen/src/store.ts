/** Cache local (IndexedDB via idb-keyval) : bundle + jeton appareil. L'écran doit démarrer sans réseau. */
import { createStore, get, set, del, clear } from "idb-keyval";
import type { ScreenBundle } from "@nidaa/shared";

const store = createStore("nidaa-screen", "kv");

const KEYS = { bundle: "bundle", deviceToken: "deviceToken", pairing: "pairing", themeOverride: "themeOverride" } as const;

export interface PairingSession { code: string; expiresAt: string; pollToken: string }

export const loadBundle = () => get<ScreenBundle>(KEYS.bundle, store).catch(() => undefined);
export const saveBundle = (b: ScreenBundle) => set(KEYS.bundle, b, store).catch(() => undefined);
export const loadDeviceToken = () => get<string>(KEYS.deviceToken, store).catch(() => undefined);
export const saveDeviceToken = (t: string) => set(KEYS.deviceToken, t, store).catch(() => undefined);
export const loadPairing = () => get<PairingSession>(KEYS.pairing, store).catch(() => undefined);
export const savePairing = (p: PairingSession | null) => (p ? set(KEYS.pairing, p, store) : del(KEYS.pairing, store)).catch(() => undefined);

/** Dissociation : on efface tout (jeton, bundle, appairage en cours). */
export const clearAll = () => clear(store).catch(() => undefined);
