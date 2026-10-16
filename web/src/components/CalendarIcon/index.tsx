// Значок календаря с сегодняшним числом: лист с цветной шапкой и двумя кольцами
export function CalendarIcon({ day }: { day: number }) {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden focusable="false">
      <rect x="5" y="9" width="38" height="34" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
      <path d="M5 21V17a8 8 0 0 1 8-8h22a8 8 0 0 1 8 8v4z" fill="var(--accent)" />
      <path d="M15 4v8M33 4v8" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <text x="24" y="38" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--text)" fontFamily="inherit">
        {day}
      </text>
    </svg>
  )
}
