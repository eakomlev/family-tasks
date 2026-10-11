// Цвет оценки: пятёрка зелёная, четвёрка салатовая, тройка жёлтая, двойка красная.
const TONES: Record<number, string> = { 5: '#2e9e57', 4: '#8bc34a', 3: '#f2b01e', 2: '#e5484d' }

export const gradeTone = (grade: number) => TONES[grade] ?? 'var(--accent)'
