import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import {
  type CreateHelpPostInput,
  createHelpPostSchema,
  helpPostQuerySchema,
  helpTypes,
  peoplePostsSchema,
  type UpdateHelpPostInput,
  updateHelpPostSchema,
  updateHelpPostStatusSchema
} from '@help-venezuela/shared';
import Fastify, { type FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDistanceKm } from './distance.js';
import { env } from './env.js';
import { prisma } from './prisma.js';

const app = Fastify({ logger: true });
let isShuttingDown = false;

function isPrivateNetworkHost(hostname: string) {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    return true;
  }

  if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) {
    return true;
  }

  const [firstPart, secondPart] = hostname.split('.').map(Number);
  return firstPart === 172 && secondPart >= 16 && secondPart <= 31;
}

function isAllowedCorsOrigin(origin: string | undefined) {
  if (!origin || origin === env.corsOrigin) {
    return true;
  }

  try {
    const url = new URL(origin);
    return url.port === '5173' && isPrivateNetworkHost(url.hostname);
  } catch {
    return false;
  }
}

await app.register(cors, {
  origin: (origin, callback) => {
    callback(null, isAllowedCorsOrigin(origin));
  }
});
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

app.addHook('onClose', async () => {
  await prisma.$disconnect();
});

async function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  await app.close();
  process.exit(0);
}

process.once('SIGINT', () => {
  void shutdown();
});

process.once('SIGTERM', () => {
  void shutdown();
});

app.get('/health', async () => ({ ok: true }));

app.get('/help-types', async () => helpTypes);

function normalizeIdentityCard(identityCard: string) {
  return identityCard.trim().toUpperCase().replace(/\s+/g, '');
}

function createPublicCoordinates(latitude: number, longitude: number) {
  return {
    publicLatitude: Math.round(latitude * 100) / 100,
    publicLongitude: Math.round(longitude * 100) / 100
  };
}

class LocationResolutionError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(errorCode: string, statusCode: number) {
    super(errorCode);
    this.name = 'LocationResolutionError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}

type LocationInput = CreateHelpPostInput | UpdateHelpPostInput;

type ResolvedLocation = {
  locationSource: 'ADDRESS' | 'CURRENT_LOCATION';
  state: string | null;
  city: string | null;
  address: string | null;
  referencePoint: string | null;
  locationLabel: string;
  latitude: number;
  longitude: number;
};

type NominatimPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

const openStreetMapHeaders = {
  'User-Agent': 'HelpVenezuela/0.1 (OpenStreetMap geocoding)'
};

function toNullableTrimmedValue(value: string | undefined) {
  const trimmedValue = value?.trim() ?? '';
  return trimmedValue ? trimmedValue : null;
}

function createAddressLocationLabel(input: { address: string; city: string; state: string; referencePoint?: string }) {
  const baseLabel = [input.address, input.city, input.state].map((item) => item.trim()).filter(Boolean).join(', ');
  const referencePoint = input.referencePoint?.trim();

  return referencePoint ? `${baseLabel}. Ref: ${referencePoint}` : baseLabel;
}

async function geocodeVenezuelaAddress(input: { address: string; city: string; state: string }) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 've',
    addressdetails: '1',
    q: [input.address, input.city, input.state, 'Venezuela'].join(', ')
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: openStreetMapHeaders
  });

  if (!response.ok) {
    throw new LocationResolutionError('GEOCODING_REQUEST_FAILED', 502);
  }

  const [place] = (await response.json()) as NominatimPlace[];
  const latitude = place ? Number(place.lat) : Number.NaN;
  const longitude = place ? Number(place.lon) : Number.NaN;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new LocationResolutionError('LOCATION_NOT_FOUND', 400);
  }

  return {
    latitude,
    longitude
  };
}

async function resolveLocation(input: LocationInput): Promise<ResolvedLocation> {
  if (input.locationSource === 'CURRENT_LOCATION') {
    return {
      locationSource: input.locationSource,
      state: toNullableTrimmedValue(input.state),
      city: toNullableTrimmedValue(input.city),
      address: toNullableTrimmedValue(input.address),
      referencePoint: toNullableTrimmedValue(input.referencePoint),
      locationLabel: 'Ubicación actual indicada',
      latitude: input.latitude,
      longitude: input.longitude
    };
  }

  const coordinates = await geocodeVenezuelaAddress({
    address: input.address,
    city: input.city,
    state: input.state
  });

  return {
    locationSource: input.locationSource,
    state: input.state,
    city: input.city,
    address: input.address,
    referencePoint: toNullableTrimmedValue(input.referencePoint),
    locationLabel: createAddressLocationLabel(input),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude
  };
}

function sendLocationResolutionError(error: unknown, reply: FastifyReply) {
  if (error instanceof LocationResolutionError) {
    return reply.code(error.statusCode).send({ error: error.errorCode });
  }

  throw error;
}

function doTimeRangesOverlap(
  first: { timeFrom: string | null; timeTo: string | null },
  second: { timeFrom: string | null; timeTo: string | null }
) {
  if (!first.timeFrom || !first.timeTo || !second.timeFrom || !second.timeTo) {
    return true;
  }

  return first.timeFrom < second.timeTo && second.timeFrom < first.timeTo;
}

function toPublicHelpPost(helpPost: {
  id: string;
  kind: 'NEED' | 'OFFER';
  locationLabel: string;
  publicLatitude: number;
  publicLongitude: number;
  timeFrom: string | null;
  timeTo: string | null;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  description: string;
  status: 'ACTIVE' | 'HIDDEN' | 'CLOSED' | 'DELETED' | 'REPORTED';
  createdAt: Date;
  helpTypes: Array<{ helpType: { slug: string; name: string } }>;
}) {
  return {
    id: helpPost.id,
    kind: helpPost.kind,
    locationLabel: helpPost.locationLabel,
    publicLatitude: helpPost.publicLatitude,
    publicLongitude: helpPost.publicLongitude,
    timeFrom: helpPost.timeFrom,
    timeTo: helpPost.timeTo,
    urgency: helpPost.urgency,
    status: helpPost.status,
    descriptionPreview: helpPost.description.slice(0, 140),
    helpTypes: helpPost.helpTypes.map((item) => item.helpType.slug),
    createdAt: helpPost.createdAt
  };
}

function toOwnerHelpPost(helpPost: {
  id: string;
  kind: 'NEED' | 'OFFER';
  name: string;
  contact: string;
  locationSource: 'ADDRESS' | 'CURRENT_LOCATION';
  state: string | null;
  city: string | null;
  address: string | null;
  referencePoint: string | null;
  locationLabel: string;
  latitude: number;
  longitude: number;
  timeFrom: string | null;
  timeTo: string | null;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  description: string;
  status: 'ACTIVE' | 'HIDDEN' | 'CLOSED' | 'DELETED' | 'REPORTED';
  createdAt: Date;
  updatedAt: Date;
  helpTypes: Array<{ helpType: { slug: string; name: string } }>;
}) {
  return {
    id: helpPost.id,
    kind: helpPost.kind,
    name: helpPost.name,
    contact: helpPost.contact,
    locationSource: helpPost.locationSource,
    state: helpPost.state,
    city: helpPost.city,
    address: helpPost.address,
    referencePoint: helpPost.referencePoint,
    locationLabel: helpPost.locationLabel,
    latitude: helpPost.latitude,
    longitude: helpPost.longitude,
    timeFrom: helpPost.timeFrom,
    timeTo: helpPost.timeTo,
    urgency: helpPost.urgency,
    description: helpPost.description,
    status: helpPost.status,
    helpTypeSlugs: helpPost.helpTypes.map((item) => item.helpType.slug),
    helpTypes: helpPost.helpTypes,
    createdAt: helpPost.createdAt,
    updatedAt: helpPost.updatedAt
  };
}

const addressSuggestionQuerySchema = z.object({
  query: z.string().trim().min(2).max(120),
  state: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional()
}).strict();

const geocodeQuerySchema = z.object({
  address: z.string().trim().min(3).max(180),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80)
}).strict();

app.get('/locations/address-suggestions', async (request, reply) => {
  const parsed = addressSuggestionQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return reply.code(400).send({ error: 'INVALID_QUERY', details: parsed.error.flatten() });
  }

  const queryParts = [parsed.data.query, parsed.data.city, parsed.data.state, 'Venezuela'].filter(Boolean);
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '5',
    countrycodes: 've',
    addressdetails: '1',
    q: queryParts.join(', ')
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: openStreetMapHeaders
  });

  if (!response.ok) {
    return reply.code(502).send({ error: 'AUTOCOMPLETE_REQUEST_FAILED' });
  }

  const places = (await response.json()) as NominatimPlace[];

  return places.map((place) => ({
    description: place.display_name,
    placeId: String(place.place_id)
  }));
});

app.get('/locations/geocode', async (request, reply) => {
  const parsed = geocodeQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return reply.code(400).send({ error: 'INVALID_QUERY', details: parsed.error.flatten() });
  }

  try {
    return await geocodeVenezuelaAddress(parsed.data);
  } catch (error) {
    return sendLocationResolutionError(error, reply);
  }
});

app.post('/help-posts', async (request, reply) => {
  const parsed = createHelpPostSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({ error: 'INVALID_PAYLOAD', details: parsed.error.flatten() });
  }

  const input = parsed.data;
  const identityCard = normalizeIdentityCard(input.identityCard);
  let resolvedLocation: ResolvedLocation;

  try {
    resolvedLocation = await resolveLocation(input);
  } catch (error) {
    return sendLocationResolutionError(error, reply);
  }

  const publicCoordinates = createPublicCoordinates(resolvedLocation.latitude, resolvedLocation.longitude);
  const existingTypes = await prisma.helpType.findMany({
    where: { slug: { in: input.helpTypeSlugs } }
  });

  if (existingTypes.length !== new Set(input.helpTypeSlugs).size) {
    return reply.code(400).send({ error: 'INVALID_HELP_TYPES' });
  }

  const person = await prisma.person.upsert({
    where: { identityCard },
    update: { name: input.name, contact: input.contact },
    create: { identityCard, name: input.name, contact: input.contact }
  });

  const helpPost = await prisma.helpPost.create({
    data: {
      personId: person.id,
      kind: input.kind,
      name: input.name,
      contact: input.contact,
      locationSource: resolvedLocation.locationSource,
      state: resolvedLocation.state,
      city: resolvedLocation.city,
      address: resolvedLocation.address,
      referencePoint: resolvedLocation.referencePoint,
      locationLabel: resolvedLocation.locationLabel,
      latitude: resolvedLocation.latitude,
      longitude: resolvedLocation.longitude,
      publicLatitude: publicCoordinates.publicLatitude,
      publicLongitude: publicCoordinates.publicLongitude,
      timeFrom: input.timeFrom,
      timeTo: input.timeTo,
      urgency: input.kind === 'NEED' ? input.urgency ?? 'MEDIUM' : null,
      description: input.description,
      helpTypes: {
        create: existingTypes.map((helpType) => ({
          helpType: { connect: { id: helpType.id } }
        }))
      }
    },
    include: { helpTypes: { include: { helpType: true } } }
  });

  return reply.code(201).send({ helpPost: toOwnerHelpPost(helpPost) });
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

  return posts.map(toPublicHelpPost);
});

app.get('/help-posts/map', async (request, reply) => {
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

  return posts.map(toPublicHelpPost);
});

app.post('/people/posts', async (request, reply) => {
  const parsed = peoplePostsSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({ error: 'INVALID_PAYLOAD', details: parsed.error.flatten() });
  }

  const person = await prisma.person.findUnique({
    where: { identityCard: normalizeIdentityCard(parsed.data.identityCard) },
    include: {
      helpPosts: {
        where: { status: { not: 'DELETED' } },
        include: { helpTypes: { include: { helpType: true } } },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  return person ? person.helpPosts.map(toOwnerHelpPost) : [];
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

  if (helpPost.status !== 'ACTIVE') {
    return reply.code(404).send({ error: 'NOT_FOUND' });
  }

  return {
    ...toPublicHelpPost(helpPost),
    contact: helpPost.contact,
    description: helpPost.description
  };
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
      helpTypes: {
        some: {
          helpType: { slug: { in: sourceSlugs } }
        }
      }
    },
    include: { helpTypes: { include: { helpType: true } } }
  });

  return candidates
    .filter((candidate) => doTimeRangesOverlap(source, candidate))
    .map((candidate) => {
      const distanceKm = getDistanceKm(source, candidate);
      const overlapCount = candidate.helpTypes.filter((item) => sourceSlugs.includes(item.helpType.slug)).length;

      return { ...toPublicHelpPost(candidate), distanceKm, overlapCount };
    })
    .filter((candidate) => candidate.distanceKm <= 25)
    .sort((a, b) => a.distanceKm - b.distanceKm || b.overlapCount - a.overlapCount);
});

app.patch('/help-posts/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = updateHelpPostSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({ error: 'INVALID_PAYLOAD', details: parsed.error.flatten() });
  }

  const input = parsed.data;
  const identityCard = normalizeIdentityCard(input.identityCard);
  const helpPost = await prisma.helpPost.findUnique({
    where: { id },
    include: { person: true }
  });

  if (!helpPost) {
    return reply.code(404).send({ error: 'NOT_FOUND' });
  }

  if (helpPost.person.identityCard !== identityCard) {
    return reply.code(403).send({ error: 'FORBIDDEN' });
  }

  const existingTypes = await prisma.helpType.findMany({
    where: { slug: { in: input.helpTypeSlugs } }
  });

  if (existingTypes.length !== new Set(input.helpTypeSlugs).size) {
    return reply.code(400).send({ error: 'INVALID_HELP_TYPES' });
  }

  let resolvedLocation: ResolvedLocation;

  try {
    resolvedLocation = await resolveLocation(input);
  } catch (error) {
    return sendLocationResolutionError(error, reply);
  }

  const publicCoordinates = createPublicCoordinates(resolvedLocation.latitude, resolvedLocation.longitude);
  const updatedHelpPost = await prisma.helpPost.update({
    where: { id },
    data: {
      name: input.name,
      contact: input.contact,
      locationSource: resolvedLocation.locationSource,
      state: resolvedLocation.state,
      city: resolvedLocation.city,
      address: resolvedLocation.address,
      referencePoint: resolvedLocation.referencePoint,
      locationLabel: resolvedLocation.locationLabel,
      latitude: resolvedLocation.latitude,
      longitude: resolvedLocation.longitude,
      publicLatitude: publicCoordinates.publicLatitude,
      publicLongitude: publicCoordinates.publicLongitude,
      timeFrom: input.timeFrom,
      timeTo: input.timeTo,
      urgency: helpPost.kind === 'NEED' ? input.urgency ?? 'MEDIUM' : null,
      description: input.description,
      helpTypes: {
        deleteMany: {},
        create: existingTypes.map((helpType) => ({
          helpType: { connect: { id: helpType.id } }
        }))
      }
    },
    include: { helpTypes: { include: { helpType: true } } }
  });

  return toOwnerHelpPost(updatedHelpPost);
});

app.patch('/help-posts/:id/status', async (request, reply) => {
  const { id } = request.params as { id: string };
  const parsed = updateHelpPostStatusSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({ error: 'INVALID_PAYLOAD', details: parsed.error.flatten() });
  }

  const helpPost = await prisma.helpPost.findUnique({
    where: { id },
    include: { person: true }
  });

  if (!helpPost) {
    return reply.code(404).send({ error: 'NOT_FOUND' });
  }

  if (helpPost.person.identityCard !== normalizeIdentityCard(parsed.data.identityCard)) {
    return reply.code(403).send({ error: 'FORBIDDEN' });
  }

  await prisma.helpPost.update({ where: { id }, data: { status: parsed.data.status } });
  return reply.code(204).send();
});

app.delete('/help-posts/:id', async (_request, reply) => reply.code(410).send({ error: 'TOKEN_DELETE_DISABLED' }));

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
