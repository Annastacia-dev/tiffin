-- CreateTable
CREATE TABLE "ingredient_prices" (
    "user_id" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredient_prices_pkey" PRIMARY KEY ("user_id","item","unit","currency")
);

-- Only the server reads this, like every other table
ALTER TABLE "ingredient_prices" ENABLE ROW LEVEL SECURITY;
