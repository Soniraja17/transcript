/*
  Warnings:

  - A unique constraint covering the columns `[videoid]` on the table `transcripts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "transcripts_videoid_key" ON "transcripts"("videoid");
