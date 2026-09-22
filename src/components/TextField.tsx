import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, minTouchTarget, radii, spacing, typography } from '@/lib/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

/** A labeled text input matching the app's card/border language. */
export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={typography.secondaryMeta}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: '#B3261E',
  },
  errorText: {
    fontSize: 13,
    color: '#B3261E',
  },
});
