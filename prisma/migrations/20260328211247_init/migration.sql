/*
  Warnings:

  - The `avatarId` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarId",
ADD COLUMN     "avatarId" INTEGER NOT NULL DEFAULT 0;
