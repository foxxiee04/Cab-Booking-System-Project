/**
 * Detects HTML/script injection attempts in plain-text input fields.
 *
 * Returns true when the value contains characters or patterns that have no
 * legitimate use in a name, address, or similar text field:
 *   - < or > (HTML tag delimiters)
 *   - javascript: (URI injection)
 *   - on*= event handler attributes (onclick=, onerror=, …)
 *
 * Password/OTP fields must NOT be passed through here — they may legitimately
 * contain special characters and are hashed immediately.
 */
export function containsScript(value: string): boolean {
  return /[<>]|javascript\s*:/i.test(value) || /on\w+\s*=/i.test(value);
}

export const SCRIPT_ERROR_MSG = 'Không được chứa mã HTML hoặc script';
