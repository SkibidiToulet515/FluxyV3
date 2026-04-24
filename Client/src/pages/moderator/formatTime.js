export default function formatTime(ts) {
  if (!ts) return '\u2014';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch {
    return '\u2014';
  }
}
