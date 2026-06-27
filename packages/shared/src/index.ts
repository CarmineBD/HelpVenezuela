import { z } from 'zod';

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
export const identityCardSchema = z
  .string()
  .min(5)
  .max(20)
  .regex(/^[VE]-?\d{5,12}$/i, 'Formato de cedula invalido');
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato horario invalido');

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

const helpPostFieldsSchema = z
  .object({
    kind: helpPostKindSchema,
    name: z.string().min(2).max(80),
    contact: z.string().min(5).max(80),
    locationLabel: z.string().min(3).max(140),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    urgency: urgencySchema.optional(),
    description: z.string().min(10).max(500),
    helpTypeSlugs: z.array(z.string()).min(1)
  })
  .merge(timeRangeSchema);

function validateHelpPostBusinessRules(value: z.infer<typeof helpPostFieldsSchema>, context: z.RefinementCtx) {
    validateTimeRange(value, context);

    if (value.kind === 'NEED' && !value.urgency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La urgencia es requerida para solicitudes de ayuda',
        path: ['urgency']
      });
    }
}

export const createHelpPostSchema = helpPostFieldsSchema
  .extend({
    identityCard: identityCardSchema
  })
  .strict()
  .superRefine(validateHelpPostBusinessRules);

export const updateHelpPostSchema = helpPostFieldsSchema
  .omit({ kind: true })
  .extend({
    identityCard: identityCardSchema
  })
  .strict()
  .superRefine(validateTimeRange);

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
export type CreateHelpPostInput = z.infer<typeof createHelpPostSchema>;
export type UpdateHelpPostInput = z.infer<typeof updateHelpPostSchema>;
export type HelpPostQuery = z.infer<typeof helpPostQuerySchema>;
