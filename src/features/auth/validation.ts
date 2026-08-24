import { z } from 'zod';

const email = z.string().trim().email('Enter a valid email address.').max(255);
const password = z.string().min(8, 'Use at least 8 characters.').max(128);

export const signInSchema = z.object({ email, password });
export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Enter at least 2 characters.').max(80),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

export function getFieldErrors(error: z.ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = String(issue.path[0] ?? 'form');
    errors[field] ??= issue.message;
    return errors;
  }, {});
}
