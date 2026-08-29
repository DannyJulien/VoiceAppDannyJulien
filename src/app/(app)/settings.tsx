import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useThemePreference } from '@/features/theme/theme-provider';
import { signOut } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import { getProfile, updateProfile } from '@/features/auth/profile-service';

export default function SettingsScreen() {
  const { colors, mode, setMode } = useThemePreference();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId!),
    enabled: Boolean(userId),
  });
  const autoFileMutation = useMutation({
    mutationFn: (enabled: boolean) => updateProfile(userId!, { auto_file_captures: enabled }),
    onSuccess: (profile) => queryClient.setQueryData(['profile', userId], profile),
  });
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onError: (error) => {
      setSignOutError(error instanceof Error ? error.message : 'Unable to sign out.');
    },
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, tabBarInset]} showsVerticalScrollIndicator={false}>
        <AppButton
          label="‹ Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          style={styles.back}
          variant="quiet"
        />

        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.copy}>Choose how Handle files your captures and manage your account.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Text style={styles.fieldLabel}>SIGNED-IN EMAIL</Text>
          <Text selectable style={styles.email}>
            {session?.user.email ?? 'No email is attached to this account.'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Appearance</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Night mode</Text>
              <Text style={styles.settingHint}>Use the darker palette across Handle on this device.</Text>
            </View>
            <Switch
              accessibilityLabel="Night mode"
              accessibilityHint="Switches Handle between the light and dark interface"
              onValueChange={(enabled) => setMode(enabled ? 'dark' : 'light')}
              thumbColor={mode === 'dark' ? colors.brand : colors.surface}
              trackColor={{ false: colors.border, true: colors.brand }}
              value={mode === 'dark'}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Capture preferences</Text>
          {profileQuery.isPending ? <Text style={styles.copy}>Loading your preference…</Text> : null}
          {profileQuery.error ? (
            <View accessibilityRole="alert" style={styles.errorCard}>
              <Text style={styles.error}>
                {profileQuery.error instanceof Error
                  ? profileQuery.error.message
                  : 'Unable to load your capture preference.'}
              </Text>
              <AppButton label="Try again" onPress={() => profileQuery.refetch()} variant="secondary" />
            </View>
          ) : null}
          {profileQuery.data ? (
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Auto-file confident captures</Text>
                <Text style={styles.settingHint}>
                  When off, every capture waits in your Inbox for approval.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Auto-file confident captures"
                accessibilityHint="Controls whether Handle files high-confidence captures without review"
                disabled={autoFileMutation.isPending}
                onValueChange={(value) => autoFileMutation.mutate(value)}
                trackColor={{ false: colors.border, true: colors.brand }}
                value={profileQuery.data.auto_file_captures}
              />
            </View>
          ) : null}
          {autoFileMutation.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {autoFileMutation.error instanceof Error
                ? autoFileMutation.error.message
                : 'Unable to update your preference.'}
            </Text>
          ) : null}
        </View>

        <View style={styles.signOutCard}>
          <Text style={styles.cardTitle}>Sign out</Text>
          <Text style={styles.copy}>This removes your session from this device. Your saved work stays safe.</Text>
          <AppButton
            label="Sign out"
            loading={signOutMutation.isPending}
            onPress={() => {
              setSignOutError(null);
              signOutMutation.mutate();
            }}
            variant="secondary"
          />
          {signOutError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {signOutError}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  content: { gap: 18, paddingBottom: 30, paddingTop: 16 },
  back: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
  titleBlock: { gap: 5 },
  eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 40,
  },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  signOutCard: { backgroundColor: colors.dangerSoft, borderRadius: 20, gap: 12, padding: 18 },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  email: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  settingRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  settingHint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  errorCard: { backgroundColor: colors.dangerSoft, borderRadius: 14, gap: 10, padding: 12 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
});
