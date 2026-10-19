const dateLabelFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const formatDateLabel = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const label = dateLabelFormatter.format(new Date(year, month - 1, day));
  return label.charAt(0).toUpperCase() + label.slice(1);
};
