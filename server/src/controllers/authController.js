'use strict';

/**
 * Authentication HTTP layer.
 * Controllers translate request/response shapes; business rules live in
 * services/authService.js.
 */

const authService = require('../services/authService');
const userService = require('../services/userService');
const { refreshCookieOptions } = require('../utils/tokens');

const COOKIE_NAME = 'placa_refresh';

function setRefreshCookie(res, session) {
  res.cookie(COOKIE_NAME, session.refreshToken, refreshCookieOptions(session.refreshExpiresAt));
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, refreshCookieOptions());
}

function sessionResponse(res, session) {
  setRefreshCookie(res, session);
  return res.json({
    accessToken: session.accessToken,
    user: session.user,
    mustChangePassword: Boolean(session.user.must_change_password),
  });
}

async function login(req, res) {
  const result = await authService.login(req.body, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  if (result.totpSetupRequired) {
    return res.status(200).json({
      totpSetupRequired: true,
      setupToken: result.setupToken,
      user: result.user,
      message:
        'Your role needs two-step verification. Set up an authenticator app to continue.',
    });
  }

  return sessionResponse(res, result);
}

async function refresh(req, res) {
  const rawToken = req.cookies?.[COOKIE_NAME];
  const session = await authService.rotateRefreshToken(rawToken, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return sessionResponse(res, session);
}

async function logout(req, res) {
  const rawToken = req.cookies?.[COOKIE_NAME];
  await authService.logout(rawToken);
  clearRefreshCookie(res);
  return res.json({ message: 'You have signed out.' });
}

async function acceptInvitation(req, res) {
  const session = await authService.acceptInvitation(req.body, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return sessionResponse(res, session);
}

async function verifyEmail(req, res) {
  const result = await authService.verifyEmail(req.body.token);
  return res.json(result);
}

async function forgotPassword(req, res) {
  const result = await authService.forgotPassword(req.body);
  return res.json(result);
}

async function resetPassword(req, res) {
  const result = await authService.resetPassword(req.body);
  return res.json(result);
}

async function changePassword(req, res) {
  const session = await authService.changePassword(
    {
      userId: req.user.id,
      currentPassword: req.body.current_password,
      newPassword: req.body.new_password,
    },
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  return sessionResponse(res, session);
}

async function totpSetup(req, res) {
  const setup = await authService.beginTotpSetup({
    setupToken: req.body.setup_token,
    accessUser: req.user || null,
  });
  return res.json(setup);
}

async function totpEnable(req, res) {
  const session = await authService.enableTotp(
    {
      setupToken: req.body.setup_token,
      accessUser: req.user || null,
      code: req.body.code,
    },
    { ip: req.ip, userAgent: req.headers['user-agent'] }
  );
  return sessionResponse(res, session);
}

async function me(req, res) {
  const user = await authService.loadPublicUser(req.user.id);
  return res.json({ user });
}

async function updateProfile(req, res) {
  const user = await userService.updateOwnProfile(req.user, req.body);
  return res.json({ user });
}

module.exports = {
  login,
  refresh,
  logout,
  acceptInvitation,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  totpSetup,
  totpEnable,
  me,
  updateProfile,
  COOKIE_NAME,
};
