/*
  Warnings:

  - A unique constraint covering the columns `[barcode]` on the table `Food` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Food" ADD COLUMN "firstScannedAt" DATETIME;
ALTER TABLE "Food" ADD COLUMN "source" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Food_barcode_key" ON "Food"("barcode");
