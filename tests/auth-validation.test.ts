import { describe, expect, it } from '@jest/globals';

import { getFieldErrors, signInSchema, signUpSchema } from '@/features/auth/validation';

describe('auth validation', () => {
  it('accepts a valid sign-in request', () => {
    expect(
      signInSchema.safeParse({ email: 'person@example.com', password: 'securepass' }).success,
    ).toBe(true);
  });

  it('reports the confirmation field when sign-up passwords differ', () => {
    const result = signUpSchema.safeParse({
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'securepass',
      confirmPassword: 'anotherpass',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getFieldErrors(result.error).confirmPassword).toBe('Passwords do not match.');
    }
  });
});
