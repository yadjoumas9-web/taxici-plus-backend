-- =========================================================
-- TAXICI+ — SCHÉMA DE BASE DE DONNÉES (PostgreSQL)
-- Basé sur le cahier des charges TaxiCI+ v1
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- pour gen_random_uuid()

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('passenger', 'driver', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ride_status AS ENUM (
    'requested',
    'accepted',
    'arrived',
    'in_progress',
    'completed',
    'cancelled_by_passenger',
    'cancelled_by_driver',
    'no_driver_found'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'wave', 'orange_money', 'mtn_momo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- USERS (passagers, chauffeurs, admins) ----------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(20) UNIQUE NOT NULL,
  full_name     VARCHAR(120),
  email         VARCHAR(160),
  role          user_role NOT NULL DEFAULT 'passenger',
  password_hash TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- ---------- OTP (vérification par SMS) ----------
CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       VARCHAR(20) NOT NULL,
  code        VARCHAR(6) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);

-- ---------- DRIVERS (profil chauffeur — lien direct, pas de flotte tierce) ----------
CREATE TABLE IF NOT EXISTS drivers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  license_number    VARCHAR(50) NOT NULL,
  vehicle_plate     VARCHAR(20) NOT NULL,
  vehicle_model     VARCHAR(80),
  kyc_status        kyc_status NOT NULL DEFAULT 'pending',
  kyc_documents     JSONB DEFAULT '{}',
  is_online         BOOLEAN NOT NULL DEFAULT false,
  current_lat       DOUBLE PRECISION,
  current_lng       DOUBLE PRECISION,
  rating_avg        NUMERIC(3,2) DEFAULT 5.00,
  rating_count      INTEGER DEFAULT 0,
  commission_rate   NUMERIC(4,3) NOT NULL DEFAULT 0.090,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drivers_online ON drivers(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers(current_lat, current_lng);

-- ---------- ZONES TARIFAIRES ----------
CREATE TABLE IF NOT EXISTS fare_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(80) NOT NULL,
  base_fare   INTEGER NOT NULL DEFAULT 400,
  per_km      INTEGER NOT NULL DEFAULT 250,
  per_minute  INTEGER NOT NULL DEFAULT 50,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- RIDES (courses) ----------
CREATE TABLE IF NOT EXISTS rides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id      UUID NOT NULL REFERENCES users(id),
  driver_id         UUID REFERENCES drivers(id),
  status            ride_status NOT NULL DEFAULT 'requested',

  from_address      VARCHAR(200) NOT NULL,
  from_lat          DOUBLE PRECISION NOT NULL,
  from_lng          DOUBLE PRECISION NOT NULL,
  to_address        VARCHAR(200) NOT NULL,
  to_lat            DOUBLE PRECISION NOT NULL,
  to_lng            DOUBLE PRECISION NOT NULL,

  distance_km       NUMERIC(6,2),
  duration_min      INTEGER,
  fare_estimated    INTEGER NOT NULL,
  fare_final        INTEGER,

  payment_method    payment_method,
  commission_amount INTEGER,
  driver_net_amount INTEGER,

  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at       TIMESTAMPTZ,
  arrived_at        TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_reason  TEXT
);
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);

-- ---------- TRANSACTIONS (paiement Mobile Money / espèces) ----------
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id         UUID NOT NULL REFERENCES rides(id),
  amount          INTEGER NOT NULL,
  method          payment_method NOT NULL,
  status          payment_status NOT NULL DEFAULT 'pending',
  provider_ref    VARCHAR(120),
  provider_payload JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_ride ON transactions(ride_id);

-- ---------- RETRAITS CHAUFFEUR (disbursement vers Mobile Money) ----------
CREATE TABLE IF NOT EXISTS payouts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     UUID NOT NULL REFERENCES drivers(id),
  amount        INTEGER NOT NULL,
  method        payment_method NOT NULL,
  status        payment_status NOT NULL DEFAULT 'pending',
  provider_ref  VARCHAR(120),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payouts_driver ON payouts(driver_id);

-- ---------- RATINGS (évaluations) ----------
CREATE TABLE IF NOT EXISTS ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     UUID NOT NULL REFERENCES rides(id),
  author_id   UUID NOT NULL REFERENCES users(id),
  target_id   UUID NOT NULL REFERENCES users(id),
  score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ratings_ride ON ratings(ride_id);

-- ---------- DONNÉES INITIALES ----------
INSERT INTO fare_zones (name, base_fare, per_km, per_minute)
VALUES ('Abidjan — zone standard', 400, 250, 50)
ON CONFLICT DO NOTHING;

-- ---------- REFRESH TOKENS (permet la révocation d'une session) ----------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  user_agent   TEXT,
  ip_address   VARCHAR(64),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ---------- JOURNAL D'AUDIT ADMIN (traçabilité) ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID NOT NULL REFERENCES users(id),
  action       VARCHAR(80) NOT NULL,
  target_type  VARCHAR(40) NOT NULL,
  target_id    UUID,
  details      JSONB DEFAULT '{}',
  ip_address   VARCHAR(64),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
