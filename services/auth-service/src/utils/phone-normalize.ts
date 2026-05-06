/**
 * OTP keys in Redis use the same string as registration (Joi: `0xxxxxxxxx`).
 * Dev lookup must accept +84 / 84… / 0… so Postman matches the web app.
 */
export function toRegistrationPhoneDigits(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('0')) {
    return d;
  }
  if (d.length === 11 && d.startsWith('84')) {
    return `0${d.slice(2)}`;
  }
  return null;
}
