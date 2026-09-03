import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import {
  actionIcsFilename,
  createActionIcsEvent,
  type CalendarAction,
} from '@/features/actions/action-calendar';
import {
  actionTypeLabel,
  calendarMonthDays,
  formatActionWhen,
  formatCalendarDay,
  localDateKey,
} from '@/features/actions/action-utils';
import { getScheduledActions } from '@/features/actions/action-service';
import { useAuth } from '@/features/auth/auth-provider';
import { downloadIcs } from '@/features/share/share';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()) ?? '');
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const actionsQuery = useQuery({
    queryKey: ['scheduled-actions', userId],
    queryFn: () => getScheduledActions(userId!),
    enabled: Boolean(userId),
  });
  const monthDays = useMemo(() => calendarMonthDays(monthCursor), [monthCursor]);
  const scheduledCounts = useMemo(() => {
    const counts = new Map<string, number>();
    actionsQuery.data?.forEach((action) => {
      if (!action.scheduled_at) return;
      const key = localDateKey(action.scheduled_at);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [actionsQuery.data]);
  const selectedActions = (actionsQuery.data ?? []).filter(
    (action) => action.scheduled_at && localDateKey(action.scheduled_at) === selectedDate,
  );
  const monthTitle = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    monthCursor,
  );

  function changeMonth(offset: number) {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function addToOwnCalendar(action: CalendarAction) {
    try {
      setCalendarError(null);
      downloadIcs(actionIcsFilename(action), createActionIcsEvent(action));
    } catch (error) {
      setCalendarError(
        error instanceof Error ? error.message : 'Unable to add this item to your calendar.',
      );
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR SCHEDULE</Text>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.copy}>See every dated note, task and reminder on its local day.</Text>
        </View>

        <View style={styles.monthCard}>
          <View style={styles.monthHeader}>
            <AppButton
              label="‹"
              onPress={() => changeMonth(-1)}
              style={styles.monthButton}
              variant="quiet"
            />
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <AppButton
              label="›"
              onPress={() => changeMonth(1)}
              style={styles.monthButton}
              variant="quiet"
            />
          </View>
          <View style={styles.weekdays}>
            {weekdays.map((day) => (
              <Text key={day} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.dayGrid}>
            {monthDays.map((date, index) => {
              if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;
              const key = localDateKey(date)!;
              const selected = key === selectedDate;
              const count = scheduledCounts.get(key) ?? 0;
              return (
                <Pressable
                  accessibilityLabel={`${formatCalendarDay(date)}${count ? `, ${count} items` : ''}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={key}
                  onPress={() => setSelectedDate(key)}
                  style={({ pressed }) => [
                    styles.dayCell,
                    selected && styles.dayCellSelected,
                    pressed && styles.dayCellPressed,
                  ]}
                >
                  <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>
                    {date.getDate()}
                  </Text>
                  {count ? (
                    <View style={[styles.dayBadge, selected && styles.dayBadgeSelected]} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.agendaHeader}>
          <View>
            <Text style={styles.agendaTitle}>Agenda</Text>
            <Text style={styles.agendaDate}>{formatCalendarDay(`${selectedDate}T12:00:00`)}</Text>
          </View>
          <AppButton
            label="Today"
            onPress={() => setSelectedDate(localDateKey(new Date()) ?? '')}
            variant="quiet"
          />
        </View>

        {actionsQuery.isPending ? <Text style={styles.copy}>Loading your schedule…</Text> : null}
        {actionsQuery.error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.error}>
              {actionsQuery.error instanceof Error
                ? actionsQuery.error.message
                : 'Unable to load the calendar.'}
            </Text>
            <AppButton
              label="Try again"
              onPress={() => actionsQuery.refetch()}
              variant="secondary"
            />
          </View>
        ) : null}
        {!actionsQuery.isPending && !selectedActions.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing planned for this day</Text>
            <Text style={styles.copy}>
              Add a date to a note or reminder and it will appear here.
            </Text>
            <AppButton
              label="Write a dated note"
              onPress={() => router.push('/note/new')}
              variant="secondary"
            />
          </View>
        ) : null}
        {calendarError ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.error}>{calendarError}</Text>
          </View>
        ) : null}
        <View style={styles.agendaList}>
          {selectedActions.map((action) => (
            <View key={action.id} style={styles.agendaItem}>
              <Pressable
                accessibilityLabel={`Open ${action.title}`}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/action/[id]', params: { id: action.id } })}
                style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
              >
                <View style={styles.timeBlock}>
                  <Text style={styles.time}>
                    {formatActionWhen(action.scheduled_at).split(', ').at(-1)}
                  </Text>
                  <Text style={styles.type}>{actionTypeLabel(action.action_type)}</Text>
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  {action.location ? (
                    <Text numberOfLines={1} style={styles.actionLocation}>
                      {action.location}
                    </Text>
                  ) : null}
                  {action.summary ? (
                    <Text numberOfLines={2} style={styles.actionSummary}>
                      {action.summary}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <AppButton
                accessibilityHint="Downloads an .ics file you can open in your own calendar app."
                label="Add to my calendar"
                onPress={() => addToOwnCalendar(action)}
                style={styles.calendarButton}
                variant="quiet"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { gap: 18, paddingBottom: 32, paddingTop: 24 },
    header: { gap: 5 },
    eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
    title: {
      color: colors.ink,
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1.1,
      lineHeight: 40,
    },
    copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
    monthCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      gap: 12,
      padding: 14,
    },
    monthHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    monthTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
    monthButton: { minHeight: 36, minWidth: 40, paddingHorizontal: 0 },
    weekdays: { flexDirection: 'row' },
    weekday: { color: colors.muted, flex: 1, fontSize: 11, fontWeight: '900', textAlign: 'center' },
    dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: {
      alignItems: 'center',
      borderRadius: 12,
      height: 46,
      justifyContent: 'center',
      width: '14.2857%',
    },
    dayCellSelected: { backgroundColor: colors.brand },
    dayCellPressed: { opacity: 0.76 },
    dayNumber: { color: colors.ink, fontSize: 14, fontWeight: '800' },
    dayNumberSelected: { color: colors.surface },
    dayBadge: {
      backgroundColor: colors.accent,
      borderRadius: 3,
      height: 6,
      marginTop: 3,
      width: 6,
    },
    dayBadgeSelected: { backgroundColor: '#FDE68A' },
    agendaHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    agendaTitle: { color: colors.ink, fontSize: 21, fontWeight: '900' },
    agendaDate: { color: colors.muted, fontSize: 13, marginTop: 2 },
    agendaList: { gap: 10 },
    agendaItem: { gap: 2 },
    calendarButton: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 4 },
    actionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 13,
      padding: 15,
    },
    actionCardPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
    timeBlock: { alignItems: 'flex-start', gap: 4, minWidth: 70 },
    time: { color: colors.brand, fontSize: 13, fontWeight: '900' },
    type: { color: colors.muted, fontSize: 11, fontWeight: '800' },
    actionCopy: { flex: 1, gap: 3 },
    actionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', lineHeight: 22 },
    actionLocation: { color: colors.brand, fontSize: 13, fontWeight: '800', lineHeight: 19 },
    actionSummary: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    empty: { backgroundColor: colors.accentSoft, borderRadius: 18, gap: 10, padding: 18 },
    emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
    errorCard: { backgroundColor: colors.dangerSoft, borderRadius: 16, gap: 10, padding: 14 },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
