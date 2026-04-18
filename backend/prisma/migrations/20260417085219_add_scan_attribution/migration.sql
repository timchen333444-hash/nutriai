-- AlterTable
ALTER TABLE "Food" ADD COLUMN "firstScannedBy" TEXT;
ALTER TABLE "Food" ADD COLUMN "scanCount" INTEGER DEFAULT 1;
