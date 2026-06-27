import type { CreateHelpPostInput } from '@help-venezuela/shared';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type HelpPost = {
  id: string;
  kind: 'NEED' | 'OFFER';
  name: string;
  contact: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  dateFrom: string;
  dateTo: string;
  timeSlot: string;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  helpTypes: Array<{ helpType: { slug: string; name: string } }>;
};

export async function getHelpPosts() {
  const response = await fetch(`${apiUrl}/help-posts`);

  if (!response.ok) {
    throw new Error('No se pudieron cargar las publicaciones');
  }

  return response.json() as Promise<HelpPost[]>;
}

export async function createHelpPost(input: CreateHelpPostInput) {
  const response = await fetch(`${apiUrl}/help-posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error('No se pudo crear la publicación');
  }

  return response.json() as Promise<{ helpPost: HelpPost; deleteToken: string }>;
}
