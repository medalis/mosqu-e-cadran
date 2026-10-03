-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MosqueMember" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invitedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MosqueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "diff" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mosque" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'DJ',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Djibouti',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "donationUrl" TEXT,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rejectionReason" TEXT,
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mosque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerConfig" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'calculated',
    "method" TEXT NOT NULL DEFAULT 'MWL',
    "fajrAngle" DOUBLE PRECISION,
    "ishaAngle" DOUBLE PRECISION,
    "ishaIntervalMin" INTEGER,
    "asrMadhhab" TEXT NOT NULL DEFAULT 'shafi',
    "highLatitudeRule" TEXT NOT NULL DEFAULT 'MiddleOfTheNight',
    "adjustments" JSONB NOT NULL DEFAULT '{}',
    "hijriOffsetDays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrayerConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IqamaRule" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "prayer" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "delayMin" INTEGER,
    "fixedTime" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),

    CONSTRAINT "IqamaRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JumuaSlot" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "khutbaTime" TEXT NOT NULL,
    "prayerTime" TEXT NOT NULL,
    "language" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JumuaSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialPrayer" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "locationNote" TEXT,

    CONSTRAINT "SpecialPrayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarImport" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "fileName" TEXT,
    "rowsCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errors" JSONB,
    "importedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerDay" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "fajr" TEXT NOT NULL,
    "shuruq" TEXT NOT NULL,
    "dhuhr" TEXT NOT NULL,
    "asr" TEXT NOT NULL,
    "maghrib" TEXT NOT NULL,
    "isha" TEXT NOT NULL,
    "iqamaFajr" TEXT NOT NULL,
    "iqamaDhuhr" TEXT NOT NULL,
    "iqamaAsr" TEXT NOT NULL,
    "iqamaMaghrib" TEXT NOT NULL,
    "iqamaIsha" TEXT NOT NULL,
    "hijriDay" INTEGER NOT NULL,
    "hijriMonth" INTEGER NOT NULL,
    "hijriYear" INTEGER NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "PrayerDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "mediaUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 10,
    "position" INTEGER NOT NULL DEFAULT 0,
    "targets" TEXT[] DEFAULT ARRAY['screen', 'web']::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashMessage" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenSettings" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenDevice" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT,
    "name" TEXT,
    "pairingCode" TEXT,
    "pairingExpiresAt" TIMESTAMP(3),
    "deviceTokenHash" TEXT,
    "pairedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "appVersion" TEXT,
    "clockDriftMs" INTEGER,
    "bundleVersion" INTEGER,
    "orientationOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "textAr" TEXT NOT NULL,
    "textFr" TEXT,
    "textEn" TEXT,
    "reference" TEXT,
    "context" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MosqueMember_mosqueId_userId_key" ON "MosqueMember"("mosqueId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuditLog_mosqueId_createdAt_idx" ON "AuditLog"("mosqueId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mosque_slug_key" ON "Mosque"("slug");

-- CreateIndex
CREATE INDEX "Mosque_city_idx" ON "Mosque"("city");

-- CreateIndex
CREATE INDEX "Mosque_status_idx" ON "Mosque"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PrayerConfig_mosqueId_key" ON "PrayerConfig"("mosqueId");

-- CreateIndex
CREATE INDEX "IqamaRule_mosqueId_idx" ON "IqamaRule"("mosqueId");

-- CreateIndex
CREATE UNIQUE INDEX "PrayerDay_mosqueId_date_key" ON "PrayerDay"("mosqueId", "date");

-- CreateIndex
CREATE INDEX "Announcement_mosqueId_isActive_idx" ON "Announcement"("mosqueId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FlashMessage_mosqueId_key" ON "FlashMessage"("mosqueId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenSettings_mosqueId_key" ON "ScreenSettings"("mosqueId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenDevice_pairingCode_key" ON "ScreenDevice"("pairingCode");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenDevice_deviceTokenHash_key" ON "ScreenDevice"("deviceTokenHash");

-- AddForeignKey
ALTER TABLE "MosqueMember" ADD CONSTRAINT "MosqueMember_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MosqueMember" ADD CONSTRAINT "MosqueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerConfig" ADD CONSTRAINT "PrayerConfig_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IqamaRule" ADD CONSTRAINT "IqamaRule_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JumuaSlot" ADD CONSTRAINT "JumuaSlot_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialPrayer" ADD CONSTRAINT "SpecialPrayer_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarImport" ADD CONSTRAINT "CalendarImport_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrayerDay" ADD CONSTRAINT "PrayerDay_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashMessage" ADD CONSTRAINT "FlashMessage_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenSettings" ADD CONSTRAINT "ScreenSettings_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenDevice" ADD CONSTRAINT "ScreenDevice_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;
