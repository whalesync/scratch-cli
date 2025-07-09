-- CreateTable
CREATE TABLE "StyleGuide" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "StyleGuide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StyleGuide_userId_idx" ON "StyleGuide"("userId");

-- AddForeignKey
ALTER TABLE "StyleGuide" ADD CONSTRAINT "StyleGuide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
