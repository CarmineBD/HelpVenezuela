import { z } from 'zod';

export const locationSources = ['ADDRESS', 'CURRENT_LOCATION'] as const;

export const venezuelaStates = [
  'Amazonas',
  'Anzoátegui',
  'Apure',
  'Aragua',
  'Barinas',
  'Bolívar',
  'Carabobo',
  'Cojedes',
  'Delta Amacuro',
  'Dependencias Federales',
  'Distrito Capital',
  'Falcón',
  'Guárico',
  'La Guaira',
  'Lara',
  'Mérida',
  'Miranda',
  'Monagas',
  'Nueva Esparta',
  'Portuguesa',
  'Sucre',
  'Táchira',
  'Trujillo',
  'Yaracuy',
  'Zulia'
] as const;

export const venezuelaCitiesByState = {
  Amazonas: ['Puerto Ayacucho'],
  Anzoátegui: ['Anaco', 'Barcelona', 'El Tigre', 'Guanta', 'Lechería', 'Puerto La Cruz'],
  Apure: ['Achaguas', 'Biruaca', 'Guasdualito', 'San Fernando de Apure'],
  Aragua: ['Cagua', 'El Consejo', 'La Victoria', 'Maracay', 'Santa Cruz de Aragua', 'Turmero', 'Villa de Cura'],
  Barinas: ['Barinas', 'Sabaneta', 'Santa Bárbara de Barinas', 'Socopó'],
  Bolívar: ['Caicara del Orinoco', 'Ciudad Bolívar', 'Ciudad Guayana', 'Puerto Ordaz', 'San Félix', 'Tumeremo', 'Upata'],
  Carabobo: ['Bejuma', 'Guacara', 'Mariara', 'Naguanagua', 'Puerto Cabello', 'San Diego', 'Tocuyito', 'Valencia'],
  Cojedes: ['San Carlos', 'Tinaquillo'],
  'Delta Amacuro': ['Tucupita'],
  'Dependencias Federales': ['Los Roques'],
  'Distrito Capital': ['Caracas'],
  Falcón: ['Chichiriviche', 'Coro', 'La Vela de Coro', 'Punto Fijo'],
  Guárico: ['Altagracia de Orituco', 'Calabozo', 'San Juan de los Morros', 'Valle de la Pascua'],
  'La Guaira': ['Caraballeda', 'Catia La Mar', 'La Guaira', 'Macuto', 'Maiquetía'],
  Lara: ['Barquisimeto', 'Cabudare', 'Carora', 'El Tocuyo', 'Quíbor'],
  Mérida: ['Ejido', 'El Vigía', 'Mérida', 'Tovar'],
  Miranda: [
    'Baruta',
    'Carrizal',
    'Chacao',
    'Charallave',
    'Cúa',
    'El Hatillo',
    'Guarenas',
    'Guatire',
    'Higuerote',
    'Los Teques',
    'Ocumare del Tuy',
    'Petare',
    'Río Chico',
    'San Antonio de los Altos',
    'Santa Lucía',
    'Santa Teresa del Tuy'
  ],
  Monagas: ['Maturín', 'Punta de Mata', 'Temblador'],
  'Nueva Esparta': ['Juan Griego', 'La Asunción', 'Pampatar', 'Porlamar'],
  Portuguesa: ['Acarigua', 'Araure', 'Guanare', 'Ospino'],
  Sucre: ['Cariaco', 'Carúpano', 'Cumaná', 'Güiria'],
  Táchira: ['Colón', 'La Fría', 'Rubio', 'San Cristóbal', 'Táriba'],
  Trujillo: ['Boconó', 'Trujillo', 'Valera'],
  Yaracuy: ['Chivacoa', 'Nirgua', 'San Felipe', 'Yaritagua'],
  Zulia: ['Cabimas', 'Ciudad Ojeda', 'Lagunillas', 'Machiques', 'Maracaibo', 'Santa Rita', 'Villa del Rosario']
} as const satisfies Record<(typeof venezuelaStates)[number], readonly string[]>;

export const helpTypes = [
  { slug: 'food', name: 'Donar comida' },
  { slug: 'transport', name: 'Transporte' },
  { slug: 'clothes', name: 'Donar ropa' },
  { slug: 'shelter', name: 'Proporcionar alojamiento' },
  { slug: 'cleaning', name: 'Ayudar a limpiar' },
  { slug: 'rubble', name: 'Ayudar a levantar escombros' },
  { slug: 'medicine', name: 'Medicinas' }
] as const;

export const helpTypeSlugs = helpTypes.map((type) => type.slug);

export const helpPostKindSchema = z.enum(['NEED', 'OFFER']);
export const helpPostStatusSchema = z.enum(['ACTIVE', 'HIDDEN', 'CLOSED', 'DELETED', 'REPORTED']);
export const urgencySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const locationSourceSchema = z.enum(locationSources);
export const identityCardSchema = z
  .string()
  .min(5)
  .max(20)
  .regex(/^[VE]-?\d{5,12}$/i, 'Formato de cedula invalido');
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato horario invalido');
const spanishPersonNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(
    /^[A-Za-zÁÉÍÓÚáéíóúÑñ]+(?: [A-Za-zÁÉÍÓÚáéíóúÑñ]+)*$/,
    'Usa solo letras, espacios, tildes en vocales y la ñ'
  );

const venezuelaStateSet = new Set<string>(venezuelaStates);
const venezuelaCityByStateSets = new Map<string, Set<string>>(
  Object.entries(venezuelaCitiesByState).map(([state, cities]) => [state, new Set(cities)])
);

export function isVenezuelaState(value: string): value is (typeof venezuelaStates)[number] {
  return venezuelaStateSet.has(value);
}

export function isVenezuelaCityForState(state: string, city: string) {
  return venezuelaCityByStateSets.get(state.trim())?.has(city.trim()) ?? false;
}

const referencePointSchema = z.string().trim().max(150).optional().default('');

const addressLocationSchema = z.object({
  locationSource: z.literal('ADDRESS'),
  state: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(3).max(180),
  referencePoint: referencePointSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

const currentLocationSchema = z.object({
  locationSource: z.literal('CURRENT_LOCATION'),
  state: z.string().trim().max(80).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  address: z.string().trim().max(180).optional().default(''),
  referencePoint: referencePointSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

const locationSchema = z.discriminatedUnion('locationSource', [addressLocationSchema, currentLocationSchema]);

const timeRangeSchema = z.object({
  timeFrom: timeSchema.nullable(),
  timeTo: timeSchema.nullable()
});

function validateTimeRange(value: { timeFrom: string | null; timeTo: string | null }, context: z.RefinementCtx) {
    const hasTimeFrom = value.timeFrom !== null;
    const hasTimeTo = value.timeTo !== null;

    if (hasTimeFrom !== hasTimeTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debes indicar inicio y fin, o marcar cualquier momento',
        path: hasTimeFrom ? ['timeTo'] : ['timeFrom']
      });
      return;
    }

    if (value.timeFrom && value.timeTo && value.timeFrom >= value.timeTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La hora de inicio debe ser menor que la hora de fin',
        path: ['timeFrom']
      });
    }
}

const helpPostBaseSchema = z
  .object({
    kind: helpPostKindSchema,
    name: spanishPersonNameSchema,
    surnames: spanishPersonNameSchema,
    contact: z.string().min(5).max(80),
    urgency: urgencySchema.optional(),
    description: z.string().min(10).max(500),
    helpTypeSlugs: z.array(z.string()).min(1)
  })
  .merge(timeRangeSchema);

const updateHelpPostBaseSchema = helpPostBaseSchema.omit({ kind: true });

function validateLocationRules(value: z.infer<typeof locationSchema>, context: z.RefinementCtx) {
    if (value.locationSource === 'ADDRESS') {
      if (!isVenezuelaState(value.state)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Selecciona un estado valido de Venezuela',
          path: ['state']
        });
      }

      if (!isVenezuelaCityForState(value.state, value.city)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Selecciona una ciudad valida para el estado indicado',
          path: ['city']
        });
      }
    }
}

function validateHelpPostBusinessRules(value: z.infer<typeof helpPostBaseSchema> & z.infer<typeof locationSchema>, context: z.RefinementCtx) {
    validateTimeRange(value, context);
    validateLocationRules(value, context);

    if (value.kind === 'NEED' && !value.urgency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La urgencia es requerida para solicitudes de ayuda',
        path: ['urgency']
      });
    }
}

export const createHelpPostSchema = z.discriminatedUnion('locationSource', [
  helpPostBaseSchema.merge(addressLocationSchema).extend({ identityCard: identityCardSchema }).strict(),
  helpPostBaseSchema.merge(currentLocationSchema).extend({ identityCard: identityCardSchema }).strict()
])
  .superRefine(validateHelpPostBusinessRules);

export const updateHelpPostSchema = z.discriminatedUnion('locationSource', [
  updateHelpPostBaseSchema.merge(addressLocationSchema).extend({ identityCard: identityCardSchema }).strict(),
  updateHelpPostBaseSchema.merge(currentLocationSchema).extend({ identityCard: identityCardSchema }).strict()
])
  .superRefine((value, context) => {
    validateTimeRange(value, context);
    validateLocationRules(value, context);
  })
;

export const peoplePostsSchema = z.object({
  identityCard: identityCardSchema
}).strict();

export const updateHelpPostStatusSchema = z.object({
  identityCard: identityCardSchema,
  status: z.enum(['ACTIVE', 'HIDDEN', 'CLOSED', 'DELETED'])
}).strict();

export const helpPostQuerySchema = z.object({
  kind: helpPostKindSchema.optional(),
  helpType: z.string().optional(),
  urgency: urgencySchema.optional()
});

export type HelpTypeSlug = (typeof helpTypes)[number]['slug'];
export type LocationSource = (typeof locationSources)[number];
export type CreateHelpPostInput = z.infer<typeof createHelpPostSchema>;
export type UpdateHelpPostInput = z.infer<typeof updateHelpPostSchema>;
export type HelpPostQuery = z.infer<typeof helpPostQuerySchema>;
