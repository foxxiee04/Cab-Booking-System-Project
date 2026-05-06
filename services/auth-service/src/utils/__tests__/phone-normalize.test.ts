import { toRegistrationPhoneDigits } from '../phone-normalize';

describe('toRegistrationPhoneDigits', () => {
  it('accepts domestic 10-digit', () => {
    expect(toRegistrationPhoneDigits('0901234567')).toBe('0901234567');
  });

  it('normalizes international +84', () => {
    expect(toRegistrationPhoneDigits('+84 901 234 567')).toBe('0901234567');
    expect(toRegistrationPhoneDigits('84901234567')).toBe('0901234567');
  });

  it('returns null for invalid inputs', () => {
    expect(toRegistrationPhoneDigits('')).toBeNull();
    expect(toRegistrationPhoneDigits('901234567')).toBeNull();
  });
});
