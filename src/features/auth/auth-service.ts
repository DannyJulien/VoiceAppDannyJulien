import { getSupabaseClient } from '@/services/supabase/client';

import { signInSchema, signUpSchema, type SignInValues, type SignUpValues } from './validation';

export async function signIn(values: SignInValues) {
  const credentials = signInSchema.parse(values);
  const { error } = await getSupabaseClient().auth.signInWithPassword(credentials);
  if (error) throw error;
}

export async function signUp(values: SignUpValues) {
  const credentials = signUpSchema.parse(values);
  const { error } = await getSupabaseClient().auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: { data: { display_name: credentials.displayName } },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}
