const normalizeSex = (sex: string) => sex.trim().toLowerCase();

export const resolveSubject = (sex: string): string => {
  const normalized = normalizeSex(sex);
  if (normalized === 'female') return 'exactly one adult woman';
  if (normalized === 'male') return 'exactly one adult man';
  return 'exactly one adult person';
};

export const resolveSubjectStrict = (sex: string): string => `Single solo portrait of ${resolveSubject(sex)}`;
