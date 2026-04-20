export function formatRelativeDate(value) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays <= 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return `Hace ${diffDays}d`;
}

export function formatShortDate(value) {
  const date = new Date(value);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export function average(numbers) {
  if (!numbers.length) return 0;
  return numbers.reduce((acc, item) => acc + item, 0) / numbers.length;
}
