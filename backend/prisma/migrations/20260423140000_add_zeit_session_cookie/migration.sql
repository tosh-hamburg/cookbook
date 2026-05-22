-- AlterTable: Zeit.de Session-Cookie (AES-256-GCM verschlüsselt) für Rezept-Import hinter Paywall
ALTER TABLE "User" ADD COLUMN "zeitSessionCookie" TEXT;
ALTER TABLE "User" ADD COLUMN "zeitSessionCookieSetAt" TIMESTAMP(3);
