import type { SavedAction } from '@/features/actions/action-service';
import type { Database } from '@/types/database';

export type SavedContact = Database['public']['Tables']['people']['Row'];

export function actionMessage(action: SavedAction) {
  return action.message_draft?.trim() || action.summary?.trim() || action.title;
}

export function contactLabel(contact: SavedContact) {
  const details = [contact.company, contact.email ?? contact.phone].filter(Boolean).join(' · ');
  return details ? `${contact.name} · ${details}` : contact.name;
}

export function mailtoUrl(contact: SavedContact, subject: string, body: string) {
  if (!contact.email) throw new Error('This contact has no email address.');
  const query = new URLSearchParams({ body, subject });
  return `mailto:${encodeURIComponent(contact.email)}?${query.toString()}`;
}

export function whatsAppUrl(phone: string, message: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  const internationalNumber = trimmed.startsWith('+')
    ? digits
    : trimmed.startsWith('00')
      ? digits.slice(2)
      : null;

  if (!internationalNumber || internationalNumber.length < 8) {
    throw new Error('Use an international phone number for WhatsApp, for example +32470123456.');
  }

  return `https://wa.me/${internationalNumber}?text=${encodeURIComponent(message)}`;
}
