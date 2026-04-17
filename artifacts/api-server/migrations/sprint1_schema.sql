-- ============================================================
-- Sprint 1 Schema Migration — BUSINESSNow Executive Committee
-- Run once; all statements are idempotent (IF NOT EXISTS / IF EXISTS)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. RESOURCES — add defaultRole, skillsWithYears, vacation, hireDate
-- ────────────────────────────────────────────────────────────
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS default_role              TEXT,
  ADD COLUMN IF NOT EXISTS skills_with_years         JSONB    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vacation_allocation_days  INT      DEFAULT 15,
  ADD COLUMN IF NOT EXISTS hire_date                 TEXT;

-- ────────────────────────────────────────────────────────────
-- 2. ACCOUNTS — add type, paymentTerms, contractHeader, convertedFromProspectId
-- ────────────────────────────────────────────────────────────
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS type                       TEXT    DEFAULT 'enterprise',
  ADD COLUMN IF NOT EXISTS payment_terms              TEXT,
  ADD COLUMN IF NOT EXISTS contract_header            TEXT,
  ADD COLUMN IF NOT EXISTS converted_from_prospect_id INT;

-- ────────────────────────────────────────────────────────────
-- 3. PROJECTS — add flags, 4-dimension RAG health, billing fields, delivery lead
-- Note: pm_id = projectManagerId, budget_hours = estimatedHours,
--       consumed_hours = billedHours, budget_value = budget (kept as-is)
-- ────────────────────────────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_internal      BOOLEAN        DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_external      BOOLEAN        DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_administrative BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_status    TEXT           DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS health_budget    TEXT           DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS health_hours     TEXT           DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS health_timeline  TEXT           DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS health_risks     TEXT           DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS is_fixed_fee     BOOLEAN        DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_rate     NUMERIC(8,2)   DEFAULT 125,
  ADD COLUMN IF NOT EXISTS delivery_lead_id INT,
  ADD COLUMN IF NOT EXISTS template_id      INT;

-- ────────────────────────────────────────────────────────────
-- 4. TASKS — add hierarchy cols, comment count, milestone gate
-- Note: parent_id = parentTaskId, etc_hours already exists,
--       assigned_to_id = assigneeId, planned_start_date = startDate
-- ────────────────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS hierarchy_level   INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_leaf           BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS comment_count     INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_milestone_gate BOOLEAN DEFAULT false;

-- Seed hierarchy_level and is_leaf for existing tasks:
-- Root tasks (no parent) = level 0; tasks with children = not leaf
UPDATE tasks SET hierarchy_level = 0 WHERE parent_id IS NULL AND hierarchy_level = 0;
UPDATE tasks t
  SET is_leaf = NOT EXISTS (SELECT 1 FROM tasks c WHERE c.parent_id = t.id)
  WHERE is_leaf = true;

-- ────────────────────────────────────────────────────────────
-- 5. MILESTONES — add milestoneType, invoice alert, signoff, deliverables, invoiceAmount
-- Note: is_billable, billable_amount already exist
-- ────────────────────────────────────────────────────────────
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS milestone_type    TEXT           DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS invoice_alert_sent BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS signoff_required  BOOLEAN        DEFAULT false,
  ADD COLUMN IF NOT EXISTS signoff_status    TEXT           DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS deliverables      TEXT,
  ADD COLUMN IF NOT EXISTS invoice_amount    NUMERIC(14,2);

-- Back-fill invoice_amount from billable_amount where set
UPDATE milestones SET invoice_amount = billable_amount
  WHERE billable_amount IS NOT NULL AND invoice_amount IS NULL;

-- ────────────────────────────────────────────────────────────
-- 6. TIMESHEETS — add billedRole, rates, dailyComment, collaboration flag, submittedAt
-- Note: hours_logged = hours, entry_date, is_billable, approved_by_id already exist
-- ────────────────────────────────────────────────────────────
ALTER TABLE timesheets
  ADD COLUMN IF NOT EXISTS billed_role      TEXT,
  ADD COLUMN IF NOT EXISTS sell_rate        NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS cost_rate        NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS daily_comment    TEXT,
  ADD COLUMN IF NOT EXISTS is_collaboration BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_at     TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────
-- 7. OPPORTUNITIES — add prospectId, staffingRequestTriggered
-- Note: staffing_risk, tentative_project_triggered already exist
-- ────────────────────────────────────────────────────────────
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS prospect_id                INT,
  ADD COLUMN IF NOT EXISTS staffing_request_triggered BOOLEAN DEFAULT false;

-- account_id currently NOT NULL — relax it to allow prospect-only opps
ALTER TABLE opportunities ALTER COLUMN account_id DROP NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 8. RATE_CARDS — add isTemplate, sellRate (alongside existing billing_rate), currency
-- Existing rate_cards rows function as rate_card_roles (one row per role).
-- is_template=true + project_id=null = global template card row
-- ────────────────────────────────────────────────────────────
ALTER TABLE rate_cards
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS sell_rate   NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS currency    TEXT         DEFAULT 'CAD';

-- Back-fill sell_rate from billing_rate for existing rows
UPDATE rate_cards SET sell_rate = billing_rate WHERE sell_rate IS NULL;

-- ────────────────────────────────────────────────────────────
-- 9. INVOICES — add structured line items, totals, type
-- ────────────────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS line_items    JSONB         DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS subtotal      NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax           NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total         NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency      TEXT          DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS invoice_type  TEXT          DEFAULT 'time_and_materials';

-- Back-fill total from existing amount field
UPDATE invoices SET subtotal = amount, total = amount WHERE total = 0 AND amount > 0;

-- ────────────────────────────────────────────────────────────
-- 10. STAFFING_REQUESTS — add practice_area (already has most fields)
-- Note: fulfilled_by_resource_id = assignedResourceId, opportunity_id already exists
-- ────────────────────────────────────────────────────────────
ALTER TABLE staffing_requests
  ADD COLUMN IF NOT EXISTS practice_area TEXT;

-- ────────────────────────────────────────────────────────────
-- 11. NEW TABLE: prospects
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospects (
  id                       SERIAL PRIMARY KEY,
  name                     TEXT    NOT NULL,
  type                     TEXT    DEFAULT 'enterprise',
  industry                 TEXT,
  segment                  TEXT,
  status                   TEXT    NOT NULL DEFAULT 'active',
  primary_contact_name     TEXT,
  primary_contact_email    TEXT,
  linkedin_url             TEXT,
  sentiment                TEXT,
  touch_points             JSONB   DEFAULT '[]',
  owner_id                 INT,
  notes                    TEXT,
  converted_to_account_id  INT,
  converted_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 12. NEW TABLE: task_comments
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_comments (
  id                  SERIAL PRIMARY KEY,
  task_id             INT     NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id           INT     NOT NULL REFERENCES resources(id) ON DELETE SET NULL,
  body                TEXT    NOT NULL,
  mentioned_user_ids  INT[]   DEFAULT '{}',
  is_external         BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 13. NEW TABLE: saved_filters
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_filters (
  id              SERIAL PRIMARY KEY,
  name            TEXT    NOT NULL,
  owner_id        INT     NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  is_shared       BOOLEAN DEFAULT false,
  filter_context  TEXT    NOT NULL,
  filter_json     JSONB   NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 14. INDEXES — performance
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id     ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author_id   ON task_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_owner_id    ON saved_filters(owner_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_context     ON saved_filters(filter_context);
CREATE INDEX IF NOT EXISTS idx_prospects_status          ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_owner_id        ON prospects(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id           ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_leaf             ON tasks(is_leaf);
CREATE INDEX IF NOT EXISTS idx_tasks_hierarchy_level     ON tasks(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_opportunities_prospect_id ON opportunities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_milestones_type           ON milestones(milestone_type);
CREATE INDEX IF NOT EXISTS idx_timesheets_is_collaboration ON timesheets(is_collaboration);

-- ────────────────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────────────────
