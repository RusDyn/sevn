import { StyleSheet, Text, View } from 'react-native';

export type EmptyQueueStateProps = {
  position?: number;
  message?: string;
};

export const EmptyQueueState = ({
  position,
  message = 'You are all caught up. Add a task to keep your streak alive.',
}: EmptyQueueStateProps) => (
  <View
    style={[styles.container, position ? styles.withPosition : null]}
    accessibilityRole="text"
    accessibilityLabel={`Empty queue slot${position ? ` at position ${position}` : ''}`}
  >
    {position ? <Text style={styles.positionLabel}>#{position}</Text> : null}
    <Text style={styles.message}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#0b1224',
    borderColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  withPosition: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-start',
  },
  positionLabel: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '700',
  },
  message: {
    color: '#cbd5e1',
    fontSize: 14,
    flexShrink: 1,
  },
});
