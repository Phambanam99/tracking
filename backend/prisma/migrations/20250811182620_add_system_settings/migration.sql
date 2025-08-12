-- CreateTable
CREATE TABLE "public"."system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "clusterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minZoom" INTEGER NOT NULL DEFAULT 4,
    "maxZoom" INTEGER NOT NULL DEFAULT 16,
    "signalStaleMinutes" INTEGER NOT NULL DEFAULT 10,
    "vesselFlagColors" JSONB NOT NULL DEFAULT '{}',
    "aircraftOperatorColors" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
