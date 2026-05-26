/*
  Warnings:

  - You are about to drop the column `category` on the `com_products` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `com_products` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[masterGroupId,code,companyId]` on the table `cfg_master_data` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "WorkflowStatus" ADD VALUE 'PENDING';

-- DropIndex
DROP INDEX "cfg_master_data_masterGroupId_code_key";

-- AlterTable
ALTER TABLE "cfg_master_data" ADD COLUMN     "companyId" INTEGER;

-- AlterTable
ALTER TABLE "com_product_images" ADD COLUMN     "checksum" VARCHAR(255),
ADD COLUMN     "fileSize" BIGINT,
ALTER COLUMN "aiStatus" DROP NOT NULL,
ALTER COLUMN "aiStatus" DROP DEFAULT;

-- AlterTable
ALTER TABLE "com_products" DROP COLUMN "category",
DROP COLUMN "unit",
ADD COLUMN     "boxSizeId" INTEGER,
ADD COLUMN     "categoryId" INTEGER,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "unitId" INTEGER;

-- AlterTable
ALTER TABLE "com_shipping_rules" ADD COLUMN     "boxSize" VARCHAR(50) DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "hr_holidays" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "int_ai_batch_jobs" ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "int_knowledge_bases" ADD COLUMN     "fileHash" TEXT;

-- CreateTable
CREATE TABLE "int_knowledge_base_chunks" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "int_knowledge_base_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "int_message_queue" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "shopId" INTEGER,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "refType" TEXT,
    "refId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "int_message_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "int_message_queue_status_scheduledTime_idx" ON "int_message_queue"("status", "scheduledTime");

-- CreateIndex
CREATE INDEX "int_message_queue_companyId_idx" ON "int_message_queue"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "cfg_master_data_masterGroupId_code_companyId_key" ON "cfg_master_data"("masterGroupId", "code", "companyId");

-- AddForeignKey
ALTER TABLE "int_knowledge_base_chunks" ADD CONSTRAINT "int_knowledge_base_chunks_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "int_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfg_master_data" ADD CONSTRAINT "cfg_master_data_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_products" ADD CONSTRAINT "com_products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "cfg_master_data"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_products" ADD CONSTRAINT "com_products_boxSizeId_fkey" FOREIGN KEY ("boxSizeId") REFERENCES "cfg_master_data"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "com_products" ADD CONSTRAINT "com_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "cfg_master_data"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "int_message_queue" ADD CONSTRAINT "int_message_queue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_calendars" ADD CONSTRAINT "hr_calendars_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_work_patterns" ADD CONSTRAINT "hr_work_patterns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "org_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
