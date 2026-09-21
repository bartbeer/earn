import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colors, minTouchTarget, radii } from '@/lib/theme';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
}

const BOX_SIZE = 28;
// hitSlop pads the touch target out to the accessible minimum without
// changing the box's visual size (master spec section 31).
const HIT_SLOP = (minTouchTarget - BOX_SIZE) / 2;

/**
 * A large, immediate checkbox. Completion is shown by shape (empty square vs.
 * filled square with a checkmark), never by color alone (master spec section 89).
 */
export function Checkbox({ checked, onToggle, accessibilityLabel }: CheckboxProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={HIT_SLOP}
      style={[styles.box, checked ? styles.boxChecked : styles.boxUnchecked]}
    >
      {checked ? <Ionicons name="checkmark" size={20} color={colors.surface} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxUnchecked: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  boxChecked: {
    backgroundColor: colors.primary,
  },
});
