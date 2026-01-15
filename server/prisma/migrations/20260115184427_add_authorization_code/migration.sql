-- CreateTable
CREATE TABLE "AuthorizationCode" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userCode" TEXT NOT NULL,
    "pollingCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "apiToken" TEXT,

    CONSTRAINT "AuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationCode_userCode_key" ON "AuthorizationCode"("userCode");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationCode_pollingCode_key" ON "AuthorizationCode"("pollingCode");

-- CreateIndex
CREATE INDEX "AuthorizationCode_userCode_idx" ON "AuthorizationCode"("userCode");

-- CreateIndex
CREATE INDEX "AuthorizationCode_pollingCode_idx" ON "AuthorizationCode"("pollingCode");

-- CreateIndex
CREATE INDEX "AuthorizationCode_expiresAt_idx" ON "AuthorizationCode"("expiresAt");
