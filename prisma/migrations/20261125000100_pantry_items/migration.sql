-- CreateTable
CREATE TABLE "pantry_items" (
    "user_id" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pantry_items_pkey" PRIMARY KEY ("user_id","item")
);

-- Only the server reads this, like every other table
ALTER TABLE "pantry_items" ENABLE ROW LEVEL SECURITY;
