import { helpTypes, type CreateHelpPostInput } from '@help-venezuela/shared';
import { HandHeart, MapPin, RefreshCw, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createHelpPost, getHelpPosts, type HelpPost } from './api';

type HelpPostForm = CreateHelpPostInput & {
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
};

const initialForm: HelpPostForm = {
  kind: 'NEED',
  name: '',
  contact: '',
  locationLabel: '',
  latitude: 10.4806,
  longitude: -66.9036,
  dateFrom: '',
  dateTo: '',
  timeSlot: '',
  urgency: 'MEDIUM',
  description: '',
  helpTypeSlugs: [] as string[]
};

export function App() {
  const [posts, setPosts] = useState<HelpPost[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function loadPosts() {
    setIsLoading(true);
    try {
      setPosts(await getHelpPosts());
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPosts();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await createHelpPost(form);
    setMessage(`Publicación creada. Guarda este token para cerrar/borrar: ${response.deleteToken}`);
    setForm(initialForm);
    await loadPosts();
  }

  function toggleHelpType(slug: string) {
    setForm((current) => ({
      ...current,
      helpTypeSlugs: current.helpTypeSlugs.includes(slug)
        ? current.helpTypeSlugs.filter((item) => item !== slug)
        : [...current.helpTypeSlugs, slug]
    }));
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Ayuda coordinada</p>
          <h1>Help Venezuela</h1>
        </div>
        <button className="icon-button" onClick={() => void loadPosts()} type="button" aria-label="Recargar publicaciones">
          <RefreshCw size={20} />
        </button>
      </section>

      <section className="layout">
        <form className="panel form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="section-title">
            <HandHeart size={20} />
            <h2>Publicar ayuda</h2>
          </div>

          <div className="segmented">
            <button
              className={form.kind === 'NEED' ? 'active' : ''}
              onClick={() => setForm((current) => ({ ...current, kind: 'NEED' }))}
              type="button"
            >
              Necesito ayuda
            </button>
            <button
              className={form.kind === 'OFFER' ? 'active' : ''}
              onClick={() => setForm((current) => ({ ...current, kind: 'OFFER' }))}
              type="button"
            >
              Quiero ayudar
            </button>
          </div>

          <label>
            Nombre o alias
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>

          <label>
            Contacto o WhatsApp
            <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} required />
          </label>

          <label>
            Zona o referencia
            <input
              value={form.locationLabel}
              onChange={(event) => setForm({ ...form, locationLabel: event.target.value })}
              required
            />
          </label>

          <div className="grid-two">
            <label>
              Latitud
              <input
                type="number"
                step="0.000001"
                value={form.latitude}
                onChange={(event) => setForm({ ...form, latitude: Number(event.target.value) })}
                required
              />
            </label>
            <label>
              Longitud
              <input
                type="number"
                step="0.000001"
                value={form.longitude}
                onChange={(event) => setForm({ ...form, longitude: Number(event.target.value) })}
                required
              />
            </label>
          </div>

          <div className="grid-two">
            <label>
              Desde
              <input
                type="date"
                value={form.dateFrom}
                onChange={(event) => setForm({ ...form, dateFrom: event.target.value })}
                required
              />
            </label>
            <label>
              Hasta
              <input type="date" value={form.dateTo} onChange={(event) => setForm({ ...form, dateTo: event.target.value })} required />
            </label>
          </div>

          <label>
            Horario
            <input
              placeholder="Ej: mañana, tarde, 09:00-13:00"
              value={form.timeSlot}
              onChange={(event) => setForm({ ...form, timeSlot: event.target.value })}
              required
            />
          </label>

          {form.kind === 'NEED' && (
            <label>
              Urgencia
              <select value={form.urgency} onChange={(event) => setForm({ ...form, urgency: event.target.value as typeof form.urgency })}>
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
              </select>
            </label>
          )}

          <fieldset>
            <legend>Tipos de ayuda</legend>
            <div className="chips">
              {helpTypes.map((type) => (
                <button
                  className={form.helpTypeSlugs.includes(type.slug) ? 'chip selected' : 'chip'}
                  key={type.slug}
                  onClick={() => toggleHelpType(type.slug)}
                  type="button"
                >
                  {type.name}
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            Descripción
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
          </label>

          <button className="primary-button" type="submit">
            <Send size={18} />
            Publicar
          </button>
          {message && <p className="notice">{message}</p>}
        </form>

        <section className="panel feed">
          <div className="section-title">
            <MapPin size={20} />
            <h2>Publicaciones activas</h2>
          </div>
          <div className="map-placeholder">Mapa pendiente: Leaflet queda instalado para la siguiente iteración.</div>
          {isLoading ? <p>Cargando...</p> : null}
          <div className="post-list">
            {posts.map((post) => (
              <article className="post-card" key={post.id}>
                <div className="post-head">
                  <strong>{post.kind === 'NEED' ? 'Necesita ayuda' : 'Ofrece ayuda'}</strong>
                  {post.urgency && <span>{post.urgency}</span>}
                </div>
                <h3>{post.locationLabel}</h3>
                <p>{post.description}</p>
                <small>{post.helpTypes.map((item) => item.helpType.name).join(', ')}</small>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
