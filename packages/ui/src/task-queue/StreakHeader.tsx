import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type StreakHeaderProps = {
  count: number;
  label?: string;
  accessory?: ReactNode;
};

export const StreakHeader = ({ count, label = 'Day streak', accessory }: StreakHeaderProps) => (
  <View style={styles.container} accessibilityRole="header">
    <View style={styles.badge} accessibilityLabel={`${count} ${label}`}>
      <Text style={styles.badgeCount}>{count}</Text>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
    {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badge: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  badgeCount: {
    color: '#f1f5f9',
    fontWeight: '800',
    fontSize: 20,
  },
  badgeLabel: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  accessory: {
    marginLeft: 12,
    flex: 1,
  },
});
