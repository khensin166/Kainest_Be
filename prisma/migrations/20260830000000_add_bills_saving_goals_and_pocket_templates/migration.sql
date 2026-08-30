-- Migration: Rencana Keuangan — tagihan, cicilan, wishlist tabungan, template kantong
-- Tanggal: 2026-08-30
-- Rancangan: doc/rencana_tabungan_tagihan.md (Fase 1)
--
-- Sifat: MURNI ADITIF. Tidak ada DROP, tidak ada perubahan tipe, tidak ada
-- kolom yang dijadikan NOT NULL. Satu-satunya sentuhan pada tabel lama adalah
-- penambahan kolom nullable MonthlyFinancialHistory.commitmentsSnapshot,
-- sehingga baris riwayat yang sudah ada tetap valid tanpa backfill.
--
-- CATATAN: tabel-tabel ini belum dibaca bot lewat PostgREST. Bila nanti bot
-- perlu membacanya, buatkan VIEW di skema public seperti BotActiveGroup —
-- lihat catatan 13 Juni 2026 di AGENTS.md.

-- CreateEnum
CREATE TYPE "kainest"."BillFrequency" AS ENUM ('MONTHLY', 'WEEKLY', 'YEARLY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "kainest"."BillStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "kainest"."BillPaymentStatus" AS ENUM ('PAID', 'SKIPPED');

-- CreateEnum
CREATE TYPE "kainest"."SavingGoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "kainest"."ContributionSource" AS ENUM ('AUTO_CYCLE', 'MANUAL', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "kainest"."CommitmentZone" AS ENUM ('SAFE', 'WARNING', 'DANGER');

-- AlterTable
ALTER TABLE "kainest"."MonthlyFinancialHistory" ADD COLUMN     "commitmentsSnapshot" JSONB;

-- CreateTable
CREATE TABLE "kainest"."RecurringBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "frequency" "kainest"."BillFrequency" NOT NULL DEFAULT 'MONTHLY',
    "dueDay" INTEGER NOT NULL,
    "dueMonth" INTEGER,
    "startDate" DATE NOT NULL,
    "totalInstallments" INTEGER,
    "paidInstallments" INTEGER NOT NULL DEFAULT 0,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "status" "kainest"."BillStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kainest"."BillPayment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" DATE NOT NULL,
    "status" "kainest"."BillPaymentStatus" NOT NULL DEFAULT 'PAID',
    "installmentNo" INTEGER,
    "paidAmount" INTEGER,
    "transactionId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kainest"."SavingGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" INTEGER NOT NULL,
    "monthlyAllocation" INTEGER NOT NULL DEFAULT 0,
    "targetDate" DATE,
    "icon" TEXT,
    "status" "kainest"."SavingGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kainest"."SavingContribution" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" "kainest"."ContributionSource" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "period" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kainest"."CommitmentAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" DATE NOT NULL,
    "zone" "kainest"."CommitmentZone" NOT NULL,
    "shortfall" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitmentAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kainest"."PocketTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pockets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PocketTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringBill_userId_status_idx" ON "kainest"."RecurringBill"("userId", "status");

-- CreateIndex
CREATE INDEX "RecurringBill_userId_dueDay_idx" ON "kainest"."RecurringBill"("userId", "dueDay");

-- CreateIndex
CREATE INDEX "RecurringBill_categoryId_idx" ON "kainest"."RecurringBill"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BillPayment_transactionId_key" ON "kainest"."BillPayment"("transactionId");

-- CreateIndex
CREATE INDEX "BillPayment_userId_period_idx" ON "kainest"."BillPayment"("userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "BillPayment_billId_period_key" ON "kainest"."BillPayment"("billId", "period");

-- CreateIndex
CREATE INDEX "SavingGoal_userId_status_idx" ON "kainest"."SavingGoal"("userId", "status");

-- CreateIndex
CREATE INDEX "SavingContribution_userId_period_idx" ON "kainest"."SavingContribution"("userId", "period");

-- CreateIndex
CREATE INDEX "SavingContribution_goalId_date_idx" ON "kainest"."SavingContribution"("goalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SavingContribution_goalId_period_source_key" ON "kainest"."SavingContribution"("goalId", "period", "source");

-- CreateIndex
CREATE INDEX "CommitmentAlert_userId_period_idx" ON "kainest"."CommitmentAlert"("userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "CommitmentAlert_userId_period_zone_key" ON "kainest"."CommitmentAlert"("userId", "period", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "PocketTemplate_userId_name_key" ON "kainest"."PocketTemplate"("userId", "name");

-- AddForeignKey
ALTER TABLE "kainest"."RecurringBill" ADD CONSTRAINT "RecurringBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kainest"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kainest"."RecurringBill" ADD CONSTRAINT "RecurringBill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "kainest"."BudgetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kainest"."BillPayment" ADD CONSTRAINT "BillPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "kainest"."RecurringBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kainest"."BillPayment" ADD CONSTRAINT "BillPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kainest"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kainest"."BillPayment" ADD CONSTRAINT "BillPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "kainest"."Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kainest"."SavingGoal" ADD CONSTRAINT "SavingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kainest"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kainest"."SavingContribution" ADD CONSTRAINT "SavingContribution_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "kainest"."SavingGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kainest"."SavingContribution" ADD CONSTRAINT "SavingContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kainest"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kainest"."CommitmentAlert" ADD CONSTRAINT "CommitmentAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kainest"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kainest"."PocketTemplate" ADD CONSTRAINT "PocketTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "kainest"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

