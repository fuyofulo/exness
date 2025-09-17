-- AlterTable
ALTER TABLE "public"."trades" ADD COLUMN     "stopLossPrice" BIGINT,
ADD COLUMN     "takeProfitPrice" BIGINT,
ADD COLUMN     "triggerDecimals" INTEGER;
