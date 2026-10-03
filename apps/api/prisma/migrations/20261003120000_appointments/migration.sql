-- Turnos & Agenda: fundación del módulo `appointments`.
--
-- Qué hace:
--   1. businesses.vertical (STORE | APPOINTMENTS, default STORE) y dos columnas
--      en roles (appointments_role_key, takes_appointments). Todo aditivo: las
--      tiendas que ya existen quedan igual.
--   2. Las 23 tablas appointment_* (configuración, servicios, agendas, días
--      especiales, turnos, pagos, clases con cupo, perfil del cliente, pagos al
--      equipo, registro de mensajes y las funciones de Avanzado).
--   3. RLS habilitado en cada tabla nueva, sin policies: la API entra con el
--      rol dueño de la base, que ignora RLS; anon/authenticated de Supabase
--      quedan afuera (lo exige test/unit/rls-supabase.unit-spec.ts).
--   4. Una constraint de exclusión, escrita a mano (Prisma no la modela), para
--      que dos turnos no cancelados del mismo recurso no puedan pisarse. Está
--      al final del archivo, con su explicación.
--
-- Los bloques "CreateEnum / CreateTable / CreateIndex / AddForeignKey" son la
-- salida de `prisma migrate diff` entre el schema de main y el nuevo.

-- CreateEnum
CREATE TYPE "BusinessVertical" AS ENUM ('STORE', 'APPOINTMENTS');

-- CreateEnum
CREATE TYPE "AppointmentAgendaMode" AS ENUM ('PROFESSIONAL', 'RESOURCE', 'COURT', 'CLASS');

-- CreateEnum
CREATE TYPE "AppointmentResourceKind" AS ENUM ('PERSON', 'SPACE');

-- CreateEnum
CREATE TYPE "AppointmentModality" AS ENUM ('ON_SITE', 'HOME');

-- CreateEnum
CREATE TYPE "AppointmentSpecialDayKind" AS ENUM ('CLOSED', 'SPECIAL');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentOrigin" AS ENUM ('PANEL', 'STOREFRONT');

-- CreateEnum
CREATE TYPE "AppointmentCancelledBy" AS ENUM ('CUSTOMER', 'BUSINESS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AppointmentPaymentKind" AS ENUM ('DEPOSIT', 'FULL', 'BALANCE', 'PACKAGE', 'GIFT_CARD', 'MEMBERSHIP');

-- CreateEnum
CREATE TYPE "AppointmentEnrollmentStatus" AS ENUM ('ENROLLED', 'WAITLIST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentPayForm" AS ENUM ('COMMISSION', 'SALARY', 'MIXED', 'RENT', 'PER_CLASS');

-- CreateEnum
CREATE TYPE "AppointmentPayEvery" AS ENUM ('WEEK', 'FORTNIGHT', 'MONTH');

-- CreateEnum
CREATE TYPE "AppointmentPayoutDirection" AS ENUM ('BUSINESS_TO_PERSON', 'PERSON_TO_BUSINESS');

-- CreateEnum
CREATE TYPE "AppointmentMembershipStatus" AS ENUM ('ACTIVE', 'PAUSED', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentGiftCardKind" AS ENUM ('AMOUNT', 'SERVICE');

-- CreateEnum
CREATE TYPE "AppointmentRecurrence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AppointmentWaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentMessageChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AppointmentMessageStatus" AS ENUM ('SENT', 'FAILED', 'SIMULATED');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "vertical" "BusinessVertical" NOT NULL DEFAULT 'STORE';

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "appointments_role_key" TEXT,
ADD COLUMN     "takes_appointments" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "appointment_settings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "rubro_key" TEXT NOT NULL,
    "agenda_mode" "AppointmentAgendaMode" NOT NULL,
    "site_form" TEXT NOT NULL DEFAULT 'web',
    "simple_design" TEXT NOT NULL DEFAULT 'tarjeta',
    "appearance" JSONB,
    "week_schedule" JSONB NOT NULL,
    "vacation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "vacation_from" VARCHAR(10),
    "vacation_to" VARCHAR(10),
    "vacation_message" VARCHAR(400),
    "modalities" "AppointmentModality"[] DEFAULT ARRAY['ON_SITE']::"AppointmentModality"[],
    "city" VARCHAR(120),
    "neighborhood" VARCHAR(120),
    "floor" VARCHAR(60),
    "directions" VARCHAR(400),
    "home_zones" VARCHAR(400),
    "phone" VARCHAR(40),
    "min_advance_min" INTEGER NOT NULL DEFAULT 120,
    "max_advance_days" INTEGER NOT NULL DEFAULT 30,
    "slot_min" INTEGER NOT NULL DEFAULT 30,
    "buffer_min" INTEGER NOT NULL DEFAULT 0,
    "confirmation" TEXT NOT NULL DEFAULT 'auto',
    "let_choose_resource" BOOLEAN NOT NULL DEFAULT true,
    "offer_any_resource" BOOLEAN NOT NULL DEFAULT true,
    "max_active_per_customer" INTEGER NOT NULL DEFAULT 2,
    "waitlist_enabled" BOOLEAN NOT NULL DEFAULT false,
    "waitlist_accept_min" INTEGER NOT NULL DEFAULT 30,
    "class_default_capacity" INTEGER NOT NULL DEFAULT 15,
    "class_open_days" INTEGER NOT NULL DEFAULT 7,
    "class_min_enrolled" INTEGER NOT NULL DEFAULT 0,
    "ask_insurance" BOOLEAN NOT NULL DEFAULT false,
    "ask_dni" BOOLEAN NOT NULL DEFAULT false,
    "ask_reason" BOOLEAN NOT NULL DEFAULT false,
    "reschedule_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reschedule_until_hours" INTEGER NOT NULL DEFAULT 12,
    "reschedule_max" INTEGER NOT NULL DEFAULT 2,
    "deposit_enabled" BOOLEAN NOT NULL DEFAULT false,
    "deposit_type" TEXT NOT NULL DEFAULT 'percent',
    "deposit_percent" INTEGER NOT NULL DEFAULT 30,
    "deposit_fixed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit_for_no_shows" BOOLEAN NOT NULL DEFAULT true,
    "cancel_until_hours" INTEGER NOT NULL DEFAULT 24,
    "deposit_out_of_window" TEXT NOT NULL DEFAULT 'forfeit',
    "tolerance_min" INTEGER NOT NULL DEFAULT 10,
    "online_charge" TEXT NOT NULL DEFAULT 'deposit',
    "on_site_methods" "PaymentMethod"[] DEFAULT ARRAY['CASH', 'TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'QR']::"PaymentMethod"[],
    "show_transfer_data" BOOLEAN NOT NULL DEFAULT true,
    "account_enabled" BOOLEAN NOT NULL DEFAULT true,
    "welcome_discount_percent" INTEGER NOT NULL DEFAULT 0,
    "loyalty_stamps" INTEGER NOT NULL DEFAULT 0,
    "promos_enabled" BOOLEAN NOT NULL DEFAULT false,
    "messages" JSONB,
    "whatsapp_connected" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_number" VARCHAR(40),
    "whatsapp_provider_data" JSONB,
    "advanced" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_services" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "duration_min" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bookable_online" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_resources" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "kind" "AppointmentResourceKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role_label" VARCHAR(80),
    "color" VARCHAR(9),
    "photo_url" TEXT,
    "bio" VARCHAR(400),
    "member_id" TEXT,
    "email" VARCHAR(254),
    "phone" VARCHAR(40),
    "is_bookable" BOOLEAN NOT NULL DEFAULT true,
    "assigned_space_id" TEXT,
    "work_days" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "own_schedule" JSONB,
    "pay_form" "AppointmentPayForm",
    "commission_percent" DECIMAL(5,2),
    "salary" DECIMAL(12,2),
    "rent" DECIMAL(12,2),
    "per_class" DECIMAL(12,2),
    "pay_every" "AppointmentPayEvery",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "appointment_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_special_days" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "kind" "AppointmentSpecialDayKind" NOT NULL,
    "ranges" JSONB NOT NULL DEFAULT '[]',
    "reason" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_special_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "access_token" VARCHAR(64) NOT NULL,
    "resource_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_name" VARCHAR(120) NOT NULL,
    "customer_phone" VARCHAR(40) NOT NULL,
    "customer_email" VARCHAR(254),
    "customer_note" VARCHAR(500),
    "customer_address" VARCHAR(300),
    "customer_dni" VARCHAR(20),
    "insurance_name" VARCHAR(120),
    "insurance_number" VARCHAR(60),
    "reason" VARCHAR(500),
    "service_name" VARCHAR(120) NOT NULL,
    "internal_note" VARCHAR(500),
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "origin" "AppointmentOrigin" NOT NULL,
    "modality" "AppointmentModality" NOT NULL DEFAULT 'ON_SITE',
    "deposit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit_paid_at" TIMESTAMP(3),
    "deposit_method" "PaymentMethod",
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "confirmed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" "AppointmentCancelledBy",
    "cancel_reason" VARCHAR(300),
    "wants_reminder" BOOLEAN NOT NULL DEFAULT true,
    "reminder_sent_at" TIMESTAMP(3),
    "second_reminder_sent_at" TIMESTAMP(3),
    "recurring_series_id" TEXT,
    "package_purchase_id" TEXT,
    "gift_card_id" TEXT,
    "membership_id" TEXT,
    "created_by_member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_payments" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "kind" "AppointmentPaymentKind" NOT NULL DEFAULT 'DEPOSIT',
    "appointment_id" TEXT,
    "enrollment_id" TEXT,
    "package_purchase_id" TEXT,
    "gift_card_id" TEXT,
    "membership_id" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "reference" VARCHAR(120),
    "mp_preference_id" TEXT,
    "mp_payment_id" TEXT,
    "mp_status" TEXT,
    "mp_status_detail" TEXT,
    "mp_fee_amount" DECIMAL(12,2),
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "registered_by_member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_class_templates" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_min" INTEGER NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "instructor_resource_id" TEXT,
    "room_resource_id" TEXT,
    "capacity" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "appointment_class_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_class_sessions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancel_reason" VARCHAR(300),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_class_enrollments" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "access_token" VARCHAR(64) NOT NULL,
    "customer_id" TEXT,
    "customer_name" VARCHAR(120) NOT NULL,
    "customer_phone" VARCHAR(40) NOT NULL,
    "customer_email" VARCHAR(254),
    "customer_note" VARCHAR(500),
    "status" "AppointmentEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "waitlist_position" INTEGER,
    "offer_expires_at" TIMESTAMP(3),
    "origin" "AppointmentOrigin" NOT NULL,
    "attended" BOOLEAN,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit_paid_at" TIMESTAMP(3),
    "deposit_method" "PaymentMethod",
    "wants_reminder" BOOLEAN NOT NULL DEFAULT true,
    "reminder_sent_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" "AppointmentCancelledBy",
    "package_purchase_id" TEXT,
    "membership_id" TEXT,
    "created_by_member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_class_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_customer_profiles" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "note" VARCHAR(1000),
    "insurance_name" VARCHAR(120),
    "insurance_number" VARCHAR(60),
    "no_show_count" INTEGER NOT NULL DEFAULT 0,
    "deposit_credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "accepts_promos" BOOLEAN NOT NULL DEFAULT false,
    "welcome_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_staff_payouts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "period_from" VARCHAR(10) NOT NULL,
    "period_to" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "direction" "AppointmentPayoutDirection" NOT NULL,
    "breakdown" JSONB,
    "note" VARCHAR(300),
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registered_by_member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_staff_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_packages" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "valid_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "appointment_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_package_purchases" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_name" VARCHAR(120) NOT NULL,
    "customer_phone" VARCHAR(40) NOT NULL,
    "sessions_total" INTEGER NOT NULL,
    "sessions_used" INTEGER NOT NULL DEFAULT 0,
    "price_paid" DECIMAL(12,2) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_package_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_membership_plans" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "per_week" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(12,2) NOT NULL,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "appointment_membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_memberships" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_name" VARCHAR(120) NOT NULL,
    "customer_phone" VARCHAR(40) NOT NULL,
    "status" "AppointmentMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paused_from" TIMESTAMP(3),
    "paused_until" TIMESTAMP(3),
    "next_charge_at" TIMESTAMP(3),
    "last_paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_gift_cards" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "kind" "AppointmentGiftCardKind" NOT NULL,
    "amount" DECIMAL(12,2),
    "balance" DECIMAL(12,2),
    "service_id" TEXT,
    "redeemed_at" TIMESTAMP(3),
    "style" VARCHAR(20) NOT NULL DEFAULT 'noche',
    "recipient_name" VARCHAR(80),
    "sender_name" VARCHAR(80),
    "message" VARCHAR(300),
    "customer_id" TEXT,
    "buyer_name" VARCHAR(120),
    "buyer_phone" VARCHAR(40),
    "buyer_email" VARCHAR(254),
    "price_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_price_rules" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "from_min" INTEGER NOT NULL,
    "to_min" INTEGER NOT NULL,
    "adjust_percent" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_loyalty_cards" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "stamps" INTEGER NOT NULL DEFAULT 0,
    "rewards_earned" INTEGER NOT NULL DEFAULT 0,
    "rewards_redeemed" INTEGER NOT NULL DEFAULT 0,
    "last_stamp_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_loyalty_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_recurring_series" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_name" VARCHAR(120) NOT NULL,
    "customer_phone" VARCHAR(40) NOT NULL,
    "resource_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "frequency" "AppointmentRecurrence" NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_min" INTEGER NOT NULL,
    "start_date" VARCHAR(10) NOT NULL,
    "max_occurrences" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_recurring_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_winback_campaigns" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "inactive_days" INTEGER NOT NULL,
    "message" VARCHAR(600) NOT NULL,
    "coupon_enabled" BOOLEAN NOT NULL DEFAULT false,
    "coupon_percent" INTEGER NOT NULL DEFAULT 0,
    "coupon_valid_days" INTEGER NOT NULL DEFAULT 15,
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_winback_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_winback_sends" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "coupon_code" VARCHAR(20),
    "coupon_expires_at" TIMESTAMP(3),
    "coupon_used_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_winback_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_waitlist_entries" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_name" VARCHAR(120) NOT NULL,
    "customer_phone" VARCHAR(40) NOT NULL,
    "customer_email" VARCHAR(254),
    "service_id" TEXT NOT NULL,
    "resource_id" TEXT,
    "date" VARCHAR(10) NOT NULL,
    "from_min" INTEGER,
    "to_min" INTEGER,
    "status" "AppointmentWaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "offered_at" TIMESTAMP(3),
    "offer_expires_at" TIMESTAMP(3),
    "offered_starts_at" TIMESTAMP(3),
    "appointment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_message_logs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "enrollment_id" TEXT,
    "customer_id" TEXT,
    "channel" "AppointmentMessageChannel" NOT NULL,
    "template" VARCHAR(40) NOT NULL,
    "recipient" VARCHAR(254) NOT NULL,
    "status" "AppointmentMessageStatus" NOT NULL,
    "error" VARCHAR(500),
    "dedupe_key" VARCHAR(160),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_settings_business_id_key" ON "appointment_settings"("business_id");

-- CreateIndex
CREATE INDEX "appointment_services_business_id_deleted_at_idx" ON "appointment_services"("business_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_resources_member_id_key" ON "appointment_resources"("member_id");

-- CreateIndex
CREATE INDEX "appointment_resources_business_id_deleted_at_idx" ON "appointment_resources"("business_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_special_days_business_id_date_key" ON "appointment_special_days"("business_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_access_token_key" ON "appointments"("access_token");

-- CreateIndex
CREATE INDEX "appointments_business_id_resource_id_starts_at_idx" ON "appointments"("business_id", "resource_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_business_id_starts_at_idx" ON "appointments"("business_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_business_id_customer_id_idx" ON "appointments"("business_id", "customer_id");

-- CreateIndex
CREATE INDEX "appointments_business_id_customer_phone_idx" ON "appointments"("business_id", "customer_phone");

-- CreateIndex
CREATE INDEX "appointments_business_id_status_starts_at_idx" ON "appointments"("business_id", "status", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_business_id_code_key" ON "appointments"("business_id", "code");

-- CreateIndex
CREATE INDEX "appointment_payments_business_id_created_at_idx" ON "appointment_payments"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "appointment_payments_appointment_id_idx" ON "appointment_payments"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_payments_enrollment_id_idx" ON "appointment_payments"("enrollment_id");

-- CreateIndex
CREATE INDEX "appointment_payments_mp_payment_id_idx" ON "appointment_payments"("mp_payment_id");

-- CreateIndex
CREATE INDEX "appointment_payments_mp_preference_id_idx" ON "appointment_payments"("mp_preference_id");

-- CreateIndex
CREATE INDEX "appointment_class_templates_business_id_weekday_idx" ON "appointment_class_templates"("business_id", "weekday");

-- CreateIndex
CREATE INDEX "appointment_class_sessions_business_id_starts_at_idx" ON "appointment_class_sessions"("business_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_class_sessions_template_id_date_key" ON "appointment_class_sessions"("template_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_class_enrollments_access_token_key" ON "appointment_class_enrollments"("access_token");

-- CreateIndex
CREATE INDEX "appointment_class_enrollments_session_id_status_idx" ON "appointment_class_enrollments"("session_id", "status");

-- CreateIndex
CREATE INDEX "appointment_class_enrollments_business_id_customer_id_idx" ON "appointment_class_enrollments"("business_id", "customer_id");

-- CreateIndex
CREATE INDEX "appointment_class_enrollments_business_id_customer_phone_idx" ON "appointment_class_enrollments"("business_id", "customer_phone");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_class_enrollments_business_id_code_key" ON "appointment_class_enrollments"("business_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_customer_profiles_customer_id_key" ON "appointment_customer_profiles"("customer_id");

-- CreateIndex
CREATE INDEX "appointment_customer_profiles_business_id_idx" ON "appointment_customer_profiles"("business_id");

-- CreateIndex
CREATE INDEX "appointment_staff_payouts_business_id_resource_id_period_to_idx" ON "appointment_staff_payouts"("business_id", "resource_id", "period_to");

-- CreateIndex
CREATE INDEX "appointment_packages_business_id_deleted_at_idx" ON "appointment_packages"("business_id", "deleted_at");

-- CreateIndex
CREATE INDEX "appointment_package_purchases_business_id_customer_id_idx" ON "appointment_package_purchases"("business_id", "customer_id");

-- CreateIndex
CREATE INDEX "appointment_package_purchases_business_id_customer_phone_idx" ON "appointment_package_purchases"("business_id", "customer_phone");

-- CreateIndex
CREATE INDEX "appointment_membership_plans_business_id_deleted_at_idx" ON "appointment_membership_plans"("business_id", "deleted_at");

-- CreateIndex
CREATE INDEX "appointment_memberships_business_id_status_idx" ON "appointment_memberships"("business_id", "status");

-- CreateIndex
CREATE INDEX "appointment_memberships_business_id_customer_id_idx" ON "appointment_memberships"("business_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_gift_cards_business_id_code_key" ON "appointment_gift_cards"("business_id", "code");

-- CreateIndex
CREATE INDEX "appointment_price_rules_business_id_idx" ON "appointment_price_rules"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_loyalty_cards_customer_id_key" ON "appointment_loyalty_cards"("customer_id");

-- CreateIndex
CREATE INDEX "appointment_loyalty_cards_business_id_idx" ON "appointment_loyalty_cards"("business_id");

-- CreateIndex
CREATE INDEX "appointment_recurring_series_business_id_is_active_idx" ON "appointment_recurring_series"("business_id", "is_active");

-- CreateIndex
CREATE INDEX "appointment_winback_campaigns_business_id_idx" ON "appointment_winback_campaigns"("business_id");

-- CreateIndex
CREATE INDEX "appointment_winback_sends_business_id_coupon_code_idx" ON "appointment_winback_sends"("business_id", "coupon_code");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_winback_sends_campaign_id_customer_id_key" ON "appointment_winback_sends"("campaign_id", "customer_id");

-- CreateIndex
CREATE INDEX "appointment_waitlist_entries_business_id_date_status_idx" ON "appointment_waitlist_entries"("business_id", "date", "status");

-- CreateIndex
CREATE INDEX "appointment_message_logs_business_id_created_at_idx" ON "appointment_message_logs"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "appointment_message_logs_appointment_id_idx" ON "appointment_message_logs"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_message_logs_enrollment_id_idx" ON "appointment_message_logs"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_message_logs_business_id_dedupe_key_key" ON "appointment_message_logs"("business_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "appointment_settings" ADD CONSTRAINT "appointment_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_resources" ADD CONSTRAINT "appointment_resources_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_resources" ADD CONSTRAINT "appointment_resources_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_resources" ADD CONSTRAINT "appointment_resources_assigned_space_id_fkey" FOREIGN KEY ("assigned_space_id") REFERENCES "appointment_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_special_days" ADD CONSTRAINT "appointment_special_days_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "appointment_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "appointment_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_recurring_series_id_fkey" FOREIGN KEY ("recurring_series_id") REFERENCES "appointment_recurring_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_package_purchase_id_fkey" FOREIGN KEY ("package_purchase_id") REFERENCES "appointment_package_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "appointment_gift_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "appointment_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "appointment_class_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_package_purchase_id_fkey" FOREIGN KEY ("package_purchase_id") REFERENCES "appointment_package_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "appointment_gift_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "appointment_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_registered_by_member_id_fkey" FOREIGN KEY ("registered_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_templates" ADD CONSTRAINT "appointment_class_templates_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_templates" ADD CONSTRAINT "appointment_class_templates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "appointment_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_templates" ADD CONSTRAINT "appointment_class_templates_instructor_resource_id_fkey" FOREIGN KEY ("instructor_resource_id") REFERENCES "appointment_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_templates" ADD CONSTRAINT "appointment_class_templates_room_resource_id_fkey" FOREIGN KEY ("room_resource_id") REFERENCES "appointment_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_sessions" ADD CONSTRAINT "appointment_class_sessions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_sessions" ADD CONSTRAINT "appointment_class_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "appointment_class_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_enrollments" ADD CONSTRAINT "appointment_class_enrollments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_enrollments" ADD CONSTRAINT "appointment_class_enrollments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "appointment_class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_enrollments" ADD CONSTRAINT "appointment_class_enrollments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_enrollments" ADD CONSTRAINT "appointment_class_enrollments_package_purchase_id_fkey" FOREIGN KEY ("package_purchase_id") REFERENCES "appointment_package_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_enrollments" ADD CONSTRAINT "appointment_class_enrollments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "appointment_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_class_enrollments" ADD CONSTRAINT "appointment_class_enrollments_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_customer_profiles" ADD CONSTRAINT "appointment_customer_profiles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_customer_profiles" ADD CONSTRAINT "appointment_customer_profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_staff_payouts" ADD CONSTRAINT "appointment_staff_payouts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_staff_payouts" ADD CONSTRAINT "appointment_staff_payouts_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "appointment_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_staff_payouts" ADD CONSTRAINT "appointment_staff_payouts_registered_by_member_id_fkey" FOREIGN KEY ("registered_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_packages" ADD CONSTRAINT "appointment_packages_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_packages" ADD CONSTRAINT "appointment_packages_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "appointment_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_package_purchases" ADD CONSTRAINT "appointment_package_purchases_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_package_purchases" ADD CONSTRAINT "appointment_package_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "appointment_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_package_purchases" ADD CONSTRAINT "appointment_package_purchases_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_membership_plans" ADD CONSTRAINT "appointment_membership_plans_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_memberships" ADD CONSTRAINT "appointment_memberships_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_memberships" ADD CONSTRAINT "appointment_memberships_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "appointment_membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_memberships" ADD CONSTRAINT "appointment_memberships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_gift_cards" ADD CONSTRAINT "appointment_gift_cards_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_gift_cards" ADD CONSTRAINT "appointment_gift_cards_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "appointment_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_gift_cards" ADD CONSTRAINT "appointment_gift_cards_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_price_rules" ADD CONSTRAINT "appointment_price_rules_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_loyalty_cards" ADD CONSTRAINT "appointment_loyalty_cards_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_loyalty_cards" ADD CONSTRAINT "appointment_loyalty_cards_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_recurring_series" ADD CONSTRAINT "appointment_recurring_series_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_recurring_series" ADD CONSTRAINT "appointment_recurring_series_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_recurring_series" ADD CONSTRAINT "appointment_recurring_series_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "appointment_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_recurring_series" ADD CONSTRAINT "appointment_recurring_series_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "appointment_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_winback_campaigns" ADD CONSTRAINT "appointment_winback_campaigns_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_winback_sends" ADD CONSTRAINT "appointment_winback_sends_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_winback_sends" ADD CONSTRAINT "appointment_winback_sends_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "appointment_winback_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_winback_sends" ADD CONSTRAINT "appointment_winback_sends_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "appointment_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "appointment_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_waitlist_entries" ADD CONSTRAINT "appointment_waitlist_entries_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_message_logs" ADD CONSTRAINT "appointment_message_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_message_logs" ADD CONSTRAINT "appointment_message_logs_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_message_logs" ADD CONSTRAINT "appointment_message_logs_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "appointment_class_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_message_logs" ADD CONSTRAINT "appointment_message_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Sin policies a propósito (ver 20260910110000_rls_tablas_publicas).
ALTER TABLE "appointment_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_special_days" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_class_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_class_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_class_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_customer_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_staff_payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_package_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_membership_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_gift_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_price_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_loyalty_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_recurring_series" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_winback_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_winback_sends" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_waitlist_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_message_logs" ENABLE ROW LEVEL SECURITY;

-- ─── Anti doble reserva (defensa en la base) ────────────────────────────────
-- Dos turnos del mismo recurso no pueden pisarse en [starts_at, ends_at)
-- mientras ninguno de los dos esté cancelado. El intervalo es semiabierto: un
-- turno que termina 10:30 y otro que empieza 10:30 NO chocan.
--
-- La regla completa (margen entre turnos, horario del negocio y de la agenda,
-- anticipación, límite por cliente) la aplica AppointmentsService en una
-- transacción. Esto es la red de abajo: si dos reservas entran a la vez y las
-- dos pasan el chequeo, la segunda falla acá con el error 23P01
-- (exclusion_violation) y el service lo traduce a un 409 "Ese horario se acaba
-- de ocupar".
--
-- No cubre el margen (`buffer_min`): el margen es configuración y puede
-- cambiar; meterlo acá invalidaría turnos ya dados.
--
-- Necesita btree_gist (el `=` sobre resource_id dentro de un índice GiST). En
-- Supabase las extensiones van en el schema `extensions`; en un Postgres pelado
-- no existe y cae en el schema por defecto. La clase de operadores se nombra
-- con su schema porque Prisma conecta con search_path = public y, si la
-- extensión quedó en `extensions`, no la encontraría.
--
-- Prisma no modela constraints de exclusión: `migrate diff` no la ve (no da
-- drift) y `db pull` avisa con un warning. Vive solo en esta migración.
DO $$
DECLARE
  esquema text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
      CREATE EXTENSION btree_gist WITH SCHEMA extensions;
    ELSE
      CREATE EXTENSION btree_gist;
    END IF;
  END IF;

  SELECT n.nspname INTO esquema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'btree_gist';

  EXECUTE format(
    'ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap" '
    || 'EXCLUDE USING gist ("resource_id" %I.gist_text_ops WITH =, tsrange("starts_at", "ends_at") WITH &&) '
    || 'WHERE ("status" <> ''CANCELLED'')',
    esquema
  );
END $$;
