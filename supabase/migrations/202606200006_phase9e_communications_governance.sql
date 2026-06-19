-- Phase 9E: Communications governance — governed content, notifications, preferences, deliveries, binder exports
-- Do not apply to production without staging validation.

-- ---------------------------------------------------------------------------
-- Governed content (Insights & Updates)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS governed_content (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                     TEXT NOT NULL,
  summary                   TEXT NOT NULL,
  body                      TEXT NOT NULL DEFAULT '',
  category                  TEXT NOT NULL,
  content_type              TEXT NOT NULL,
  audience_scope            TEXT NOT NULL,
  target_relationship_stages TEXT[] NOT NULL DEFAULT '{}',
  target_client_ids         UUID[] NOT NULL DEFAULT '{}',
  target_adviser_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  external_url              TEXT,
  external_source_name      TEXT,
  source_publication_date   DATE,
  author_user_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  adviser_user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_status           TEXT NOT NULL DEFAULT 'draft',
  approved_by_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at               TIMESTAMPTZ,
  rejection_reason          TEXT,
  scheduled_at              TIMESTAMPTZ,
  published_at              TIMESTAMPTZ,
  expires_at                TIMESTAMPTZ,
  withdrawn_at              TIMESTAMPTZ,
  withdrawal_reason         TEXT,
  version                   INTEGER NOT NULL DEFAULT 1,
  supersedes_content_id     UUID REFERENCES governed_content(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT governed_content_category_check CHECK (
    category IN (
      'financial_education', 'market_update', 'planning_reminder', 'company_update',
      'event', 'regulatory_update', 'adviser_message', 'document_notification',
      'appointment_update', 'review_reminder'
    )
  ),
  CONSTRAINT governed_content_content_type_check CHECK (
    content_type IN (
      'general_education', 'general_market_update', 'adviser_message',
      'promotional_product', 'operational_notification', 'internal_adviser'
    )
  ),
  CONSTRAINT governed_content_audience_scope_check CHECK (
    audience_scope IN (
      'all_active_clients', 'assigned_active_clients', 'all_prospects',
      'assigned_prospects', 'selected_clients', 'internal_advisers', 'public_education'
    )
  ),
  CONSTRAINT governed_content_approval_status_check CHECK (
    approval_status IN (
      'draft', 'submitted_for_review', 'changes_requested', 'approved',
      'scheduled', 'published', 'expired', 'rejected', 'withdrawn', 'archived'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_governed_content_approval_status
  ON governed_content (approval_status);
CREATE INDEX IF NOT EXISTS idx_governed_content_author
  ON governed_content (author_user_id);
CREATE INDEX IF NOT EXISTS idx_governed_content_adviser
  ON governed_content (adviser_user_id);
CREATE INDEX IF NOT EXISTS idx_governed_content_published
  ON governed_content (published_at DESC)
  WHERE approval_status = 'published';
CREATE INDEX IF NOT EXISTS idx_governed_content_supersedes
  ON governed_content (supersedes_content_id);

CREATE TRIGGER governed_content_set_updated_at
  BEFORE UPDATE ON governed_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE governed_content ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE governed_content IS
  'Phase 9E governed communications. Writes via service-role API only.';

-- ---------------------------------------------------------------------------
-- Client in-app notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title             TEXT NOT NULL,
  summary           TEXT NOT NULL,
  reference_type    TEXT,
  reference_id      UUID,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_notifications_type_check CHECK (
    notification_type IN (
      'new_publication', 'new_insight', 'document_uploaded', 'document_replaced',
      'document_removed', 'document_action_required', 'appointment_upcoming',
      'appointment_changed', 'appointment_cancelled', 'roadmap_task_assigned',
      'review_requested', 'adviser_message', 'publication_approval_result'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_client_notifications_client
  ON client_notifications (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_notifications_unread
  ON client_notifications (client_id)
  WHERE read_at IS NULL;

ALTER TABLE client_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_notifications_select_owner
  ON client_notifications FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN users u ON u.id = auth.uid()
      WHERE c.user_id = u.id
    )
  );

CREATE POLICY client_notifications_update_owner
  ON client_notifications FOR UPDATE
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN users u ON u.id = auth.uid()
      WHERE c.user_id = u.id
    )
  );

-- ---------------------------------------------------------------------------
-- Communication preferences (client-controlled)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communication_preferences (
  client_id                     UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  in_app_operational            BOOLEAN NOT NULL DEFAULT true,
  email_operational             BOOLEAN NOT NULL DEFAULT true,
  educational_insights          BOOLEAN NOT NULL DEFAULT true,
  market_updates                BOOLEAN NOT NULL DEFAULT true,
  event_announcements           BOOLEAN NOT NULL DEFAULT true,
  adviser_messages              BOOLEAN NOT NULL DEFAULT true,
  promotional_content           BOOLEAN NOT NULL DEFAULT false,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER communication_preferences_set_updated_at
  BEFORE UPDATE ON communication_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE communication_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY communication_preferences_select_owner
  ON communication_preferences FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN users u ON u.id = auth.uid()
      WHERE c.user_id = u.id
    )
  );

CREATE POLICY communication_preferences_update_owner
  ON communication_preferences FOR UPDATE
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN users u ON u.id = auth.uid()
      WHERE c.user_id = u.id
    )
  );

-- ---------------------------------------------------------------------------
-- Communication delivery records (email channel)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communication_deliveries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id    UUID REFERENCES governed_content(id) ON DELETE SET NULL,
  notification_id     UUID REFERENCES client_notifications(id) ON DELETE SET NULL,
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel             TEXT NOT NULL DEFAULT 'email',
  delivery_status     TEXT NOT NULL DEFAULT 'pending',
  provider_reference  TEXT,
  attempt_count       INTEGER NOT NULL DEFAULT 0,
  last_attempt_at     TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  error_code          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT communication_deliveries_channel_check CHECK (
    channel IN ('email', 'in_app')
  ),
  CONSTRAINT communication_deliveries_status_check CHECK (
    delivery_status IN (
      'pending', 'sent', 'failed', 'retrying', 'suppressed_by_preference',
      'skipped_no_email', 'cancelled_withdrawn'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_communication_deliveries_client
  ON communication_deliveries (client_id);
CREATE INDEX IF NOT EXISTS idx_communication_deliveries_communication
  ON communication_deliveries (communication_id);
CREATE INDEX IF NOT EXISTS idx_communication_deliveries_status
  ON communication_deliveries (delivery_status)
  WHERE delivery_status IN ('pending', 'retrying');

CREATE TRIGGER communication_deliveries_set_updated_at
  BEFORE UPDATE ON communication_deliveries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE communication_deliveries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE communication_deliveries IS
  'Phase 9E delivery tracking. Client cannot read provider metadata.';

-- ---------------------------------------------------------------------------
-- Binder exports (adviser-internal by default)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS binder_exports (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  meeting_date            DATE,
  sections_included       TEXT[] NOT NULL DEFAULT '{}',
  source_publication_ids  UUID[] NOT NULL DEFAULT '{}',
  document_ids            UUID[] NOT NULL DEFAULT '{}',
  status                  TEXT NOT NULL DEFAULT 'generated',
  published_to_client     BOOLEAN NOT NULL DEFAULT false,
  published_at            TIMESTAMPTZ,
  storage_path            TEXT,
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT binder_exports_status_check CHECK (
    status IN ('generated', 'published_to_client', 'withdrawn')
  )
);

CREATE INDEX IF NOT EXISTS idx_binder_exports_client
  ON binder_exports (client_id);
CREATE INDEX IF NOT EXISTS idx_binder_exports_adviser
  ON binder_exports (adviser_user_id);

CREATE TRIGGER binder_exports_set_updated_at
  BEFORE UPDATE ON binder_exports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE binder_exports ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE binder_exports IS
  'Phase 9E adviser binder/portfolio-summary exports. Client access requires explicit publication.';

-- ---------------------------------------------------------------------------
-- Legacy promotions migration tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotion_migration_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id      UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  classification    TEXT NOT NULL,
  migrated_content_id UUID REFERENCES governed_content(id) ON DELETE SET NULL,
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promotion_migration_classification_check CHECK (
    classification IN (
      'safe_educational', 'market_update_review', 'event', 'product_promotional',
      'expired', 'unsuitable'
    )
  ),
  UNIQUE (promotion_id)
);

-- ---------------------------------------------------------------------------
-- Phase 9E feature controls
-- ---------------------------------------------------------------------------
INSERT INTO platform_feature_controls (feature_key, enabled, client_visible, adviser_visible, description)
VALUES
  ('adviser_insight_authoring', true, false, true, 'Adviser governed content authoring (Phase 9E)'),
  ('admin_content_approval', true, false, true, 'Admin/compliance content approval workspace (Phase 9E)'),
  ('market_updates', true, true, true, 'Market update Insights category (Phase 9E)'),
  ('product_related_content', false, false, true, 'Product-related promotional content — default disabled (Phase 9E)'),
  ('client_in_app_notifications', true, true, false, 'Client in-app notification centre (Phase 9E)'),
  ('client_email_notifications', true, true, false, 'Client email operational notifications (Phase 9E)'),
  ('document_event_notifications', true, true, true, 'Document lifecycle client notifications (Phase 9E)'),
  ('communication_preferences', true, true, false, 'Client communication preferences (Phase 9E)'),
  ('binder_export', true, false, true, 'Adviser binder/portfolio-summary export (Phase 9E)'),
  ('binder_client_publication', false, false, true, 'Publish binder to client document vault — default disabled (Phase 9E)')
ON CONFLICT (feature_key) DO NOTHING;
