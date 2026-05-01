CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS grantmakers (
  id TEXT PRIMARY KEY,
  segment TEXT,
  name TEXT NOT NULL,
  country TEXT,
  region TEXT,
  fit TEXT,
  eligibility TEXT,
  grant_route TEXT,
  public_contact TEXT,
  apply_url TEXT,
  source_url TEXT,
  ai_strategy TEXT,
  contact_type TEXT,
  privacy_note TEXT,
  last_checked DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_profiles (
  grantmaker_id TEXT PRIMARY KEY REFERENCES grantmakers(id) ON DELETE CASCADE,
  grant_status TEXT NOT NULL DEFAULT 'Not started',
  relationship_status TEXT NOT NULL DEFAULT 'Cold / no relationship yet',
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  owner TEXT,
  contact_person_or_role TEXT,
  contacted_with TEXT,
  last_contact_date DATE,
  next_action TEXT,
  next_action_date DATE,
  grant_notes TEXT,
  relationship_notes TEXT,
  custom_tags TEXT,
  organization_summary TEXT,
  mission_alignment_notes TEXT,
  program_fit_notes TEXT,
  eligibility_risk_notes TEXT,
  funding_fit_score INTEGER DEFAULT 50 CHECK (funding_fit_score IS NULL OR funding_fit_score BETWEEN 0 AND 100),
  relationship_strength_score INTEGER DEFAULT 0 CHECK (relationship_strength_score IS NULL OR relationship_strength_score BETWEEN 0 AND 100),
  urgency_score INTEGER DEFAULT 50 CHECK (urgency_score IS NULL OR urgency_score BETWEEN 0 AND 100),
  estimated_ask_amount NUMERIC(14,2),
  currency TEXT DEFAULT 'EUR',
  deadline_date DATE,
  decision_cycle TEXT,
  budget_status TEXT DEFAULT 'Not started',
  warm_intro_source TEXT,
  stakeholder_map TEXT,
  decision_maker_notes TEXT,
  relationship_goal TEXT,
  value_offer TEXT,
  stewardship_plan TEXT,
  risks_and_objections TEXT,
  evidence_assets TEXT,
  next_best_action TEXT,
  ai_recommended_message TEXT,
  last_research_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantmaker_id TEXT NOT NULL REFERENCES grantmakers(id) ON DELETE CASCADE,
  full_name TEXT,
  role_title TEXT,
  organization TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  contact_url TEXT,
  source_url TEXT,
  contact_type TEXT NOT NULL DEFAULT 'Institutional / public',
  consent_basis TEXT NOT NULL DEFAULT 'Public institutional contact / manual verification required',
  relationship_strength TEXT NOT NULL DEFAULT 'Unknown',
  preferred_channel TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  last_verified_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantmaker_id TEXT NOT NULL REFERENCES grantmakers(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL DEFAULT 'email',
  person_or_role TEXT,
  subject TEXT,
  notes TEXT,
  outcome TEXT,
  next_action TEXT,
  next_action_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantmaker_id TEXT NOT NULL REFERENCES grantmakers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  due_date DATE,
  owner TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grant_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantmaker_id TEXT NOT NULL REFERENCES grantmakers(id) ON DELETE CASCADE,
  opportunity_name TEXT NOT NULL DEFAULT 'General grant opportunity',
  stage TEXT NOT NULL DEFAULT 'Researching',
  status TEXT NOT NULL DEFAULT 'Open / unknown',
  amount_min NUMERIC(14,2),
  amount_max NUMERIC(14,2),
  currency TEXT DEFAULT 'EUR',
  deadline_date DATE,
  decision_date DATE,
  application_url TEXT,
  requirements TEXT,
  documents_needed TEXT,
  success_strategy TEXT,
  blockers TEXT,
  owner TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantmaker_id TEXT NOT NULL REFERENCES grantmakers(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES grant_opportunities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'Concept note',
  status TEXT NOT NULL DEFAULT 'Needed',
  owner TEXT,
  due_date DATE,
  file_or_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relationship_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantmaker_id TEXT NOT NULL REFERENCES grantmakers(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL DEFAULT 'Value update',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  send_after_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantmaker_id TEXT REFERENCES grantmakers(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL DEFAULT 'Source / privacy note',
  note TEXT NOT NULL,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantmaker_id TEXT REFERENCES grantmakers(id) ON DELETE SET NULL,
  provider TEXT,
  model TEXT,
  action TEXT,
  prompt TEXT,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relationship_playbook_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage TEXT NOT NULL,
  advice TEXT NOT NULL,
  example_action TEXT
);

CREATE INDEX IF NOT EXISTS idx_grantmakers_country ON grantmakers(country);
CREATE INDEX IF NOT EXISTS idx_grantmakers_segment ON grantmakers(segment);
CREATE INDEX IF NOT EXISTS idx_crm_grant_status ON crm_profiles(grant_status);
CREATE INDEX IF NOT EXISTS idx_crm_relationship_status ON crm_profiles(relationship_status);
CREATE INDEX IF NOT EXISTS idx_contacts_grantmaker_id ON contact_people(grantmaker_id);
CREATE INDEX IF NOT EXISTS idx_interactions_grantmaker_id ON interactions(grantmaker_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_opps_grantmaker_id ON grant_opportunities(grantmaker_id);
CREATE INDEX IF NOT EXISTS idx_opps_deadline ON grant_opportunities(deadline_date);
CREATE INDEX IF NOT EXISTS idx_ai_history_grantmaker_id ON ai_history(grantmaker_id);


-- Import/export and communications integration scaffolding.
CREATE TABLE IF NOT EXISTS import_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Created',
  file_name TEXT,
  format TEXT,
  rows_total INTEGER DEFAULT 0,
  rows_success INTEGER DEFAULT 0,
  rows_failed INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS integration_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  account_label TEXT NOT NULL,
  email_or_identifier TEXT,
  status TEXT NOT NULL DEFAULT 'Not connected',
  auth_type TEXT NOT NULL DEFAULT 'OAuth / API token',
  scopes TEXT,
  token_ref TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantmaker_id TEXT REFERENCES grantmakers(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contact_people(id) ON DELETE SET NULL,
  integration_account_id UUID REFERENCES integration_accounts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  provider TEXT,
  to_address TEXT,
  from_address TEXT,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',
  external_message_id TEXT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantmaker_id TEXT REFERENCES grantmakers(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contact_people(id) ON DELETE SET NULL,
  integration_account_id UUID REFERENCES integration_accounts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  provider TEXT,
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  body TEXT,
  external_message_id TEXT,
  received_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantmaker_id TEXT REFERENCES grantmakers(id) ON DELETE SET NULL,
  integration_account_id UUID REFERENCES integration_accounts(id) ON DELETE SET NULL,
  provider TEXT,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  external_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'Planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_accounts_provider ON integration_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_grantmaker ON outbound_messages(grantmaker_id);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_grantmaker ON inbound_messages(grantmaker_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_grantmaker ON calendar_events(grantmaker_id);
CREATE INDEX IF NOT EXISTS idx_import_export_jobs_type ON import_export_jobs(job_type);
