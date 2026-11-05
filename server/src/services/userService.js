'use strict';

/**
 * User administration and invitations.
 *
 * A person can be created in two ways:
 * 1. an email invitation link (24 hours) that lets them choose a password;
 * 2. a temporary password handed over in person, for staff without email.
 * Both force a password change on first sign-in, except the invitation link
 * path where the person has just chosen their own password.
 */

const { Op } = require('sequelize');
const { User, Lga, Organization, RefreshToken, sequelize } = require('../models');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { hashPassword, generateTemporaryPassword } = require('../utils/password');
const { generateOpaqueToken, hashToken } = require('../utils/tokens');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { recordAudit } = require('./auditService');
const emailService = require('./emailService');
const { userInclude, publicUser } = require('./authService');

const CREATABLE_ROLES = {
  admin: ['admin', 'placa_director', 'placa_officer', 'laca_officer', 'partner_staff'],
  placa_director: ['placa_director', 'placa_officer', 'laca_officer', 'partner_staff'],
  placa_officer: ['laca_officer', 'partner_staff'],
  laca_officer: ['partner_staff'],
};

const PLACA_ROLE_NAMES = new Set(['placa_officer', 'placa_director', 'admin']);

function invitationUrl(token) {
  return env.clientAppUrl(`/accept-invitation?token=${encodeURIComponent(token)}`);
}

function canManageUser(actor, target) {
  if (actor.role === 'admin') return true;
  if (target.role === 'admin') return false;
  if (actor.role === 'placa_director') return true;
  if (actor.role === 'placa_officer') {
    return ['partner_staff', 'laca_officer'].includes(target.role);
  }
  if (actor.role === 'laca_officer') {
    return target.role === 'partner_staff' && target.lga_id === actor.lga_id;
  }
  return false;
}

async function resolvePlacement({ role, organization_id: organizationId, lga_id: lgaId, actor }) {
  if (role === 'partner_staff') {
    if (!organizationId) {
      throw AppError.badRequest('ORGANIZATION_REQUIRED', 'Choose the partner organization.');
    }
    const organization = await Organization.findByPk(organizationId, {
      attributes: ['id', 'name', 'lga_id', 'status'],
    });
    if (!organization) {
      throw AppError.badRequest('ORGANIZATION_NOT_FOUND', 'That organization does not exist.');
    }
    if (organization.status !== 'approved') {
      throw AppError.badRequest(
        'ORGANIZATION_NOT_APPROVED',
        'Approve the organization before creating partner staff accounts for it.'
      );
    }
    if (actor.role === 'laca_officer' && organization.lga_id !== actor.lga_id) {
      throw AppError.forbidden(
        'ORGANIZATION_OUTSIDE_LGA',
        'You can only create accounts for organizations in your own LGA.'
      );
    }
    if (lgaId && lgaId !== organization.lga_id) {
      throw AppError.badRequest(
        'LGA_MISMATCH',
        'The organization belongs to a different LGA. Clear the LGA or choose the correct one.'
      );
    }
    return { organization_id: organization.id, lga_id: organization.lga_id };
  }

  if (role === 'laca_officer') {
    if (!lgaId) {
      throw AppError.badRequest('LGA_REQUIRED', 'Choose the LGA this officer will serve.');
    }
    if (actor.role === 'laca_officer' && lgaId !== actor.lga_id) {
      throw AppError.forbidden('LGA_NOT_ALLOWED', 'You can only work inside your own LGA.');
    }
    const lga = await Lga.findByPk(lgaId, { attributes: ['id'] });
    if (!lga) throw AppError.badRequest('LGA_NOT_FOUND', 'That LGA does not exist.');
    return { organization_id: null, lga_id: lgaId };
  }

  // PLACA staff and system admins are not tied to a partner or an LGA.
  return { organization_id: null, lga_id: null };
}

async function sendInviteForUser(user, temporaryPassword) {
  if (!user.email) return { sent: false, url: null, reason: 'no_recipient' };

  const { token, hash } = generateOpaqueToken();
  user.invitation_token_hash = hash;
  user.invitation_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  const url = invitationUrl(token);
  const result = await emailService.sendInvitation({
    to: user.email,
    name: user.name,
    organizationName: user.organization?.name || null,
    inviteUrl: url,
    temporaryPassword,
  });

  const sandboxed = Boolean(result.sandboxed || (!env.isProduction && result.sent));
  const reason =
    result.reason ||
    (result.sent ? (sandboxed ? 'sandboxed' : 'delivered') : 'send_failed');

  return {
    sent: Boolean(result.sent),
    url,
    reason,
    sandboxed,
    status: result.status || null,
  };
}

async function createUser(actor, input) {
  const allowed = CREATABLE_ROLES[actor.role] || [];
  if (!allowed.includes(input.role)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot create an account with that role.');
  }

  if (input.role === 'admin' && actor.role !== 'admin') {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only the system admin can create another admin.');
  }

  const placement = await resolvePlacement({
    role: input.role,
    organization_id: input.organization_id,
    lga_id: input.lga_id,
    actor,
  });

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await User.create({
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    password_hash: passwordHash,
    role: input.role,
    lga_id: placement.lga_id,
    organization_id: placement.organization_id,
    language: input.language,
    must_change_password: true,
    verified: false,
    is_active: true,
  });

  // Reload with the organization name for the invitation text.
  const populated = await User.findByPk(user.id, { include: userInclude });

  let invite = { sent: false, url: null };
  if (input.send_email && populated.email) {
    invite = await sendInviteForUser(populated, temporaryPassword);
  }

  return {
    user: publicUser(populated),
    temporaryPassword,
    inviteUrl: invite.url,
    emailSent: invite.sent,
    emailDelivery: {
      sent: invite.sent,
      reason:
        invite.reason ||
        (invite.sent
          ? invite.sandboxed
            ? 'sandboxed'
            : 'delivered'
          : populated.email
          ? 'not_sent'
          : 'no_email'),
      sandboxed: Boolean(invite.sandboxed),
      status: invite.status || null,
    },
    note: populated.email
      ? 'Give the temporary password or invitation link to the user. They must change it at first sign-in.'
      : 'This account has no email address. Give the temporary password to the user in person.',
  };
}

async function listUsers(actor, query) {
  if (actor.role === 'partner_staff') {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Partner staff cannot list user accounts.');
  }

  const { page, limit, offset } = getPagination(query);
  const where = {};

  if (actor.role === 'laca_officer') {
    where.lga_id = actor.lga_id;
  }
  if (query.role) where.role = query.role;
  if (query.lga_id) where.lga_id = query.lga_id;
  if (query.organization_id) where.organization_id = query.organization_id;
  if (query.is_active !== undefined) where.is_active = query.is_active;

  if (query.search) {
    const term = `%${query.search}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
      { phone: { [Op.iLike]: term } },
    ];
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    include: userInclude,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return {
    data: rows.map((user) => publicUser(user)),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function getUser(actor, id) {
  const user = await User.findByPk(id, { include: userInclude });
  if (!user) throw AppError.notFound('USER_NOT_FOUND', 'That user does not exist.');
  if (actor.role === 'laca_officer' && user.lga_id !== actor.lga_id) {
    throw AppError.forbidden('USER_OUTSIDE_LGA', 'That user is outside your LGA.');
  }
  if (actor.role === 'partner_staff' && user.id !== actor.id) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You can only view your own account.');
  }
  return publicUser(user);
}

async function updateUser(actor, id, input) {
  const target = await User.findByPk(id, { include: userInclude });
  if (!target) throw AppError.notFound('USER_NOT_FOUND', 'That user does not exist.');

  if (!canManageUser(actor, target)) {
    throw AppError.forbidden('USER_ACCESS_DENIED', 'You cannot edit this user.');
  }

  if (target.id === actor.id && input.is_active === false) {
    throw AppError.badRequest('CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account.');
  }

  const roleChanging = input.role && input.role !== target.role;
  if (roleChanging && !['admin', 'placa_director'].includes(actor.role)) {
    throw AppError.forbidden('ROLE_CHANGE_NOT_ALLOWED', 'Only a director or admin can change a role.');
  }
  if (target.id === actor.id && roleChanging) {
    throw AppError.badRequest('CANNOT_CHANGE_OWN_ROLE', 'Ask another director or admin to change your role.');
  }
  if (input.role === 'admin' && actor.role !== 'admin') {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only the system admin can make someone an admin.');
  }

  const finalRole = input.role || target.role;
  const finalOrganizationId =
    input.organization_id !== undefined ? input.organization_id : target.organization_id;
  const finalLgaId = input.lga_id !== undefined ? input.lga_id : target.lga_id;

  if (roleChanging || input.organization_id !== undefined || input.lga_id !== undefined) {
    const placement = await resolvePlacement({
      role: finalRole,
      organization_id: finalOrganizationId,
      lga_id: finalLgaId,
      actor,
    });
    input.organization_id = placement.organization_id;
    input.lga_id = placement.lga_id;
  }

  let verification = null;

  await sequelize.transaction(async (transaction) => {
    const emailChanged =
      input.email !== undefined && (input.email || null) !== (target.email || null);

    Object.assign(target, input);

    if (emailChanged) {
      target.verified = false;
      target.email_verification_token_hash = null;
      target.email_verification_expires_at = null;

      if (target.email) {
        const { token, hash } = generateOpaqueToken();
        target.email_verification_token_hash = hash;
        target.email_verification_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
        verification = { email: target.email, token };
      }
    }

    await target.save({ transaction });

    if (input.is_active === false) {
      await RefreshToken.update(
        { revoked_at: new Date() },
        { where: { user_id: target.id, revoked_at: null }, transaction }
      );
    }
  });

  if (verification) {
    await emailService.sendVerification({
      to: verification.email,
      name: target.name,
      verifyUrl: env.clientAppUrl(`/verify-email?token=${encodeURIComponent(verification.token)}`),
    });
  }

  await recordAudit({
    action: 'user_updated',
    entity: 'User',
    entityId: target.id,
    userId: actor.id,
    userRole: actor.role,
    newValue: { fields: Object.keys(input) },
  });

  const reloaded = await User.findByPk(target.id, { include: userInclude });
  return publicUser(reloaded);
}

async function resetUserPassword(actor, id) {
  const target = await User.findByPk(id, { include: userInclude });
  if (!target) throw AppError.notFound('USER_NOT_FOUND', 'That user does not exist.');
  if (!canManageUser(actor, target)) {
    throw AppError.forbidden('USER_ACCESS_DENIED', 'You cannot reset this user password.');
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await sequelize.transaction(async (transaction) => {
    target.password_hash = passwordHash;
    target.must_change_password = true;
    target.failed_attempts = 0;
    target.locked_until = null;
    await target.save({ transaction });

    await RefreshToken.update(
      { revoked_at: new Date() },
      { where: { user_id: target.id, revoked_at: null }, transaction }
    );
  });

  let invite = { sent: false, url: null };
  if (target.email) {
    invite = await sendInviteForUser(target, temporaryPassword);
  }

  await recordAudit({
    action: 'password_reset_by_staff',
    entity: 'User',
    entityId: target.id,
    userId: actor.id,
    userRole: actor.role,
  });

  return {
    user: publicUser(target),
    temporaryPassword,
    inviteUrl: invite.url,
    emailSent: invite.sent,
    emailDelivery: {
      sent: invite.sent,
      reason:
        invite.reason ||
        (invite.sent
          ? invite.sandboxed
            ? 'sandboxed'
            : 'delivered'
          : target.email
          ? 'not_sent'
          : 'no_email'),
      sandboxed: Boolean(invite.sandboxed),
      status: invite.status || null,
    },
  };
}

async function resendInvitation(actor, id) {
  const target = await User.findByPk(id, { include: userInclude });
  if (!target) throw AppError.notFound('USER_NOT_FOUND', 'That user does not exist.');
  if (!canManageUser(actor, target)) {
    throw AppError.forbidden('USER_ACCESS_DENIED', 'You cannot invite this user.');
  }
  if (!target.email) {
    throw AppError.badRequest(
      'NO_EMAIL',
      'This account has no email address. Reset the password and hand it over in person.'
    );
  }

  const invite = await sendInviteForUser(target, null);

  await recordAudit({
    action: 'invitation_resent',
    entity: 'User',
    entityId: target.id,
    userId: actor.id,
    userRole: actor.role,
  });

  return {
    emailSent: invite.sent,
    emailDelivery: {
      sent: invite.sent,
      reason:
        invite.reason ||
        (invite.sent
          ? invite.sandboxed
            ? 'sandboxed'
            : 'delivered'
          : 'send_failed'),
      sandboxed: Boolean(invite.sandboxed),
      status: invite.status || null,
    },
    inviteUrl: invite.url,
    expiresInHours: 24,
  };
}

async function updateOwnProfile(actor, input) {
  const user = await User.findByPk(actor.id, { include: userInclude });
  if (!user || !user.is_active) {
    throw AppError.unauthorized('ACCOUNT_UNAVAILABLE', 'This account is not active');
  }

  Object.assign(user, input);
  await user.save();

  const reloaded = await User.findByPk(user.id, { include: userInclude });
  return publicUser(reloaded);
}

module.exports = {
  createUser,
  listUsers,
  getUser,
  updateUser,
  updateOwnProfile,
  resetUserPassword,
  resendInvitation,
  canManageUser,
};
