/*
  Warnings:

  - You are about to drop the `balances` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."balances" DROP CONSTRAINT "balances_userId_fkey";

-- DropTable
DROP TABLE "public"."balances";
