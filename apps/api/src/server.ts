import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createHelpPostSchema, helpPostQuerySchema, helpTypes } from '@help-venezuela/shared';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { getDistanceKm } from './distance.js';
import { env } from './env.js';
import { prisma } from './prisma.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.corsOrigin });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

app.get('/health', async () => ({ ok: true }));

app.get('/help-types', async () => helpTypes);

app.post('/help-posts', async (request, reply) => {
  const parsed = createHelpPostSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({ error: 'INVALID_PAYLOAD', details: parsed.error.flatten() });
  }

  const input = parsed.data;
  const deleteToken = randomUUID();
  const existingTypes = await prisma.helpType.findMany({
    where: { slug: { in: input.helpTypeSlugs } }
  });

  const helpPost = await prisma.helpPost.create({
    data: {
      kind: input.kind,
      name: input.name,
      contact: input.contact,
      locationLabel: input.locationLabel,
      latitude: input.latitude,
      longitude: input.longitude,
      dateFrom: new Date(input.dateFrom),
      dateTo: new Date(input.dateTo),
      timeSlot: input.timeSlot,
      urgency: input.kind === 'NEED' ? input.urgency ?? 'MEDIUM' : null,
      description: input.description,
      deleteToken,
      helpTypes: {
        create: existingTypes.map((helpType) => ({
          helpType: { connect: { id: helpType.id } }
        }))
      }
    },
    include: { helpTypes: { include: { helpType: true } } }
  });

  return reply.code(201).send({ helpPost, deleteToken });
});

app.get('/help-posts', async (request, reply) => {
  const parsed = helpPostQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return reply.code(400).send({ error: 'INVALID_QUERY', details: parsed.error.flatten() });
  }

  const posts = await prisma.helpPost.findMany({
    where: {
      status: 'ACTIVE',
      kind: parsed.data.kind,
      urgency: parsed.data.urgency,
      helpTypes: parsed.data.helpType
        ? {
            some: {
              helpType: { slug: parsed.data.helpType }
            }
          }
        : undefined
    },
    include: { helpTypes: { include: { helpType: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return posts;
});

app.get('/help-posts/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const helpPost = await prisma.helpPost.findUnique({
    where: { id },
    include: { helpTypes: { include: { helpType: true } } }
  });

  if (!helpPost) {
    return reply.code(404).send({ error: 'NOT_FOUND' });
  }

  return helpPost;
});

app.get('/help-posts/:id/matches', async (request, reply) => {
  const { id } = request.params as { id: string };
  const source = await prisma.helpPost.findUnique({
    where: { id },
    include: { helpTypes: { include: { helpType: true } } }
  });

  if (!source) {
    return reply.code(404).send({ error: 'NOT_FOUND' });
  }

  const sourceSlugs = source.helpTypes.map((item) => item.helpType.slug);
  const candidates = await prisma.helpPost.findMany({
    where: {
      id: { not: source.id },
      status: 'ACTIVE',
      kind: source.kind === 'NEED' ? 'OFFER' : 'NEED',
      dateFrom: { lte: source.dateTo },
      dateTo: { gte: source.dateFrom },
      helpTypes: {
        some: {
          helpType: { slug: { in: sourceSlugs } }
        }
      }
    },
    include: { helpTypes: { include: { helpType: true } } }
  });

  return candidates
    .map((candidate) => {
      const distanceKm = getDistanceKm(source, candidate);
      const overlapCount = candidate.helpTypes.filter((item) => sourceSlugs.includes(item.helpType.slug)).length;

      return { ...candidate, distanceKm, overlapCount };
    })
    .filter((candidate) => candidate.distanceKm <= 25)
    .sort((a, b) => a.distanceKm - b.distanceKm || b.overlapCount - a.overlapCount);
});

app.delete('/help-posts/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { token } = request.query as { token?: string };

  if (!token) {
    return reply.code(400).send({ error: 'TOKEN_REQUIRED' });
  }

  const helpPost = await prisma.helpPost.findUnique({ where: { id } });

  if (!helpPost || helpPost.deleteToken !== token) {
    return reply.code(404).send({ error: 'NOT_FOUND' });
  }

  await prisma.helpPost.update({ where: { id }, data: { status: 'CLOSED' } });
  return reply.code(204).send();
});

for (const helpType of helpTypes) {
  await prisma.helpType.upsert({
    where: { slug: helpType.slug },
    update: { name: helpType.name },
    create: helpType
  });
}

try {
  await app.listen({ port: env.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
