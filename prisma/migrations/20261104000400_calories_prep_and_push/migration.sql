-- AlterTable
ALTER TABLE "recipes" ADD COLUMN "calories" INTEGER,
ADD COLUMN "prep" JSONB;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "endpoint" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("endpoint")
);

-- CreateTable
CREATE TABLE "sent_reminders" (
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_reminders_pkey" PRIMARY KEY ("user_id","key")
);

-- CreateIndex
CREATE INDEX "push_subscriptions_user" ON "push_subscriptions"("user_id");

-- Only the server reads these, like every other table
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sent_reminders" ENABLE ROW LEVEL SECURITY;
