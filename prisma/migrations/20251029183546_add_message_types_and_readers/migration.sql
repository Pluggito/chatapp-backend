-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'AUDIO', 'IMAGE', 'SYSTEM');

-- AlterTable
ALTER TABLE "public"."ChatMember" ADD COLUMN     "lastReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "readers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
ALTER COLUMN "content" DROP NOT NULL;
