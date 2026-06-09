-- Phase 3A: enable RLS and policies on all public tables
-- Source: docs/database-schema.md §9.2
-- Server-side scoring writes use service role (bypasses RLS).

-- Grant execute on helper functions to API roles
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_advisor() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION owns_client(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_assigned_advisor(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION owns_shield_score(UUID) TO authenticated, service_role;

-- ===========================================================================
-- users
-- ===========================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own_or_admin
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY users_update_own
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY users_delete_admin
  ON users FOR DELETE
  TO authenticated
  USING (is_admin());

-- INSERT handled by handle_new_user() trigger (SECURITY DEFINER)

-- ===========================================================================
-- clients
-- ===========================================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_select_owner_or_admin
  ON clients FOR SELECT
  TO authenticated
  USING (owns_client(id) OR is_admin());

CREATE POLICY clients_insert_self_or_advisor
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin()
    OR user_id = auth.uid()
    OR (is_advisor() AND advisor_user_id = auth.uid())
  );

CREATE POLICY clients_update_owner_or_admin
  ON clients FOR UPDATE
  TO authenticated
  USING (owns_client(id) OR is_admin())
  WITH CHECK (owns_client(id) OR is_admin());

CREATE POLICY clients_delete_admin
  ON clients FOR DELETE
  TO authenticated
  USING (is_admin());

-- ===========================================================================
-- client_profiles
-- ===========================================================================
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_profiles_select_owner
  ON client_profiles FOR SELECT
  TO authenticated
  USING (owns_client(client_id) OR is_admin());

CREATE POLICY client_profiles_insert_owner_or_advisor
  ON client_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    owns_client(client_id)
    OR is_assigned_advisor(client_id)
    OR is_admin()
  );

CREATE POLICY client_profiles_update_owner_or_advisor
  ON client_profiles FOR UPDATE
  TO authenticated
  USING (owns_client(client_id) OR is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (owns_client(client_id) OR is_assigned_advisor(client_id) OR is_admin());

CREATE POLICY client_profiles_delete_admin
  ON client_profiles FOR DELETE
  TO authenticated
  USING (is_admin());

-- ===========================================================================
-- discover_profiles
-- ===========================================================================
ALTER TABLE discover_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY discover_profiles_select_owner
  ON discover_profiles FOR SELECT
  TO authenticated
  USING (owns_client(client_id) OR is_admin());

CREATE POLICY discover_profiles_insert_owner_or_advisor
  ON discover_profiles FOR INSERT
  TO authenticated
  WITH CHECK (owns_client(client_id) OR is_assigned_advisor(client_id));

CREATE POLICY discover_profiles_update_owner_or_advisor
  ON discover_profiles FOR UPDATE
  TO authenticated
  USING (owns_client(client_id) OR is_assigned_advisor(client_id))
  WITH CHECK (owns_client(client_id) OR is_assigned_advisor(client_id));

CREATE POLICY discover_profiles_delete_admin
  ON discover_profiles FOR DELETE
  TO authenticated
  USING (is_admin());

-- ===========================================================================
-- financial_profiles (server-side writes; SELECT for owners)
-- ===========================================================================
ALTER TABLE financial_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_profiles_select_owner
  ON financial_profiles FOR SELECT
  TO authenticated
  USING (owns_client(client_id) OR is_admin());

CREATE POLICY financial_profiles_delete_admin
  ON financial_profiles FOR DELETE
  TO authenticated
  USING (is_admin());

-- ===========================================================================
-- shield_scores (server-side writes; SELECT for owners)
-- ===========================================================================
ALTER TABLE shield_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY shield_scores_select_owner
  ON shield_scores FOR SELECT
  TO authenticated
  USING (owns_client(client_id) OR is_admin());

CREATE POLICY shield_scores_delete_admin
  ON shield_scores FOR DELETE
  TO authenticated
  USING (is_admin());

-- ===========================================================================
-- pillar_scores (SELECT via shield ownership)
-- ===========================================================================
ALTER TABLE pillar_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY pillar_scores_select_owner
  ON pillar_scores FOR SELECT
  TO authenticated
  USING (owns_shield_score(shield_score_id) OR is_admin());

CREATE POLICY pillar_scores_delete_admin
  ON pillar_scores FOR DELETE
  TO authenticated
  USING (is_admin());

-- ===========================================================================
-- stress_tests (SELECT via shield ownership)
-- ===========================================================================
ALTER TABLE stress_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY stress_tests_select_owner
  ON stress_tests FOR SELECT
  TO authenticated
  USING (owns_shield_score(shield_score_id) OR is_admin());

CREATE POLICY stress_tests_delete_admin
  ON stress_tests FOR DELETE
  TO authenticated
  USING (is_admin());

-- ===========================================================================
-- roadmap_items
-- ===========================================================================
ALTER TABLE roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY roadmap_items_select_owner
  ON roadmap_items FOR SELECT
  TO authenticated
  USING (owns_client(client_id) OR is_admin());

-- Generation inserts use service role; advisors may insert for assigned clients
CREATE POLICY roadmap_items_insert_advisor_or_admin
  ON roadmap_items FOR INSERT
  TO authenticated
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

-- Clients/advisors may update status fields (app enforces column scope)
CREATE POLICY roadmap_items_update_status_owner_or_advisor
  ON roadmap_items FOR UPDATE
  TO authenticated
  USING (owns_client(client_id) OR is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (owns_client(client_id) OR is_assigned_advisor(client_id) OR is_admin());

CREATE POLICY roadmap_items_delete_admin
  ON roadmap_items FOR DELETE
  TO authenticated
  USING (is_admin());

-- ===========================================================================
-- annual_reviews
-- ===========================================================================
ALTER TABLE annual_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY annual_reviews_select_owner
  ON annual_reviews FOR SELECT
  TO authenticated
  USING (owns_client(client_id) OR is_admin());

CREATE POLICY annual_reviews_insert_advisor_or_admin
  ON annual_reviews FOR INSERT
  TO authenticated
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

CREATE POLICY annual_reviews_update_advisor_or_admin
  ON annual_reviews FOR UPDATE
  TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

CREATE POLICY annual_reviews_delete_admin
  ON annual_reviews FOR DELETE
  TO authenticated
  USING (is_admin());

-- ===========================================================================
-- wealth_blueprints
-- ===========================================================================
ALTER TABLE wealth_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY wealth_blueprints_select_owner
  ON wealth_blueprints FOR SELECT
  TO authenticated
  USING (owns_client(client_id) OR is_admin());

CREATE POLICY wealth_blueprints_insert_advisor_or_admin
  ON wealth_blueprints FOR INSERT
  TO authenticated
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

CREATE POLICY wealth_blueprints_update_admin
  ON wealth_blueprints FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY wealth_blueprints_delete_admin
  ON wealth_blueprints FOR DELETE
  TO authenticated
  USING (is_admin());

-- ===========================================================================
-- documents
-- ===========================================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_select_owner
  ON documents FOR SELECT
  TO authenticated
  USING (owns_client(client_id) OR is_admin());

CREATE POLICY documents_insert_owner_or_advisor
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    (owns_client(client_id) OR is_assigned_advisor(client_id))
    AND (uploaded_by_user_id IS NULL OR uploaded_by_user_id = auth.uid())
  );

CREATE POLICY documents_update_uploader_or_advisor
  ON documents FOR UPDATE
  TO authenticated
  USING (
    uploaded_by_user_id = auth.uid()
    OR is_assigned_advisor(client_id)
    OR is_admin()
  )
  WITH CHECK (
    uploaded_by_user_id = auth.uid()
    OR is_assigned_advisor(client_id)
    OR is_admin()
  );

CREATE POLICY documents_delete_admin
  ON documents FOR DELETE
  TO authenticated
  USING (is_admin());

-- ===========================================================================
-- advisor_notes
-- ===========================================================================
ALTER TABLE advisor_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY advisor_notes_select_assigned_advisor
  ON advisor_notes FOR SELECT
  TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin());

CREATE POLICY advisor_notes_insert_assigned_advisor
  ON advisor_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    is_assigned_advisor(client_id)
    AND advisor_user_id = auth.uid()
  );

CREATE POLICY advisor_notes_update_author
  ON advisor_notes FOR UPDATE
  TO authenticated
  USING (advisor_user_id = auth.uid() OR is_admin())
  WITH CHECK (advisor_user_id = auth.uid() OR is_admin());

CREATE POLICY advisor_notes_delete_author_or_admin
  ON advisor_notes FOR DELETE
  TO authenticated
  USING (advisor_user_id = auth.uid() OR is_admin());
