import type { AnnouncementInput, IqamaRule, JumuaSlot, MemberRole, MosqueInput, MosqueStatus, PrayerConfig, ScreenSettings, SpecialPrayer } from "@nidaa/shared";

export interface Mosque extends MosqueInput {
  id: string;
  slug: string;
  status: MosqueStatus;
  version: number;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Member {
  id: string;
  userId?: string;
  role: MemberRole;
  email?: string;
  fullName?: string;
  user?: { id?: string; email?: string; fullName?: string };
  createdAt?: string;
}

export interface MosqueDetail extends Mosque {
  members?: Member[];
  prayerConfig?: PrayerConfig;
  iqamaRules?: IqamaRule[];
  jumuaSlots?: JumuaSlot[];
  specialPrayers?: SpecialPrayerItem[];
  screenSettings?: ScreenSettings;
  flashMessage?: FlashMessage | string | null;
}

export type MediaKind = "photo" | "announcement_image";
export interface Media { id: string; mosqueId: string; kind: MediaKind; url: string; mime: string | null; size: number | null; width: number | null; height: number | null; position: number; createdAt?: string }

/** Règles d'envoi, identiques à celles de l'API (apps/api/src/storage/image-validation.ts). */
export const IMAGE_RULES = { maxBytes: 5 * 1024 * 1024, maxPhotos: 12, mimes: ["image/jpeg", "image/png", "image/webp"], accept: "image/jpeg,image/png,image/webp" } as const;
/** Message d'erreur si le fichier ne peut pas être envoyé, sinon null (l'API revérifie le contenu réel). */
export function imageProblem(file: File): string | null {
  if (!(IMAGE_RULES.mimes as readonly string[]).includes(file.type)) return `« ${file.name} » : format non accepté. Utilisez une image JPEG, PNG ou WebP.`;
  if (file.size > IMAGE_RULES.maxBytes) return `« ${file.name} » : image trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo). La taille maximale est de 5 Mo.`;
  return null;
}

export interface FlashMessage { text: string; isActive: boolean }

export type SpecialPrayerItem = SpecialPrayer & { id: string };
export type Announcement = AnnouncementInput & { id: string; createdAt?: string; updatedAt?: string };

export interface ScreenDevice {
  id: string;
  name: string | null;
  lastSeenAt: string | null;
  appVersion: string | null;
  clockDriftMs: number | null;
  bundleVersion: number | null;
  createdAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  userId?: string | null;
  user?: { email?: string; fullName?: string } | null;
  userEmail?: string | null;
  diff?: unknown;
  payload?: unknown;
  createdAt: string;
}

export interface ContentItem {
  id: string;
  kind: "hadith" | "ayah" | "dua" | "dhikr";
  textAr: string;
  textFr: string | null;
  textEn: string | null;
  reference: string | null;
  context: "after_adhan" | "after_prayer" | "rotation";
  isActive: boolean;
}

export interface SuperStats { mosques: number; published: number; screensOnline: number; users: number }
export interface ImportReport { imported: number; errors: Array<{ line: number; message: string }> }
