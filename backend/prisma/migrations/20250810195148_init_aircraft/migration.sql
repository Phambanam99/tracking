-- CreateTable
CREATE TABLE "public"."user_filters" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "activeFilterTab" TEXT NOT NULL,
    "aircraftViewMode" TEXT NOT NULL,
    "vesselViewMode" TEXT NOT NULL,
    "aircraft" JSONB NOT NULL,
    "vessel" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_filters_userId_idx" ON "public"."user_filters"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_filters_userId_name_key" ON "public"."user_filters"("userId", "name");

-- AddForeignKey
ALTER TABLE "public"."user_filters" ADD CONSTRAINT "user_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
