export function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Fecha de hoy en Madrid como 'YYYY-MM-DD' (la misma que usa la base de datos para la racha). */
export function todayMadrid(now = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

export function yesterdayMadrid(now = new Date()): string {
  return todayMadrid(new Date(now.getTime() - 864e5));
}

/** Parece código (para usar fuente monoespaciada en una opción). */
export function looksLikeCode(t: string): boolean {
  return /[(){};=<>]|=>|\.\w+\(/.test(t) && !/[áéíóúñ¿]/i.test(t);
}
