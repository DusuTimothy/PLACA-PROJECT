'use strict';

/**
 * Authentication workflow.
 *
 * Keeping the workflow here (not in the controller) makes it testable and keeps
 * the HTTP layer small. All multi-row writes use a transaction.
 */

const { Op } = require('sequelize');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const {
  User,
  Lga,
  Organization,
  RefreshToken,
  sequelize,
} = require('../models');
const env = require('../config/env');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const { hashPassword, verifyPassword } = require('../utils/password');
const {
  signAccessToken,
  signTotpSetupToken,
  verifyTotpSetupToken,
  generateOpaqueToken,
  hashToken,
} = require('../utils/tokens');
const { normalizePhone } = require('../utils/phone');
const totpService = require('./totpService');
const { recordAudit } = require('./auditService');
const emailService = require('./emailService');

const TFA_ROLES = new Set(['placa_director', 'admin']);

// Used only to equalise timing when an account does not exist. It is a hash of
// a value nobody can use to sign in.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const userInclude = [
  { model: Lga, as: 'lga', attributes: ['id', 'name', 'code'] },
  {
    model: Organization,
    as: 'organization',
    attributes: ['id', 'name', 'lga_id', 'status', 'type'],
  },
];

function publicUser(user) {
  // Build an explicit response shape. This is safer than returning the model:
  // lock counters and token expiry columns are not useful to the client and
  // should not be exposed between staff accounts.
  const plain = user.toJSON();
  return {
    id: plain.id,
    name: plain.name,
    email: plain.email || null,
    phone: plain.phone || null,
    role: plain.role,
    lga_id: plain.lga_id || null,
    organization_id: plain.organization_id || null,
    language: plain.language,
    must_change_password: Boolean(plain.must_change_password),
    verified: Boolean(plain.verified),
    is_active: Boolean(plain.is_active),
    totp_enabled: Boolean(plain.totp_enabled),
    last_login_at: plain.last_login_at || null,
    created_at: plain.createdAt,
    updated_at: plain.updatedAt,
    lga: plain.lga || null,
    organization: plain.organization || null,
  };
}

async function loadPublicUser(userId) {
  return User.findByPk(userId, { include: userInclude });
}

async function findUserByIdentifier(identifier) {
  const isEmail = identifier.includes('@');
  const phone = isEmail ? null : normalizePhone(identifier);
  if (!isEmail && !phone) return null;

  return User.unscoped().findOne({
    where: isEmail ? { email: identifier.trim().toLowerCase() } : { phone },
    include: userInclude,
  });
}

function refreshExpiryDate() {
  return new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function createSession(user, meta, transaction) {
  const { token, hash } = generateOpaqueToken();
  const expiresAt = refreshExpiryDate();

  await RefreshToken.create(
    {
      user_id: user.id,
      token_hash: hash,
      family_id: randomUUID(),
      expires_at: expiresAt,
      created_by_ip: meta.ip || null,
      user_agent: meta.userAgent || null,
    },
    { transaction }
  );

  return {
    accessToken: signAccessToken(user),
    refreshToken: token,
    refreshExpiresAt: expiresAt,
    user: publicUser(user),
  };
}

async function bumpFailedLogin(user) {
  const nextAttempts = user.failed_attempts + 1;
  const locked = nextAttempts >= env.LOGIN_MAX_ATTEMPTS;

  user.failed_attempts = locked ? 0 : nextAttempts;
  user.locked_until = locked
    ? new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60 * 1000)
    : user.locked_until;

  await user.save();

  await recordAudit({
    action: 'login_failed',
    entity: 'User',
    entityId: user.id,
    userId: user.id,
    userRole: user.role,
    newValue: { attempts: nextAttempts, locked },
  });

  if (locked) {
    throw new AppError(
      423,
      'ACCOUNT_LOCKED',
      `Too many wrong passwords. This account is locked for ${env.LOGIN_LOCK_MINUTES} minutes.`
    );
  }

  throw AppError.unauthorized('INVALID_CREDENTIALS', 'The email/phone or password is not correct');
}

async function login({ identifier, password, totp_code: totpCode }, meta) {
  const user = await findUserByIdentifier(identifier);

  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    await recordAudit({
      action: 'login_failed',
      entity: 'User',
      entityId: null,
      newValue: { reason: 'unknown_identifier' },
    });
    throw AppError.unauthorized('INVALID_CREDENTIALS', 'The email/phone or password is not correct');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
    throw new AppError(
      423,
      'ACCOUNT_LOCKED',
      `This account is locked. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
    );
  }

  if (!user.is_active) {
    await verifyPassword(password, user.password_hash);
    await recordAudit({
      action: 'login_failed',
      entity: 'User',
      entityId: user.id,
      userId: user.id,
      userRole: user.role,
      newValue: { reason: 'inactive' },
    });
    throw AppError.unauthorized('ACCOUNT_UNAVAILABLE', 'This account is not active');
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    await bumpFailedLogin(user);
  }

  // Second factor is mandatory for director and admin.
  if (TFA_ROLES.has(user.role)) {
    if (!user.totp_enabled) {
      const setupToken = signTotpSetupToken(user);
      await recordAudit({
        action: 'totp_setup_required',
        entity: 'User',
        entityId: user.id,
        userId: user.id,
        userRole: user.role,
      });
      return {
        totpSetupRequired: true,
        setupToken,
        user: publicUser(user),
      };
    }

    if (!totpCode) {
      throw new AppError(
        401,
        'TOTP_REQUIRED',
        'Enter the 6-digit code from your authenticator app.'
      );
    }

    const secret = await totpService.readSecret(user.id);
    if (!secret || !totpService.verifyCode(secret, totpCode)) {
      await bumpFailedLogin(user);
    }
  }

  user.failed_attempts = 0;
  user.locked_until = null;
  user.last_login_at = new Date();
  await user.save();

  await recordAudit({
    action: 'login',
    entity: 'User',
    entityId: user.id,
    userId: user.id,
    userRole: user.role,
  });

  return createSession(user, meta);
}

/**
 * Rotating refresh.
 *
 * A reused token means the chain may have been stolen. We revoke the whole
 * family and commit that revocation before returning 401, which is why the
 * transaction returns an outcome object instead of throwing inside the callback.
 */
async function rotateRefreshToken(rawToken, meta) {
  if (!rawToken) {
    throw AppError.unauthorized('REFRESH_REQUIRED', 'Your session has ended. Please sign in again.');
  }

  const tokenHash = hashToken(rawToken);

  const outcome = await sequelize.transaction(async (transaction) => {
    const record = await RefreshToken.findOne({
      where: { token_hash: tokenHash },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!record) {
      return { type: 'invalid' };
    }

    if (record.revoked_at) {
      await RefreshToken.update(
        { revoked_at: new Date() },
        { where: { family_id: record.family_id, revoked_at: null }, transaction }
      );
      return { type: 'reused' };
    }

    if (new Date(record.expires_at) <= new Date()) {
      await record.update({ revoked_at: new Date() }, { transaction });
      return { type: 'expired' };
    }

    const user = await User.findByPk(record.user_id, {
      include: userInclude,
      transaction,
    });

    if (!user || !user.is_active) {
      await record.update({ revoked_at: new Date() }, { transaction });
      return { type: 'unavailable' };
    }

    const next = generateOpaqueToken();
    const expiresAt = refreshExpiryDate();

    await record.update(
      {
        revoked_at: new Date(),
        replaced_by_token_hash: next.hash,
      },
      { transaction }
    );

    await RefreshToken.create(
      {
        user_id: user.id,
        token_hash: next.hash,
        family_id: record.family_id,
        expires_at: expiresAt,
        created_by_ip: meta.ip || null,
        user_agent: meta.userAgent || null,
      },
      { transaction }
    );

    return {
      type: 'ok',
      session: {
        accessToken: signAccessToken(user),
        refreshToken: next.token,
        refreshExpiresAt: expiresAt,
        user: publicUser(user),
      },
    };
  });

  if (outcome.type === 'reused') {
    logger.warn('Refresh token reuse detected; token family revoked');
    throw AppError.unauthorized('SESSION_REUSED', 'For your safety, please sign in again.');
  }
  if (outcome.type === 'invalid') {
    throw AppError.unauthorized('REFRESH_INVALID', 'Your session has ended. Please sign in again.');
  }
  if (outcome.type === 'expired') {
    throw AppError.unauthorized('REFRESH_EXPIRED', 'Your session has expired. Please sign in again.');
  }
  if (outcome.type === 'unavailable') {
    throw AppError.unauthorized('ACCOUNT_UNAVAILABLE', 'This account is not active');
  }

  return outcome.session;
}

async function logout(rawToken) {
  if (!rawToken) return { done: true };
  const tokenHash = hashToken(rawToken);

  return sequelize.transaction(async (transaction) => {
    const record = await RefreshToken.findOne({
      where: { token_hash: tokenHash },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (record) {
      await RefreshToken.update(
        { revoked_at: new Date() },
        { where: { family_id: record.family_id, revoked_at: null }, transaction }
      );
      await recordAudit({
        action: 'logout',
        entity: 'User',
        entityId: record.user_id,
        userId: record.user_id,
        options: { transaction },
      });
    }

    return { done: true };
  });
}

async function acceptInvitation({ token, password, name, phone, language }, meta) {
  const tokenHash = hashToken(token);
  const user = await User.unscoped().findOne({
    where: {
      invitation_token_hash: tokenHash,
      invitation_expires_at: { [Op.gt]: new Date() },
    },
    include: userInclude,
  });

  if (!user) {
    throw AppError.badRequest(
      'INVITATION_INVALID',
      'This invitation link has expired or has already been used. Ask your LACA officer for a new one.'
    );
  }

  const passwordHash = await hashPassword(password);

  await sequelize.transaction(async (transaction) => {
    user.password_hash = passwordHash;
    user.must_change_password = false;
    user.verified = true;
    user.invitation_token_hash = null;
    user.invitation_expires_at = null;
    if (name) user.name = name;
    if (phone !== undefined && phone !== null) user.phone = phone;
    if (language) user.language = language;

    await user.save({ transaction });

    // Any previous sessions for this account are invalidated.
    await RefreshToken.update(
      { revoked_at: new Date() },
      { where: { user_id: user.id, revoked_at: null }, transaction }
    );
  });

  await recordAudit({
    action: 'accept_invitation',
    entity: 'User',
    entityId: user.id,
    userId: user.id,
    userRole: user.role,
  });

  return createSession(user, meta);
}

async function verifyEmail(token) {
  const user = await User.unscoped().findOne({
    where: {
      email_verification_token_hash: hashToken(token),
      email_verification_expires_at: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    throw AppError.badRequest(
      'VERIFICATION_INVALID',
      'This confirmation link has expired. Sign in and ask for a new one.'
    );
  }

  user.verified = true;
  user.email_verification_token_hash = null;
  user.email_verification_expires_at = null;
  await user.save();

  await recordAudit({
    action: 'verify_email',
    entity: 'User',
    entityId: user.id,
    userId: user.id,
    userRole: user.role,
  });

  return { message: 'Your email address is confirmed.' };
}

async function forgotPassword({ identifier }) {
  const user = await findUserByIdentifier(identifier);

  // The response is identical whether or not the account exists. This avoids
  // revealing which phone numbers or emails are registered.
  if (user && user.is_active && user.email) {
    const { token, hash } = generateOpaqueToken();
    user.password_reset_token_hash = hash;
    user.password_reset_expires_at = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = env.clientAppUrl(`/reset-password?token=${encodeURIComponent(token)}`);
    await emailService.sendPasswordReset({ to: user.email, name: user.name, resetUrl });

    await recordAudit({
      action: 'password_reset_requested',
      entity: 'User',
      entityId: user.id,
      userId: user.id,
      userRole: user.role,
    });
  }

  return {
    message:
      'If that account exists and has an email address, a reset link has been sent. The link expires in 1 hour.',
  };
}

async function resetPassword({ token, password }) {
  const user = await User.unscoped().findOne({
    where: {
      password_reset_token_hash: hashToken(token),
      password_reset_expires_at: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    throw AppError.badRequest(
      'RESET_INVALID',
      'This reset link has expired or has already been used. Ask for a new one.'
    );
  }

  const passwordHash = await hashPassword(password);

  await sequelize.transaction(async (transaction) => {
    user.password_hash = passwordHash;
    user.must_change_password = false;
    user.password_reset_token_hash = null;
    user.password_reset_expires_at = null;
    user.failed_attempts = 0;
    user.locked_until = null;
    await user.save({ transaction });

    await RefreshToken.update(
      { revoked_at: new Date() },
      { where: { user_id: user.id, revoked_at: null }, transaction }
    );
  });

  await recordAudit({
    action: 'password_reset',
    entity: 'User',
    entityId: user.id,
    userId: user.id,
    userRole: user.role,
  });

  return { message: 'Your password has been changed. You can now sign in.' };
}

async function changePassword({ userId, currentPassword, newPassword }, meta) {
  const user = await User.unscoped().findByPk(userId);
  if (!user || !user.is_active) {
    throw AppError.unauthorized('ACCOUNT_UNAVAILABLE', 'This account is not active');
  }

  const currentOk = await verifyPassword(currentPassword, user.password_hash);
  if (!currentOk) {
    await recordAudit({
      action: 'change_password_failed',
      entity: 'User',
      entityId: user.id,
      userId: user.id,
      userRole: user.role,
    });
    throw AppError.badRequest('CURRENT_PASSWORD_INCORRECT', 'Your current password is not correct.');
  }

  if (await verifyPassword(newPassword, user.password_hash)) {
    throw AppError.badRequest('SAME_PASSWORD', 'Choose a password you have not used before.');
  }

  const passwordHash = await hashPassword(newPassword);

  await sequelize.transaction(async (transaction) => {
    user.password_hash = passwordHash;
    user.must_change_password = false;
    await user.save({ transaction });

    // Sign out other devices. This session receives a new refresh token below.
    await RefreshToken.update(
      { revoked_at: new Date() },
      { where: { user_id: user.id, revoked_at: null }, transaction }
    );
  });

  await recordAudit({
    action: 'change_password',
    entity: 'User',
    entityId: user.id,
    userId: user.id,
    userRole: user.role,
  });

  const freshUser = await loadPublicUser(user.id);
  return createSession(freshUser, meta);
}

async function resolveTotpUser({ setupToken, accessUser }) {
  let user;

  if (setupToken) {
    const payload = verifyTotpSetupToken(setupToken);
    user = await User.unscoped().findByPk(payload.sub, { include: userInclude });
  } else if (accessUser) {
    user = await User.unscoped().findByPk(accessUser.id, { include: userInclude });
  }

  if (!user || !user.is_active) {
    throw AppError.unauthorized('ACCOUNT_UNAVAILABLE', 'This account is not active');
  }
  if (!TFA_ROLES.has(user.role)) {
    throw AppError.forbidden('TOTP_NOT_REQUIRED', 'Two-step verification is only required for director and admin accounts.');
  }

  return user;
}

async function beginTotpSetup({ setupToken, accessUser }) {
  const user = await resolveTotpUser({ setupToken, accessUser });

  if (user.totp_enabled) {
    throw AppError.conflict('TOTP_ALREADY_ENABLED', 'Two-step verification is already switched on.');
  }

  const setup = await totpService.buildSetupResponse(user);

  await recordAudit({
    action: 'totp_setup_started',
    entity: 'User',
    entityId: user.id,
    userId: user.id,
    userRole: user.role,
  });

  return setup;
}

async function enableTotp({ setupToken, accessUser, code }, meta) {
  const user = await resolveTotpUser({ setupToken, accessUser });

  if (user.totp_enabled) {
    throw AppError.conflict('TOTP_ALREADY_ENABLED', 'Two-step verification is already switched on.');
  }

  await totpService.confirmSetup(user.id, code);

  await recordAudit({
    action: 'totp_enabled',
    entity: 'User',
    entityId: user.id,
    userId: user.id,
    userRole: user.role,
  });

  const freshUser = await loadPublicUser(user.id);
  return createSession(freshUser, meta);
}

module.exports = {
  login,
  rotateRefreshToken,
  logout,
  acceptInvitation,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  beginTotpSetup,
  enableTotp,
  loadPublicUser,
  publicUser,
  userInclude,
};
