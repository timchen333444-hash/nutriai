-- AlterTable
ALTER TABLE "User" ADD COLUMN "alertSettings" TEXT;

-- CreateTable
CREATE TABLE "DeficiencyAlert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "nutrientName" TEXT NOT NULL,
    "nutrientKey" TEXT NOT NULL,
    "currentPercent" REAL NOT NULL,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "severity" TEXT NOT NULL,
    "suggestions" TEXT NOT NULL DEFAULT '[]',
    "date" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeficiencyAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DeficiencyAlert_userId_nutrientKey_date_key" ON "DeficiencyAlert"("userId", "nutrientKey", "date");
