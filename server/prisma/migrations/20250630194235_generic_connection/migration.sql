-- CreateTable
CREATE TABLE "GenericConnection" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GenericConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenericTable" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "fetch" JSONB NOT NULL,
    "mapping" JSONB NOT NULL,
    "genericConnectionId" TEXT NOT NULL,

    CONSTRAINT "GenericTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenericConnection_userId_idx" ON "GenericConnection"("userId");

-- CreateIndex
CREATE INDEX "GenericTable_genericConnectionId_idx" ON "GenericTable"("genericConnectionId");

-- AddForeignKey
ALTER TABLE "GenericConnection" ADD CONSTRAINT "GenericConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenericTable" ADD CONSTRAINT "GenericTable_genericConnectionId_fkey" FOREIGN KEY ("genericConnectionId") REFERENCES "GenericConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
