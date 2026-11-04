-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "user_id" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "user_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meal_type" TEXT NOT NULL,
    "cuisine" TEXT NOT NULL DEFAULT '',
    "servings" TEXT NOT NULL DEFAULT '',
    "ingredients" JSONB NOT NULL DEFAULT '[]',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "tip" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("user_id","id")
);

-- CreateTable
CREATE TABLE "plan_slots" (
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,

    CONSTRAINT "plan_slots_pkey" PRIMARY KEY ("user_id","date","meal")
);

-- CreateTable
CREATE TABLE "shopping_checks" (
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_checks_pkey" PRIMARY KEY ("user_id","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "plan_slots_user_date" ON "plan_slots"("user_id", "date");

-- AddForeignKey
ALTER TABLE "plan_slots" ADD CONSTRAINT "plan_slots_user_id_recipe_id_fkey" FOREIGN KEY ("user_id", "recipe_id") REFERENCES "recipes"("user_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- All access goes through the Next.js server with the service role key,
-- so RLS is enabled with no policies: the public anon key can read nothing.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shopping_checks" ENABLE ROW LEVEL SECURITY;
