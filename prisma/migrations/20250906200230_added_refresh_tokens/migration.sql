/*
  Warnings:

  - You are about to drop the column `token` on the `Session` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[accessToken]` on the table `Session` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[refreshToken]` on the table `Session` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accessToken` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refreshExpiresAt` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refreshToken` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Session_token_key";

-- AlterTable
ALTER TABLE "public"."Session" DROP COLUMN "token",
ADD COLUMN     "accessToken" TEXT NOT NULL,
ADD COLUMN     "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "refreshToken" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Session_accessToken_key" ON "public"."Session"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "public"."Session"("refreshToken");
