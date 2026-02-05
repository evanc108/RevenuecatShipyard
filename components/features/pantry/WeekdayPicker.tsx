import { memo, useMemo, useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

type WeekdayPickerProps = {
  selectedDate: string;
  onDateChange: (date: string) => void;
};

const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function WeekdayPickerComponent({
  selectedDate,
  onDateChange,
}: WeekdayPickerProps): React.ReactElement {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = useMemo(() => new Date(), []);

  const days = useMemo(() => {
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      return {
        key: formatDate(d),
        dayAbbr: DAY_ABBREVIATIONS[d.getDay()] ?? '',
        dateNum: d.getDate(),
        isToday: isSameDay(d, today),
        month: d.getMonth(),
        year: d.getFullYear(),
      };
    });
  }, [today, weekOffset]);

  const firstDay = days[0];
  const monthLabel = firstDay
    ? `${MONTH_NAMES[firstDay.month]} ${firstDay.year}`
    : '';

  const handlePrevWeek = useCallback(() => {
    setWeekOffset((prev) => prev - 1);
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekOffset((prev) => prev + 1);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header row: month + arrows */}
      <View style={styles.header}>
        <Text style={styles.monthTitle}>{monthLabel}</Text>
        <View style={styles.arrowRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous week"
            onPress={handlePrevWeek}
            hitSlop={8}
            style={styles.arrowButton}
          >
            <Icon name="chevron-left" size={20} color={Colors.text.inverse} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next week"
            onPress={handleNextWeek}
            hitSlop={8}
            style={styles.arrowButton}
          >
            <Icon name="chevron-right" size={20} color={Colors.text.inverse} />
          </Pressable>
        </View>
      </View>

      {/* Day pills */}
      <View style={styles.pillContainer}>
        {days.map((day) => {
          const isSelected = selectedDate === day.key;
          return (
            <Pressable
              key={day.key}
              accessibilityRole="button"
              accessibilityLabel={`${day.dayAbbr} ${day.dateNum}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onDateChange(day.key)}
              style={[styles.pill, isSelected && styles.pillSelected]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  isSelected && styles.dayLabelSelected,
                ]}
              >
                {day.dayAbbr}
              </Text>
              <Text
                style={[
                  styles.dateNum,
                  isSelected && styles.dateNumSelected,
                ]}
              >
                {day.dateNum}
              </Text>
              <View
                style={[
                  styles.todayDot,
                  day.isToday && !isSelected && styles.todayDotVisible,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  monthTitle: {
    ...Typography.h2,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  arrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  arrowButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background.secondary,
  },
  pillSelected: {
    backgroundColor: Colors.accent,
  },
  dayLabel: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginBottom: 2,
  },
  dayLabelSelected: {
    color: Colors.text.inverse,
  },
  dateNum: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  dateNumSelected: {
    color: Colors.text.inverse,
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  todayDotVisible: {
    backgroundColor: Colors.accent,
  },
});

export const WeekdayPicker = memo(WeekdayPickerComponent);
