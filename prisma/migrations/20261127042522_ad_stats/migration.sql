-- CreateTable
CREATE TABLE "AdStat" (
    "id" SERIAL NOT NULL,
    "adId" TEXT NOT NULL,
    "productId" INTEGER,
    "title" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    "observed" INTEGER NOT NULL,
    "phones" INTEGER NOT NULL,
    "messages" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "adTitle" TEXT NOT NULL,
    "lastLabel" TEXT NOT NULL,
    "unread" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdStat_adId_takenAt_idx" ON "AdStat"("adId", "takenAt");

-- CreateIndex
CREATE INDEX "AdStat_takenAt_idx" ON "AdStat"("takenAt");
