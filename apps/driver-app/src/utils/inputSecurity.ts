export function containsScript(value: string): boolean {
  return /[<>]|javascript\s*:/i.test(value) || /on\w+\s*=/i.test(value);
}

export const SCRIPT_ERROR_MSG = 'Không được chứa mã HTML hoặc script';
