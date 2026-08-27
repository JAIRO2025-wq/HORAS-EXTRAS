// Catálogo de tipos de falta para amonestaciones / llamados de atención.
// Base legal según el Código de Trabajo de El Salvador.

export type FaltaCatalogo = {
  id: string;
  tipo: string;
  motivo: string; // Asunto resumido (AMONESTACIÓN ESCRITA POR ...)
  art31: string; // Ordinales del Art. 31 (obligaciones)
  art32: string; // Ordinales del Art. 32 (prohibiciones)
  art50: string; // Ordinales del Art. 50 (despido)
  ejemplo: string; // Texto de ejemplo para "Hechos constatados"
};

export const ORDINALES_ART31: Record<string, string> = {
  '2°': 'Guardar la debida consideración y respeto a sus patronos, representantes, compañeros de labores y demás personas que se encuentren en el establecimiento.',
  '5°': 'Cumplir con las órdenes e instrucciones que reciba del patrono, de sus representantes o de sus superiores jerárquicos, en lo relativo al desempeño de su trabajo.',
  '6°': 'Cuidar los instrumentos, útiles, herramientas, maquinarias y materiales que se le confíen para el desempeño de sus labores.',
  '10°': 'Observar rigurosa puntualidad en las horas de entrada y salida del trabajo y en la asistencia a sus labores.',
};

export const ORDINALES_ART32: Record<string, string> = {
  '2°': 'Faltar al trabajo o abandonarlo en horas de labores, sin permiso del patrono o sin causa justificada.',
  '5°': 'Ejecutar el trabajo en forma defectuosa, con negligencia o descuido, o con calidad inferior a la pactada.',
};

export const ORDINALES_ART50: Record<string, string> = {
  '9°': 'Desobedecer reiteradamente las órdenes e instrucciones del patrono o de sus representantes.',
  '11°': 'Ineficiencia o ineptitud manifiesta del trabajador en el desempeño de sus labores.',
  '12°': 'Faltar a sus labores sin permiso del patrono o sin causa justificada, durante dos días laborales completos y consecutivos, o durante tres días no consecutivos en un mismo mes calendario.',
  '13°': 'Dañar o perjudicar, por dolo o negligencia grave, los edificios, obras, maquinarias, herramientas o demás bienes del patrono.',
};

export const CATALOGO_FALTAS: FaltaCatalogo[] = [
  {
    id: 'inasistencia',
    tipo: 'Inasistencia',
    motivo: 'INASISTENCIA SIN JUSTIFICACIÓN',
    art31: '2° y 10°',
    art32: '2°',
    art50: '12°',
    ejemplo: 'No se presentó a sus labores sin permiso previo ni causa justificada, pese a no haber notificado a su jefatura inmediata.',
  },
  {
    id: 'retardo',
    tipo: 'Retardo / Impuntualidad',
    motivo: 'RETARDO / IMPUNTUALIDAD',
    art31: '10°',
    art32: '2°',
    art50: '12°',
    ejemplo: 'Se presentó a sus labores con retraso, sin justificación previa ni posterior, incumpliendo el horario establecido.',
  },
  {
    id: 'mal_rendimiento',
    tipo: 'Mal rendimiento',
    motivo: 'MAL RENDIMIENTO / EJECUCIÓN DEFECTUOSA',
    art31: '5°',
    art32: '5°',
    art50: '11°',
    ejemplo: 'Ejecutó su trabajo en forma defectuosa o con negligencia, sin cumplir con la calidad pactada para sus funciones.',
  },
  {
    id: 'desobediencia',
    tipo: 'Desobediencia',
    motivo: 'DESOBEDIENCIA A ÓRDENES',
    art31: '5°',
    art32: '',
    art50: '9°',
    ejemplo: 'Desobedeció las órdenes e instrucciones impartidas por su jefatura inmediata en el desempeño de sus funciones.',
  },
  {
    id: 'mal_uso_equipo',
    tipo: 'Mal uso de equipo',
    motivo: 'MAL USO DE EQUIPO / HERRAMIENTAS',
    art31: '6°',
    art32: '',
    art50: '13°',
    ejemplo: 'Hizo mal uso de las herramientas, maquinarias o materiales confiados para el desempeño de sus labores.',
  },
  {
    id: 'otro',
    tipo: 'Otro (personalizado)',
    motivo: '',
    art31: '',
    art32: '',
    art50: '',
    ejemplo: '',
  },
];
