-- Phase 3A: users and clients
-- Source: docs/database-schema.md §5.1, §5.2

-- ---------------------------------------------------------------------------
-- users — extends auth.users with application profile and role
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT,
  role            user_role NOT NULL DEFAULT 'client',
  avatar_url      TEXT,
  organisation    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_email ON users (email);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- clients — wealth-architecture subject (household / individual)
-- ---------------------------------------------------------------------------
CREATE TABLE clients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  advisor_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  status            client_status NOT NULL DEFAULT 'prospect',
  display_name      TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  currency_code     CHAR(3) NOT NULL DEFAULT 'SGD',
  onboarding_step   TEXT,
  last_review_at    TIMESTAMPTZ,
  next_review_due   DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- MVP: user_id set on self-registration; advisor_user_id optional until Advisor OS
  CONSTRAINT clients_has_owner CHECK (
    user_id IS NOT NULL OR advisor_user_id IS NOT NULL
  )
);

CREATE INDEX idx_clients_user_id ON clients (user_id);
CREATE INDEX idx_clients_advisor_user_id ON clients (advisor_user_id);
CREATE INDEX idx_clients_status ON clients (status);
CREATE INDEX idx_clients_next_review_due ON clients (next_review_due)
  WHERE next_review_due IS NOT NULL;

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth trigger: provision public.users row on signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

COMMENT ON TABLE users IS 'Application profile extending auth.users.';
COMMENT ON TABLE clients IS 'Wealth-architecture client record; MVP maps one user to one client.';

-- ---------------------------------------------------------------------------
-- RLS helpers — SECURITY DEFINER + fixed search_path + STABLE
-- (created here because they reference users/clients)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_advisor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('advisor', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION owns_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clients
    WHERE id = p_client_id
      AND (user_id = auth.uid() OR advisor_user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION is_assigned_advisor(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clients
    WHERE id = p_client_id
      AND advisor_user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION is_admin() IS 'True when auth.uid() has role admin.';
COMMENT ON FUNCTION is_advisor() IS 'True when auth.uid() is advisor or admin.';
COMMENT ON FUNCTION owns_client(UUID) IS 'True when auth.uid() owns or advises the client.';
COMMENT ON FUNCTION is_assigned_advisor(UUID) IS 'True when auth.uid() is the assigned advisor for the client.';
