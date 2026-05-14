/**
 * Format a raw digit string with spaces every 3 digits.
 * Example: "555123456" -> "555 123 456"
 */
export function formatPhoneDigits(digits: string): string {
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ');
}

/**
 * Strip non-digits from a string and limit to maxLength.
 */
export function extractDigits(text: string, maxLength: number = 9): string {
  return text.replace(/[^0-9]/g, '').slice(0, maxLength);
}
