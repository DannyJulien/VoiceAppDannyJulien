import { describe, expect, it } from '@jest/globals';

import {
  actionMessage,
  mailtoUrl,
  type SavedContact,
  whatsAppUrl,
} from '@/features/contacts/contact-utils';
import type { SavedAction } from '@/features/actions/action-service';

const contact: SavedContact = {
  id: '482d932b-30e7-4d1a-9e17-a673781024cc',
  user_id: 'e0229b36-31c3-4b59-8db0-f7f9b35ef68d',
  name: 'Maya Janssens',
  email: 'maya@example.com',
  phone: null,
  company: null,
  created_at: '2026-08-23T12:00:00.000Z',
  updated_at: '2026-08-23T12:00:00.000Z',
};

const action: SavedAction = {
  id: '9c8d2787-40bd-4dce-bc30-094afc66eac1',
  user_id: contact.user_id,
  voice_capture_id: null,
  action_type: 'note',
  title: 'Plan the meeting',
  summary: 'Bring the proposal.',
  status: 'approved',
  scheduled_at: null,
  scheduled_timezone: null,
  message_draft: null,
  confidence: 0.9,
  requires_clarification: false,
  clarification_question: null,
  project_id: null,
  category: 'inbox',
  suggested_category: null,
  suggested_project_name: null,
  suggested_people: [],
  auto_filed_at: null,
  created_at: contact.created_at,
  updated_at: contact.updated_at,
};

describe('contact delivery helpers', () => {
  it('prefers an approved message draft and falls back to note details', () => {
    expect(actionMessage(action)).toBe('Bring the proposal.');
    expect(actionMessage({ ...action, message_draft: 'Can we meet at 14:00?' })).toBe(
      'Can we meet at 14:00?',
    );
  });

  it('builds a mailto URL without exposing a missing address', () => {
    expect(mailtoUrl(contact, 'Meeting', 'Hello Maya')).toContain('subject=Meeting');
    expect(() => mailtoUrl({ ...contact, email: null }, 'Meeting', 'Hello')).toThrow(
      'no email address',
    );
  });

  it('builds a WhatsApp URL from an international phone number', () => {
    expect(whatsAppUrl('+32 470 12 34 56', 'Hello Maya')).toBe(
      'https://wa.me/32470123456?text=Hello%20Maya',
    );
    expect(() => whatsAppUrl('0470123456', 'Hello Maya')).toThrow('international phone number');
  });
});
