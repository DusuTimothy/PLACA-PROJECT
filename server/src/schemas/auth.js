'use strict';

/**
 * Authentication request schemas.
 * Every exported object is shaped { body, query, params } for validate().
 */

const { z } = require('zod');
const {
  email,
  password,
  optionalPhone,
  name,
  language,
  emptyBody,
  emptyQuery,
  emptyParams,
} = require('./common');

const identifier = z
  .string()
  .trim()
  .min(3, 'Enter your email address or phone number')
  .max(190);

const login = z.object({
  body: z.object({
    identifier,
    password: z.string().min(1, 'Enter your password').max(200),
    // Optional six-digit authenticator code for director/admin accounts.
    totp_code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app').optional(),
  }),
  query: emptyQuery,
  params: emptyParams,
});

const refresh = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: emptyParams,
});

const logout = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: emptyParams,
});

const acceptInvitation = z.object({
  body: z.object({
    token: z.string().min(20, 'This invitation link is not valid').max(300),
    password,
    name: name.optional(),
    phone: optionalPhone.optional(),
    language: language.optional(),
  }),
  query: emptyQuery,
  params: emptyParams,
});

const verifyEmail = z.object({
  body: z.object({
    token: z.string().min(20, 'This verification link is not valid').max(300),
  }),
  query: emptyQuery,
  params: emptyParams,
});

const forgotPassword = z.object({
  body: z.object({ identifier }),
  query: emptyQuery,
  params: emptyParams,
});

const resetPassword = z.object({
  body: z.object({
    token: z.string().min(20, 'This reset link is not valid').max(300),
    password,
  }),
  query: emptyQuery,
  params: emptyParams,
});

const changePassword = z.object({
  body: z.object({
    current_password: z.string().min(1, 'Enter your current password').max(200),
    new_password: password,
  }),
  query: emptyQuery,
  params: emptyParams,
});

const totpSetup = z.object({
  body: z.object({
    // Present only when the user signed in with the temporary setup challenge.
    setup_token: z.string().min(20).max(600).optional(),
  }),
  query: emptyQuery,
  params: emptyParams,
});

const totpEnable = z.object({
  body: z.object({
    setup_token: z.string().min(20).max(600).optional(),
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  }),
  query: emptyQuery,
  params: emptyParams,
});

const updateProfile = z.object({
  body: z.object({
    name: name.optional(),
    phone: optionalPhone.optional(),
    language: language.optional(),
  }),
  query: emptyQuery,
  params: emptyParams,
});

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
  updateProfile,
};
