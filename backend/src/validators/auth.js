import { z } from 'zod';
import { email, requiredText } from './common.js';
import { ROLES } from '../config/constants.js';
import { passwordProblem } from '../utils/password.js';

const password = z.string({ required_error: 'Required.', invalid_type_error: 'Must be text.' }).min(1, 'Required.').max(200);

const newPassword = z.string({ required_error: 'Required.', invalid_type_error: 'Must be text.' }).superRefine((value, ctx) => {
  const problem = passwordProblem(value);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
});

export const loginSchema = z.object({ email, password });

export const changePasswordSchema = z.object({ currentPassword: password, newPassword });

// No password field: the server generates a temporary one for a new
// user and for a reset, and returns it once.
export const userCreateSchema = z.object({
  name: requiredText(120),
  email,
  role: z.enum(ROLES),
});

export const userUpdateSchema = z.object({
  name: requiredText(120).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
});
