-- Accounts created with Google have no password.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
