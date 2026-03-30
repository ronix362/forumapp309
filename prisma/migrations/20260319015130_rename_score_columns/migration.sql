/*
  Warnings:

  - You are about to drop the column `scoreTeam1` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `scoreTeam2` on the `Match` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Match" DROP COLUMN "scoreTeam1",
DROP COLUMN "scoreTeam2",
ADD COLUMN     "awayScore" INTEGER,
ADD COLUMN     "homeScore" INTEGER;
