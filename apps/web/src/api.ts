import type { CreateHelpPostInput, UpdateHelpPostInput } from '@help-venezuela/shared';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type HelpPostStatus = 'ACTIVE' | 'HIDDEN' | 'CLOSED' | 'DELETED' | 'REPORTED';

export type ApiErrorPayload = {
  error?: string;
  message?: string;
  details?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[]>;
  };
};

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload | null;

  constructor(status: number, fallbackMessage: string, payload: ApiErrorPayload | null) {
    super(payload?.message ?? payload?.error ?? fallbackMessage);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export type HelpPost = {
  id: string;
  kind: 'NEED' | 'OFFER';
  name: string;
  contact: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  timeFrom: string | null;
  timeTo: string | null;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  description: string;
  status: HelpPostStatus;
  helpTypeSlugs: string[];
  helpTypes: Array<{ helpType: { slug: string; name: string } }>;
};

export type PublicMapPost = {
  id: string;
  kind: 'NEED' | 'OFFER';
  locationLabel: string;
  publicLatitude: number;
  publicLongitude: number;
  timeFrom: string | null;
  timeTo: string | null;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  status: HelpPostStatus;
  descriptionPreview: string;
  helpTypes: string[];
  createdAt: string;
};

async function createApiError(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? ((await response.json().catch(() => null)) as ApiErrorPayload | null)
    : null;

  return new ApiError(response.status, fallbackMessage, payload);
}

export async function getMapHelpPosts() {
  const response = await fetch(`${apiUrl}/help-posts/map`);

  if (!response.ok) {
    throw await createApiError(response, 'No se pudieron cargar las publicaciones');
  }

  return response.json() as Promise<PublicMapPost[]>;
}

export async function createHelpPost(input: CreateHelpPostInput) {
  const response = await fetch(`${apiUrl}/help-posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw await createApiError(response, 'No se pudo crear la publicacion');
  }

  return response.json() as Promise<{ helpPost: HelpPost }>;
}

export async function getPersonPosts(identityCard: string) {
  const response = await fetch(`${apiUrl}/people/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityCard })
  });

  if (!response.ok) {
    throw await createApiError(response, 'No se pudieron cargar tus publicaciones');
  }

  return response.json() as Promise<HelpPost[]>;
}

export async function updateHelpPost(id: string, input: UpdateHelpPostInput) {
  const response = await fetch(`${apiUrl}/help-posts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw await createApiError(response, 'No se pudo actualizar la publicacion');
  }

  return response.json() as Promise<HelpPost>;
}

export async function updateHelpPostStatus(id: string, identityCard: string, status: HelpPostStatus) {
  const response = await fetch(`${apiUrl}/help-posts/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityCard, status })
  });

  if (!response.ok) {
    throw await createApiError(response, 'No se pudo cambiar el estado');
  }
}
