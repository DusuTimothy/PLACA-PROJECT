'use strict';

/**
 * Initial schema for the PLACA platform.
 *
 * Why one migration instead of 24?
 * The tables are created together so foreign keys, check constraints and
 * indexes can be reviewed in one place. Later changes must be new migrations;
 * this file is never edited after it has run in an environment.
 *
 * Debugging tip: every constraint is named. PostgreSQL error messages and the
 * audit trail then point at the exact rule that failed.
 */

const { Sequelize } = require('sequelize');

const UUID = Sequelize.UUID;
const UUID_DEFAULT = Sequelize.literal('gen_random_uuid()');

const timestamps = () => ({
  created_at: {
    type: Sequelize.DATE, 
    allowNull: false, 
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
  },
  updated_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
  },
});

const idColumn = () => ({
  id: { type: UUID, allowNull: false, primaryKey: true, defaultValue: UUID_DEFAULT },
});

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    // pgcrypto supplies gen_random_uuid() on older PostgreSQL and the
    // pgp_sym_encrypt/decrypt functions used for the narrow TOTP secret column.
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    // ---------- Reference data ----------
    await queryInterface.createTable('lgas', {
      ...idColumn(),
      name: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      ...timestamps(),
    });

    // ---------- Users ----------
    // organization_id is added as a foreign key after organizations exists.
    await queryInterface.createTable('users', {
      ...idColumn(),
      name: { type: Sequelize.STRING(160), allowNull: false },
      email: { type: Sequelize.STRING(190), allowNull: true },
      phone: { type: Sequelize.STRING(30), allowNull: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role: { type: Sequelize.STRING(30), allowNull: false },
      lga_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'lgas', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      organization_id: { type: UUID, allowNull: true },
      language: { type: Sequelize.STRING(2), allowNull: false, defaultValue: 'en' },
      must_change_password: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      // Encrypted with pgcrypto by the TOTP service; never selected by default.
      totp_secret: { type: Sequelize.BLOB, allowNull: true },
      totp_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      failed_attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      locked_until: { type: Sequelize.DATE, allowNull: true },
      last_login_at: { type: Sequelize.DATE, allowNull: true },
      invitation_token_hash: { type: Sequelize.STRING(64), allowNull: true },
      invitation_expires_at: { type: Sequelize.DATE, allowNull: true },
      email_verification_token_hash: { type: Sequelize.STRING(64), allowNull: true },
      email_verification_expires_at: { type: Sequelize.DATE, allowNull: true },
      password_reset_token_hash: { type: Sequelize.STRING(64), allowNull: true },
      password_reset_expires_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(),
    });

    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique',
    });
    await queryInterface.addIndex('users', ['phone'], { name: 'users_phone_idx' });
    await queryInterface.addIndex('users', ['role'], { name: 'users_role_idx' });
    await queryInterface.addIndex('users', ['organization_id'], {
      name: 'users_organization_idx',
    });
    await sequelize.query(`
      ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN
        ('partner_staff','laca_officer','placa_officer','placa_director','admin')),
      ADD CONSTRAINT users_language_check CHECK (language IN ('en','ha')),
      ADD CONSTRAINT users_failed_attempts_check CHECK (failed_attempts >= 0);
    `);

    // ---------- Organizations ----------
    await queryInterface.createTable('organizations', {
      ...idColumn(),
      name: { type: Sequelize.STRING(200), allowNull: false, unique: true },
      type: { type: Sequelize.STRING(30), allowNull: false },
      lga_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'lgas', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      focus_areas: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: [],
      },
      contact_name: { type: Sequelize.STRING(160), allowNull: true },
      contact_phone: { type: Sequelize.STRING(30), allowNull: true },
      contact_email: { type: Sequelize.STRING(190), allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pending' },
      approved_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(),
    });

    await queryInterface.addConstraint('users', {
      fields: ['organization_id'],
      type: 'foreign key',
      name: 'users_organization_fk',
      references: { table: 'organizations', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addIndex('organizations', ['lga_id'], {
      name: 'organizations_lga_idx',
    });
    await queryInterface.addIndex('organizations', ['status'], {
      name: 'organizations_status_idx',
    });
    await sequelize.query(`
      ALTER TABLE organizations
      ADD CONSTRAINT organizations_type_check CHECK (type IN
        ('ngo','cbo','faith_based','private_sector','government_mda','laca')),
      ADD CONSTRAINT organizations_status_check CHECK (status IN
        ('pending','approved','suspended'));
    `);

    // ---------- Indicators ----------
    await queryInterface.createTable('indicators', {
      ...idColumn(),
      code: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      plain_language_definition: { type: Sequelize.TEXT, allowNull: false },
      category: { type: Sequelize.STRING(20), allowNull: false },
      unit: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'people' },
      disaggregations: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      validation_rules: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ...timestamps(),
    });
    await sequelize.query(`
      ALTER TABLE indicators
      ADD CONSTRAINT indicators_category_check CHECK (category IN
        ('reach','testing','referral','welfare','training'));
    `);

    // ---------- Workplans ----------
    await queryInterface.createTable('workplans', {
      ...idColumn(),
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      year: { type: Sequelize.INTEGER, allowNull: false },
      quarter: { type: Sequelize.INTEGER, allowNull: false },
      created_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      ...timestamps(),
    });
    await queryInterface.addIndex('workplans', ['organization_id', 'year', 'quarter'], {
      unique: true,
      name: 'workplans_org_period_unique',
    });
    await sequelize.query(`
      ALTER TABLE workplans
      ADD CONSTRAINT workplans_year_check CHECK (year BETWEEN 2000 AND 2100),
      ADD CONSTRAINT workplans_quarter_check CHECK (quarter BETWEEN 1 AND 4);
    `);

    await queryInterface.createTable('workplan_targets', {
      ...idColumn(),
      workplan_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'workplans', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      indicator_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'indicators', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      lga_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'lgas', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      target_value: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps(),
    });
    await queryInterface.addIndex('workplan_targets', ['workplan_id', 'indicator_id', 'lga_id'], {
      unique: true,
      name: 'workplan_targets_unique',
    });
    await sequelize.query(`
      ALTER TABLE workplan_targets
      ADD CONSTRAINT workplan_targets_value_check CHECK (target_value >= 0);
    `);

    // ---------- Welfare programmes (reports can link to one) ----------
    await queryInterface.createTable('welfare_programmes', {
      ...idColumn(),
      kind: { type: Sequelize.STRING(30), allowNull: false },
      name: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      lga_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'lgas', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      organization_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      start_date: { type: Sequelize.DATEONLY, allowNull: true },
      end_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'planned' },
      created_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      ...timestamps(),
    });
    await sequelize.query(`
      ALTER TABLE welfare_programmes
      ADD CONSTRAINT welfare_programmes_kind_check CHECK (kind IN
        ('skills_training','orphan_support','stigma_support','testing_campaign')),
      ADD CONSTRAINT welfare_programmes_status_check CHECK (status IN
        ('planned','active','completed','cancelled')),
      ADD CONSTRAINT welfare_programmes_dates_check CHECK
        (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
    `);

    // ---------- Reports and values ----------
    await queryInterface.createTable('reports', {
      ...idColumn(),
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      lga_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'lgas', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      programme_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'welfare_programmes', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      period_type: { type: Sequelize.STRING(20), allowNull: false },
      period_year: { type: Sequelize.INTEGER, allowNull: false },
      period_number: { type: Sequelize.INTEGER, allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
      // Generated on the device before the first send; makes sync idempotent.
      client_uuid: { type: UUID, allowNull: false, unique: true },
      submitted_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      submitted_at: { type: Sequelize.DATE, allowNull: true },
      validated_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      validated_at: { type: Sequelize.DATE, allowNull: true },
      return_reason: { type: Sequelize.TEXT, allowNull: true },
      flags: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      ...timestamps(),
    });
    await queryInterface.addIndex('reports', ['organization_id', 'period_year', 'period_number'], {
      name: 'reports_org_period_idx',
    });
    await queryInterface.addIndex('reports', ['lga_id', 'status'], {
      name: 'reports_lga_status_idx',
    });
    await sequelize.query(`
      ALTER TABLE reports
      ADD CONSTRAINT reports_status_check CHECK (status IN
        ('draft','submitted','validated','returned','aggregated')),
      ADD CONSTRAINT reports_period_type_check CHECK (period_type IN
        ('monthly','quarterly','annual')),
      ADD CONSTRAINT reports_period_number_check CHECK (period_number BETWEEN 1 AND 12),
      ADD CONSTRAINT reports_period_year_check CHECK (period_year BETWEEN 2000 AND 2100);
    `);

    await queryInterface.createTable('report_values', {
      ...idColumn(),
      report_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'reports', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      indicator_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'indicators', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      disaggregation_key: { type: Sequelize.STRING(120), allowNull: false, defaultValue: 'total' },
      value: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps(),
    });
    await queryInterface.addIndex(
      'report_values',
      ['report_id', 'indicator_id', 'disaggregation_key'],
      { unique: true, name: 'report_values_unique' }
    );
    await sequelize.query(`
      ALTER TABLE report_values
      ADD CONSTRAINT report_values_value_check CHECK (value >= 0);
    `);

    // ---------- Support requests and supplies ----------
    await queryInterface.createTable('support_requests', {
      ...idColumn(),
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      kind: { type: Sequelize.STRING(20), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'requested' },
      requested_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      decided_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      decided_at: { type: Sequelize.DATE, allowNull: true },
      decision_note: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps(),
    });
    await queryInterface.addIndex('support_requests', ['organization_id', 'status'], {
      name: 'support_requests_org_status_idx',
    });
    await sequelize.query(`
      ALTER TABLE support_requests
      ADD CONSTRAINT support_requests_kind_check CHECK (kind IN
        ('equipment','training','technical')),
      ADD CONSTRAINT support_requests_status_check CHECK (status IN
        ('requested','approved','rejected','in_transit','delivered','closed'));
    `);

    await queryInterface.createTable('equipment_items', {
      ...idColumn(),
      name: { type: Sequelize.STRING(160), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      unit: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'unit' },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(),
    });

    await queryInterface.createTable('support_request_items', {
      ...idColumn(),
      support_request_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'support_requests', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      equipment_item_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'equipment_items', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      qty_requested: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      qty_approved: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps(),
    });
    await queryInterface.addIndex(
      'support_request_items',
      ['support_request_id', 'equipment_item_id'],
      { unique: true, name: 'support_request_items_unique' }
    );
    await sequelize.query(`
      ALTER TABLE support_request_items
      ADD CONSTRAINT support_request_items_qty_check CHECK
        (qty_requested >= 0 AND qty_approved >= 0);
    `);

    await queryInterface.createTable('supply_records', {
      ...idColumn(),
      support_request_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'support_requests', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      support_request_item_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'support_request_items', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      equipment_item_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'equipment_items', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      qty_delivered: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      delivered_at: { type: Sequelize.DATE, allowNull: true },
      delivered_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      received_confirmed_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      received_at: { type: Sequelize.DATE, allowNull: true },
      note: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps(),
    });
    await sequelize.query(`
      ALTER TABLE supply_records
      ADD CONSTRAINT supply_records_qty_check CHECK (qty_delivered >= 0);
    `);

    await queryInterface.createTable('stock_levels', {
      ...idColumn(),
      equipment_item_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'equipment_items', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      lga_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'lgas', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      updated_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      ...timestamps(),
    });
    // COALESCE in an expression index makes the state store (NULL lga_id) unique too.
    await sequelize.query(`
      CREATE UNIQUE INDEX stock_levels_item_lga_unique
      ON stock_levels (equipment_item_id, COALESCE(lga_id, '00000000-0000-0000-0000-000000000000'::uuid));
    `);
    await sequelize.query(`
      ALTER TABLE stock_levels
      ADD CONSTRAINT stock_levels_quantity_check CHECK (quantity >= 0);
    `);

    // ---------- Funding ----------
    await queryInterface.createTable('funding_sources', {
      ...idColumn(),
      name: { type: Sequelize.STRING(160), allowNull: false, unique: true },
      type: { type: Sequelize.STRING(20), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(),
    });
    await sequelize.query(`
      ALTER TABLE funding_sources
      ADD CONSTRAINT funding_sources_type_check CHECK (type IN
        ('government','donor','private','other'));
    `);

    await queryInterface.createTable('funding_inflows', {
      ...idColumn(),
      funding_source_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'funding_sources', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'NGN' },
      received_on: { type: Sequelize.DATEONLY, allowNull: false },
      purpose: { type: Sequelize.TEXT, allowNull: true },
      reference: { type: Sequelize.STRING(120), allowNull: true },
      recorded_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      ...timestamps(),
    });
    await sequelize.query(`
      ALTER TABLE funding_inflows
      ADD CONSTRAINT funding_inflows_amount_check CHECK (amount >= 0);
    `);

    await queryInterface.createTable('funding_allocations', {
      ...idColumn(),
      funding_source_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'funding_sources', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      funding_inflow_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'funding_inflows', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      recipient_organization_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      lga_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'lgas', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'NGN' },
      period: { type: Sequelize.STRING(20), allowNull: false },
      purpose: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'planned' },
      approved_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      disbursed_on: { type: Sequelize.DATEONLY, allowNull: true },
      ...timestamps(),
    });
    await queryInterface.addIndex('funding_allocations', ['lga_id', 'period'], {
      name: 'funding_allocations_lga_period_idx',
    });
    await sequelize.query(`
      ALTER TABLE funding_allocations
      ADD CONSTRAINT funding_allocations_amount_check CHECK (amount >= 0),
      ADD CONSTRAINT funding_allocations_status_check CHECK (status IN
        ('planned','disbursed','closed')),
      ADD CONSTRAINT funding_allocations_recipient_check CHECK
        (recipient_organization_id IS NOT NULL OR lga_id IS NOT NULL);
    `);

    // ---------- Documents and guides ----------
    await queryInterface.createTable('documents', {
      ...idColumn(),
      title: { type: Sequelize.STRING(200), allowNull: false },
      category: { type: Sequelize.STRING(30), allowNull: false },
      language: { type: Sequelize.STRING(2), allowNull: false, defaultValue: 'en' },
      file_key: { type: Sequelize.STRING(400), allowNull: false },
      original_name: { type: Sequelize.STRING(255), allowNull: true },
      mime_type: { type: Sequelize.STRING(120), allowNull: true },
      size_bytes: { type: Sequelize.BIGINT, allowNull: true },
      uploaded_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      is_public: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps(),
    });
    await sequelize.query(`
      ALTER TABLE documents
      ADD CONSTRAINT documents_category_check CHECK (category IN
        ('guideline','training_material','workplan','policy')),
      ADD CONSTRAINT documents_language_check CHECK (language IN ('en','ha'));
    `);

    await queryInterface.createTable('guides', {
      ...idColumn(),
      key: { type: Sequelize.STRING(80), allowNull: false },
      language: { type: Sequelize.STRING(2), allowNull: false, defaultValue: 'en' },
      title: { type: Sequelize.STRING(200), allowNull: false },
      body_md: { type: Sequelize.TEXT, allowNull: false },
      audience_roles: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: [],
      },
      page_key: { type: Sequelize.STRING(80), allowNull: true },
      field_key: { type: Sequelize.STRING(80), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_published: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updated_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      ...timestamps(),
    });
    await queryInterface.addIndex('guides', ['key', 'language'], {
      unique: true,
      name: 'guides_key_language_unique',
    });
    await queryInterface.addIndex('guides', ['page_key', 'language'], {
      name: 'guides_page_language_idx',
    });
    await sequelize.query(`
      ALTER TABLE guides
      ADD CONSTRAINT guides_language_check CHECK (language IN ('en','ha'));
    `);

    await queryInterface.createTable('user_guide_progress', {
      ...idColumn(),
      user_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      guide_key: { type: Sequelize.STRING(80), allowNull: false },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      dismissed_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(),
    });
    await queryInterface.addIndex('user_guide_progress', ['user_id', 'guide_key'], {
      unique: true,
      name: 'user_guide_progress_unique',
    });

    await queryInterface.createTable('notifications', {
      ...idColumn(),
      user_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      kind: { type: Sequelize.STRING(40), allowNull: false },
      title: { type: Sequelize.STRING(200), allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: false },
      link: { type: Sequelize.STRING(400), allowNull: true },
      read_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(),
    });
    await queryInterface.addIndex('notifications', ['user_id', 'read_at'], {
      name: 'notifications_user_read_idx',
    });

    // ---------- Public summary ----------
    await queryInterface.createTable('public_summary', {
      ...idColumn(),
      scope: { type: Sequelize.STRING(10), allowNull: false },
      lga_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'lgas', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      indicator_code: { type: Sequelize.STRING(40), allowNull: false },
      period: { type: Sequelize.STRING(20), allowNull: false },
      value: { type: Sequelize.INTEGER, allowNull: false },
      generated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      ...timestamps(),
    });
    await queryInterface.addIndex('public_summary', ['scope', 'period'], {
      name: 'public_summary_scope_period_idx',
    });
    await queryInterface.addIndex('public_summary', ['lga_id', 'period'], {
      name: 'public_summary_lga_period_idx',
    });
    await sequelize.query(`
      ALTER TABLE public_summary
      ADD CONSTRAINT public_summary_scope_check CHECK (scope IN ('state','lga')),
      ADD CONSTRAINT public_summary_value_check CHECK (value >= 0);
    `);

    // ---------- Audit and sessions ----------
    await queryInterface.createTable('audit_logs', {
      ...idColumn(),
      user_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      user_role: { type: Sequelize.STRING(30), allowNull: true },
      action: { type: Sequelize.STRING(40), allowNull: false },
      entity: { type: Sequelize.STRING(60), allowNull: false },
      entity_id: { type: Sequelize.STRING(64), allowNull: true },
      old_value: { type: Sequelize.JSONB, allowNull: true },
      new_value: { type: Sequelize.JSONB, allowNull: true },
      ip: { type: Sequelize.STRING(64), allowNull: true },
      user_agent: { type: Sequelize.TEXT, allowNull: true },
      request_id: { type: Sequelize.STRING(64), allowNull: true },
      ...timestamps(),
    });
    await queryInterface.addIndex('audit_logs', ['entity', 'entity_id'], {
      name: 'audit_logs_entity_idx',
    });
    await queryInterface.addIndex('audit_logs', ['user_id'], {
      name: 'audit_logs_user_idx',
    });
    await queryInterface.addIndex('audit_logs', ['created_at'], {
      name: 'audit_logs_created_idx',
    });

    await queryInterface.createTable('refresh_tokens', {
      ...idColumn(),
      user_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      family_id: { type: UUID, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      replaced_by_token_hash: { type: Sequelize.STRING(64), allowNull: true },
      created_by_ip: { type: Sequelize.STRING(64), allowNull: true },
      user_agent: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps(),
    });
    await queryInterface.addIndex('refresh_tokens', ['user_id', 'family_id'], {
      name: 'refresh_tokens_user_family_idx',
    });
  },

  async down(queryInterface) {
    // users and organizations reference each other. Remove the users-side
    // constraint first, then organizations can be dropped before users.
    await queryInterface.removeConstraint('users', 'users_organization_fk').catch(() => {});

    // Reverse dependency order. The audit table is dropped last because its
    // trigger references only itself.
    const tables = [
      'refresh_tokens',
      'audit_logs',
      'public_summary',
      'notifications',
      'user_guide_progress',
      'guides',
      'documents',
      'funding_allocations',
      'funding_inflows',
      'funding_sources',
      'stock_levels',
      'supply_records',
      'support_request_items',
      'equipment_items',
      'support_requests',
      'report_values',
      'reports',
      'welfare_programmes',
      'workplan_targets',
      'workplans',
      'indicators',
      'organizations',
      'users',
      'lgas',
    ];
    for (const table of tables) {
      await queryInterface.dropTable(table);
    }
  },
};
