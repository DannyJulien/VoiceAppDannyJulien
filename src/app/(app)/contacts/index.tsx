import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { IconButton } from '@/components/icon-button';
import { PlusIcon } from '@/components/icons';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { contactLabel } from '@/features/contacts/contact-utils';
import { getContacts } from '@/features/contacts/contact-service';
import { useAuth } from '@/features/auth/auth-provider';

export default function ContactsScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const contactsQuery = useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => getContacts(userId!),
    enabled: Boolean(userId),
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, tabBarInset]} keyboardShouldPersistTaps="handled">
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>YOUR PEOPLE</Text>
          <Text style={styles.title}>People</Text>
        </View>
        <Text style={styles.copy}>
          Save someone once. From a note, you can open WhatsApp, SMS, or an email to them.
        </Text>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Saved contacts</Text>
          <IconButton
            accessibilityLabel="Add a person"
            label="New"
            onPress={() => router.push('/contacts/new')}
            renderIcon={(color, size) => <PlusIcon color={color} size={size} />}
          />
        </View>
        {contactsQuery.isPending ? <Text style={styles.copy}>Loading contacts…</Text> : null}
        {contactsQuery.error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.error}>
              {contactsQuery.error instanceof Error
                ? contactsQuery.error.message
                : 'Unable to load contacts.'}
            </Text>
            <AppButton
              label="Try again"
              onPress={() => contactsQuery.refetch()}
              variant="secondary"
            />
          </View>
        ) : null}
        {contactsQuery.data?.length === 0 ? (
          <Text style={styles.copy}>No contacts yet. Tap New to add someone.</Text>
        ) : null}
        <View style={styles.list}>
          {contactsQuery.data?.map((contact) => (
            <Pressable
              accessibilityLabel={`Open ${contact.name}`}
              accessibilityRole="button"
              key={contact.id}
              onPress={() =>
                router.push({ pathname: '/contacts/[id]', params: { id: contact.id } })
              }
              style={({ pressed }) => [styles.contactCard, pressed && styles.pressed]}
            >
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactDetails}>{contactLabel(contact)}</Text>
              <Text style={styles.timelineLink}>Timeline ›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  content: { gap: 18, paddingBottom: 30, paddingTop: 24 },
  titleBlock: { gap: 5 },
  eyebrow: { color: colors.brand, fontSize: 13, fontWeight: '800', letterSpacing: 1.1 },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 40,
  },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 4,
  },
  listTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  list: { gap: 9 },
  contactCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 15,
  },
  contactName: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  contactDetails: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  timelineLink: { color: colors.brand, fontSize: 13, fontWeight: '800', marginTop: 4 },
  pressed: { opacity: 0.8 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  errorCard: { gap: 10 },
});
