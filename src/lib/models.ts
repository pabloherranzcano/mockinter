export type Level = 'Junior' | 'Mid' | 'Senior';
export type English = 'yes' | 'no' | 'partial';
export type QType = 'mc' | 'fill' | 'order';
export type QStatus = 'pending' | 'reviewed' | 'discarded';
export type ReportReason = 'wrong_answer' | 'unclear' | 'typo' | 'suggestion' | 'other';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface Profile {
  id: string;
  display_name: string | null;
  role: 'user' | 'admin';
  target_role: string | null;
  level: Level | null;
  english: English | null;
  onboarded: boolean;
  xp: number;
  streak: number;
  last_day: string | null;
  day_xp: number;
  day_xp_date: string | null;
}

export interface Topic {
  id: string;
  role: string;
  role_name: string;
  name: string;
  position: number;
  is_english: boolean;
  active: boolean;
}

export interface Question {
  id: string;
  topic_id: string;
  level: Level;
  type: QType;
  prompt: string;
  /** Fragmento de código que se muestra encima de las opciones (opcional). */
  code: string | null;
  correct: string | null;
  wrong: string[];
  explanation: string | null;
  say_en: string | null;
  say_es: string | null;
  status: QStatus;
  active: boolean;
  updated_at?: string;
  /** Variante para entrevistas en español (null = usar la normal). */
  es_prompt?: string | null;
  es_correct?: string | null;
  es_wrong?: string[] | null;
  es_explanation?: string | null;
}

export interface Report {
  id: number;
  question_id: string;
  user_id: string | null;
  reason: ReportReason;
  comment: string | null;
  status: ReportStatus;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  questions?: Pick<Question, 'id' | 'prompt' | 'type' | 'level' | 'topic_id' | 'active'> | null;
}

export const ROLES: { code: string; name: string; desc: string }[] = [
  { code: 'ANG', name: 'Frontend Angular', desc: 'Componentes, RxJS, signals, testing' },
  { code: 'REA', name: 'Frontend React', desc: 'Hooks, estado, rendimiento, testing' },
  { code: 'CLD', name: 'Cloud / DevOps (AWS)', desc: 'AWS, redes, contenedores, CI/CD' },
  { code: 'BCK', name: 'Backend Java/Spring', desc: 'Java, Spring Boot, APIs, bases de datos' },
];

export const LEVELS: { code: Level; desc: string }[] = [
  { code: 'Junior', desc: 'Primer empleo o menos de 2 años. Empiezas cada tema por lo básico.' },
  { code: 'Mid', desc: 'Entre 2 y 5 años. Empiezas por el escalón Mid; el Junior queda abierto para repasar.' },
  { code: 'Senior', desc: 'Más de 5 años. Vas directo a lo avanzado, con los escalones anteriores abiertos.' },
];

export const ENGLISH_OPTIONS: { code: English; label: string; desc: string }[] = [
  { code: 'yes', label: 'Sí, en inglés', desc: 'Incluye el bloque de inglés de entrevista' },
  { code: 'partial', label: 'En parte o no lo sé', desc: 'Igual que en inglés, por si acaso' },
  { code: 'no', label: 'No, en español', desc: 'Sin bloque de inglés y con las frases de ejemplo en español' },
];

export const REASONS: { code: ReportReason; label: string }[] = [
  { code: 'wrong_answer', label: 'La respuesta correcta está mal' },
  { code: 'unclear', label: 'La pregunta o la explicación no se entiende' },
  { code: 'typo', label: 'Hay una errata' },
  { code: 'suggestion', label: 'Sugerencia de mejora' },
  { code: 'other', label: 'Otro' },
];

export const TYPE_LABELS: Record<QType, string> = {
  mc: 'Elegir respuesta', fill: 'Completar frase', order: 'Ordenar',
};

/** Bloques compartidos que se añaden al camino según el puesto. */
export const SHARED_BLOCKS: Record<string, string[]> = {
  ANG: ['FE', 'DEV'], REA: ['FE', 'DEV'], CLD: ['DEV'], BCK: ['DEV'],
};

export const BLOCK_LABELS: Record<string, string> = {
  ANG: 'Angular', REA: 'React', CLD: 'Cloud / DevOps', BCK: 'Backend',
  FE: 'Frontend', DEV: 'Desarrollo', COM: 'Para cualquier puesto',
};
