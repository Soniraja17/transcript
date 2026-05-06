-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'others');

-- CreateEnum
CREATE TYPE "Videostatus" AS ENUM ('PENDING', 'READY', 'PROCESSING', 'FAILED');

-- CreateEnum
CREATE TYPE "Type" AS ENUM ('public', 'unlisted', 'private');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "gender" "Gender",
    "password" TEXT NOT NULL,
    "channelname" TEXT NOT NULL,
    "coverphoto" TEXT,
    "profilepicture" TEXT,
    "subscount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "userid" TEXT NOT NULL,
    "video_url" TEXT NOT NULL,
    "status" "Videostatus" NOT NULL DEFAULT 'PENDING',
    "hls_url" TEXT,
    "thumbnail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "type" "Type",
    "likes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL,
    "videoid" TEXT NOT NULL,
    "object_url" TEXT NOT NULL,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_channelname_key" ON "user"("channelname");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_userid_fkey" FOREIGN KEY ("userid") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_videoid_fkey" FOREIGN KEY ("videoid") REFERENCES "uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
