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
export const urgencySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const createHelpPostSchema = z.object({
  kind: helpPostKindSchema,
  name: z.string().min(2).max(80),
  contact: z.string().min(5).max(80),
  locationLabel: z.string().min(3).max(140),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  timeSlot: z.string().min(3).max(80),
  urgency: urgencySchema.optional(),
  description: z.string().min(10).max(1000),
  helpTypeSlugs: z.array(z.string()).min(1)
});

export const helpPostQuerySchema = z.object({
  kind: helpPostKindSchema.optional(),
  helpType: z.string().optional(),
  urgency: urgencySchema.optional()
});

export type HelpTypeSlug = (typeof helpTypes)[number]['slug'];
export type CreateHelpPostInput = z.infer<typeof createHelpPostSchema>;
export type HelpPostQuery = z.infer<typeof helpPostQuerySchema>;
