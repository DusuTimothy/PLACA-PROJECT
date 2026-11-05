'use strict';

/**
 * Platform user.
 *
 * Secret columns (password_hash, TOTP secret, token hashes) are excluded from
 * the default scope. Auth code that needs them must call User.unscoped()
 * explicitly, which makes the sensitive read easy to spot during review.
 */
const { Model } = require('sequelize');
const { ROLES } = require('../middleware/rbac');

const SECRET_ATTRIBUTES = [
  'password_hash',
  'totp_secret',
  'invitation_token_hash',
  'email_verification_token_hash',
  'password_reset_token_hash',
];

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.Lga, { foreignKey: 'lga_id', as: 'lga' });
      User.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
      User.hasMany(models.RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
      User.hasMany(models.Notification, { foreignKey: 'user_id', as: 'notifications' });
      User.hasMany(models.UserGuideProgress, { foreignKey: 'user_id', as: 'guideProgress' });
      User.hasMany(models.AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
      User.hasMany(models.Organization, { foreignKey: 'approved_by', as: 'approvedOrganizations' });
      User.hasMany(models.Report, { foreignKey: 'submitted_by', as: 'submittedReports' });
      User.hasMany(models.Report, { foreignKey: 'validated_by', as: 'validatedReports' });
      User.hasMany(models.SupportRequest, { foreignKey: 'requested_by', as: 'supportRequests' });
      User.hasMany(models.SupportRequest, { foreignKey: 'decided_by', as: 'decidedSupportRequests' });
      User.hasMany(models.FundingInflow, { foreignKey: 'recorded_by', as: 'recordedInflows' });
      User.hasMany(models.FundingAllocation, { foreignKey: 'approved_by', as: 'approvedAllocations' });
      User.hasMany(models.WelfareProgramme, { foreignKey: 'created_by', as: 'createdProgrammes' });
      User.hasMany(models.Document, { foreignKey: 'uploaded_by', as: 'uploadedDocuments' });
      User.hasMany(models.Guide, { foreignKey: 'updated_by', as: 'updatedGuides' });
    }

    toJSON() {
      const values = { ...this.get() };
      for (const key of SECRET_ATTRIBUTES) delete values[key];
      return values;
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(160), allowNull: false },
      email: {
        type: DataTypes.STRING(190),
        allowNull: true,
        unique: true,
        set(value) {
          this.setDataValue('email', value ? String(value).trim().toLowerCase() : null);
        },
      },
      phone: { type: DataTypes.STRING(30), allowNull: true },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      role: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: { isIn: [Object.values(ROLES)] },
      },
      lga_id: { type: DataTypes.UUID, allowNull: true },
      organization_id: { type: DataTypes.UUID, allowNull: true },
      language: {
        type: DataTypes.STRING(2),
        allowNull: false,
        defaultValue: 'en',
        validate: { isIn: [['en', 'ha']] },
      },
      must_change_password: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      totp_secret: { type: DataTypes.BLOB, allowNull: true },
      // Separate from the secret: a generated but unconfirmed secret must not
      // lock the user out of login. Only enable after a valid code is entered.
      totp_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      failed_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      locked_until: { type: DataTypes.DATE, allowNull: true },
      last_login_at: { type: DataTypes.DATE, allowNull: true },
      invitation_token_hash: { type: DataTypes.STRING(64), allowNull: true },
      invitation_expires_at: { type: DataTypes.DATE, allowNull: true },
      email_verification_token_hash: { type: DataTypes.STRING(64), allowNull: true },
      email_verification_expires_at: { type: DataTypes.DATE, allowNull: true },
      password_reset_token_hash: { type: DataTypes.STRING(64), allowNull: true },
      password_reset_expires_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      defaultScope: {
        attributes: { exclude: SECRET_ATTRIBUTES },
      },
    }
  );

  User.SECRET_ATTRIBUTES = SECRET_ATTRIBUTES;
  return User;
};
