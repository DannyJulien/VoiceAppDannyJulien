import * as Linking from 'expo-linking';
import * as SMS from 'expo-sms';
import { Platform } from 'react-native';

import type { SavedContact } from '@/features/contacts/contact-utils';
import { mailtoUrl, whatsAppUrl } from '@/features/contacts/contact-utils';

export async function openSmsComposer(contact: SavedContact, message: string) {
  if (!contact.phone) throw new Error('This contact has no phone number.');
  if (Platform.OS === 'web') {
    window.location.assign(`sms:${encodeURIComponent(contact.phone)}?body=${encodeURIComponent(message)}`);
    return;
  }
  if (!(await SMS.isAvailableAsync())) {
    throw new Error('SMS is available only from the installed mobile app.');
  }

  await SMS.sendSMSAsync([contact.phone], message);
}

export async function openEmailComposer(contact: SavedContact, subject: string, message: string) {
  const url = mailtoUrl(contact, subject, message);
  if (Platform.OS === 'web') {
    // Browser pop-up blocking can prevent Linking.openURL from opening a composer after an async mutation.
    // Assigning the mailto URL keeps this tied to the current user interaction.
    window.location.assign(url);
    return;
  }
  await Linking.openURL(url);
}

export async function openWhatsAppComposer(contact: SavedContact, message: string) {
  if (!contact.phone) throw new Error('This contact has no phone number.');
  const url = whatsAppUrl(contact.phone, message);
  if (Platform.OS === 'web') {
    window.location.assign(url);
    return;
  }
  await Linking.openURL(url);
}
