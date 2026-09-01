import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { BackButton } from '@/components/back-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import {
  createActionChecklistItem,
  deleteActionChecklistItem,
  getAction,
  getActionChecklistItems,
  moveActionChecklistItem,
  renameActionChecklistItem,
  type ChecklistItem,
} from '@/features/actions/action-service';
import { useAuth } from '@/features/auth/auth-provider';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';

export default function EditChecklistScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [newItem, setNewItem] = useState('');
  const [draftTitles, setDraftTitles] = useState<Record<string, string>>({});

  const actionQuery = useQuery({
    queryKey: ['action', id, userId],
    queryFn: () => getAction(id, userId!),
    enabled: Boolean(id && userId),
  });
  const itemsQuery = useQuery({
    queryKey: ['action-checklist-items', id, userId],
    queryFn: () => getActionChecklistItems(id, userId!),
    enabled: Boolean(id && userId),
  });
  const items = itemsQuery.data ?? [];

  function invalidateChecklist() {
    queryClient.invalidateQueries({ queryKey: ['action-checklist-items', id, userId] });
    queryClient.invalidateQueries({ queryKey: ['action', id, userId] });
    if (userId) queryClient.invalidateQueries({ queryKey: ['actions', userId] });
  }

  const addMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      return createActionChecklistItem(id, userId, newItem);
    },
    onSuccess: () => {
      setNewItem('');
      invalidateChecklist();
    },
  });
  const renameMutation = useMutation({
    mutationFn: (item: ChecklistItem) => {
      if (!userId) throw new Error('You need to be signed in.');
      return renameActionChecklistItem(item.id, userId, draftTitles[item.id] ?? item.title);
    },
    onSuccess: (_item, editedItem) => {
      setDraftTitles((current) => {
        const next = { ...current };
        delete next[editedItem.id];
        return next;
      });
      invalidateChecklist();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (item: ChecklistItem) => {
      if (!userId) throw new Error('You need to be signed in.');
      return deleteActionChecklistItem(item, userId);
    },
    onSuccess: invalidateChecklist,
  });
  const moveMutation = useMutation({
    mutationFn: ({ direction, itemId }: { direction: -1 | 1; itemId: string }) =>
      moveActionChecklistItem(itemId, direction),
    onSuccess: invalidateChecklist,
  });

  function backToNote() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/action/[id]', params: { id } });
  }

  if (actionQuery.isPending || itemsQuery.isPending) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.copy}>Loading checklist…</Text>
      </Screen>
    );
  }
  if (actionQuery.error || !actionQuery.data) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.title}>Checklist unavailable</Text>
        <Text style={styles.copy}>This note may have been removed.</Text>
        <BackButton fallbackHref="/timeline" fallbackLabel="Back to timeline" label="Go back" />
      </Screen>
    );
  }

  const mutationError =
    addMutation.error ?? renameMutation.error ?? deleteMutation.error ?? moveMutation.error;

  return (
    <Screen>
      <View style={styles.stickyHeader}>
        <AppButton label="‹ Back to note" onPress={backToNote} variant="quiet" />
        <Text style={styles.headerTitle} numberOfLines={1}>
          Edit checklist
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>CHECKLIST</Text>
        <Text style={styles.title}>{actionQuery.data.title}</Text>
        <Text style={styles.copy}>
          Add, rename, remove, or reorder the practical steps for this note.
        </Text>

        <View style={styles.addCard}>
          <Text style={styles.fieldLabel}>NEW ITEM</Text>
          <TextInput
            accessibilityLabel="New checklist item"
            maxLength={280}
            onChangeText={setNewItem}
            onSubmitEditing={() => addMutation.mutate()}
            placeholder="For example, pack water bottles"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            style={styles.input}
            value={newItem}
          />
          <AppButton
            disabled={!newItem.trim() || items.length >= 30}
            label={items.length >= 30 ? 'Checklist limit reached' : 'Add item'}
            loading={addMutation.isPending}
            onPress={() => addMutation.mutate()}
            variant="secondary"
          />
          <Text style={styles.limit}>{items.length}/30 items</Text>
        </View>

        {items.length ? (
          <View style={styles.items}>
            {items.map((item, index) => {
              const value = draftTitles[item.id] ?? item.title;
              const titleChanged = value.trim() !== item.title;
              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemTopRow}>
                    <Text style={styles.itemNumber}>{index + 1}</Text>
                    <Text style={styles.itemState}>{item.is_completed ? 'DONE' : 'TO DO'}</Text>
                  </View>
                  <TextInput
                    accessibilityLabel={`Checklist item ${index + 1}`}
                    maxLength={280}
                    onChangeText={(next) =>
                      setDraftTitles((current) => ({ ...current, [item.id]: next }))
                    }
                    style={styles.itemInput}
                    value={value}
                  />
                  <View style={styles.orderSection}>
                    <Text style={styles.actionLabel}>ORDER</Text>
                    <View style={styles.orderActions}>
                      <Pressable
                        accessibilityLabel={`Move ${item.title} up`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: index === 0 || moveMutation.isPending }}
                        disabled={index === 0 || moveMutation.isPending}
                        onPress={() => moveMutation.mutate({ direction: -1, itemId: item.id })}
                        style={({ pressed }) => [
                          styles.smallButton,
                          (index === 0 || moveMutation.isPending) && styles.smallButtonDisabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.smallButtonText}>↑ Move up</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Move ${item.title} down`}
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: index === items.length - 1 || moveMutation.isPending,
                        }}
                        disabled={index === items.length - 1 || moveMutation.isPending}
                        onPress={() => moveMutation.mutate({ direction: 1, itemId: item.id })}
                        style={({ pressed }) => [
                          styles.smallButton,
                          (index === items.length - 1 || moveMutation.isPending) &&
                            styles.smallButtonDisabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.smallButtonText}>↓ Move down</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.itemActions}>
                    {titleChanged ? (
                      <Pressable
                        accessibilityLabel={`Save ${item.title}`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: renameMutation.isPending }}
                        disabled={renameMutation.isPending}
                        onPress={() => renameMutation.mutate(item)}
                        style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.saveButtonText}>Save name</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityLabel={`Remove ${item.title}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: deleteMutation.isPending }}
                      disabled={deleteMutation.isPending}
                      onPress={() => deleteMutation.mutate(item)}
                      style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Start your checklist</Text>
            <Text style={styles.copy}>
              Add the first item above. You can add more from voice later.
            </Text>
          </View>
        )}

        {mutationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {mutationError instanceof Error
              ? mutationError.message
              : 'Unable to update this checklist.'}
          </Text>
        ) : null}
        <AppButton label="Done editing" onPress={backToNote} variant="secondary" />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    stickyHeader: {
      alignItems: 'center',
      backgroundColor: colors.canvas,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginHorizontal: -20,
      minHeight: 58,
      paddingHorizontal: 12,
    },
    headerTitle: {
      color: colors.ink,
      flex: 1,
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'right',
    },
    content: { gap: 16, paddingVertical: 20 },
    centered: { gap: 16, justifyContent: 'center' },
    eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
    title: {
      color: colors.ink,
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -0.8,
      lineHeight: 39,
    },
    copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
    addCard: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.focus,
      borderRadius: 20,
      borderWidth: 1,
      gap: 10,
      padding: 16,
    },
    fieldLabel: { color: colors.brand, fontSize: 11, fontWeight: '900', letterSpacing: 0.9 },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 13,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 16,
      minHeight: 50,
      paddingHorizontal: 13,
    },
    limit: { alignSelf: 'flex-end', color: colors.muted, fontSize: 12, fontWeight: '700' },
    items: { gap: 10 },
    itemCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 10,
      padding: 14,
    },
    itemTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    itemNumber: {
      backgroundColor: colors.accentSoft,
      borderRadius: 99,
      color: colors.brand,
      fontSize: 12,
      fontWeight: '900',
      overflow: 'hidden',
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    itemState: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
    itemInput: {
      backgroundColor: colors.canvas,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 16,
      minHeight: 48,
      paddingHorizontal: 12,
    },
    orderSection: { gap: 7 },
    actionLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
    orderActions: { flexDirection: 'row', gap: 8 },
    itemActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    smallButton: {
      alignItems: 'center',
      backgroundColor: colors.canvas,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      flex: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 10,
    },
    smallButtonDisabled: { opacity: 0.42 },
    smallButtonText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
    removeButton: { justifyContent: 'center', minHeight: 36, paddingHorizontal: 4 },
    removeButtonText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
    saveButton: {
      alignItems: 'center',
      backgroundColor: colors.brand,
      borderRadius: 10,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: 11,
    },
    saveButtonText: { color: colors.surface, fontSize: 13, fontWeight: '800' },
    emptyCard: { backgroundColor: colors.surface, borderRadius: 18, gap: 5, padding: 18 },
    emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
    pressed: { opacity: 0.82 },
  });
