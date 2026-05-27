export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  hints: string[];
};

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const hints: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else hints.push('At least 8 characters');

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else hints.push('Mix upper & lower case');

  if (/\d/.test(password)) score += 1;
  else hints.push('Add a number');

  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else if (password.length >= 12) score += 1;
  else hints.push('Add a symbol (recommended)');

  const clamped = Math.min(4, Math.max(0, score)) as 0 | 1 | 2 | 3 | 4;

  const meta: Record<PasswordStrength['score'], { label: string; color: string }> = {
    0: { label: 'Too weak', color: '#EF4444' },
    1: { label: 'Weak', color: '#F59E0B' },
    2: { label: 'Fair', color: '#F59E0B' },
    3: { label: 'Good', color: '#10B981' },
    4: { label: 'Strong', color: '#10B981' },
  };

  return { score: clamped, ...meta[clamped], hints: hints.slice(0, 2) };
}
