import { helpTypes, type CreateHelpPostInput, type UpdateHelpPostInput } from '@help-venezuela/shared';
import L from 'leaflet';
import { ArrowLeft, Eye, EyeOff, HandHeart, LifeBuoy, MapPin, Pencil, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  createHelpPost,
  getMapHelpPosts,
  getPersonPosts,
  updateHelpPost,
  updateHelpPostStatus,
  type HelpPost,
  type HelpPostStatus,
  type PublicMapPost
} from './api';

type FormKind = 'NEED' | 'OFFER';

type HelpPostForm = CreateHelpPostInput & {
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
};

const descriptionMaxLength = 500;

function createInitialForm(kind: FormKind): HelpPostForm {
  return {
    identityCard: '',
    kind,
    name: '',
    contact: '',
    locationLabel: '',
    latitude: 10.4806,
    longitude: -66.9036,
    timeFrom: null,
    timeTo: null,
    urgency: 'MEDIUM',
    description: '',
    helpTypeSlugs: []
  };
}

function createFormFromPost(post: HelpPost, identityCard: string): HelpPostForm {
  return {
    identityCard,
    kind: post.kind,
    name: post.name,
    contact: post.contact,
    locationLabel: post.locationLabel,
    latitude: post.latitude,
    longitude: post.longitude,
    timeFrom: post.timeFrom,
    timeTo: post.timeTo,
    urgency: post.urgency ?? 'MEDIUM',
    description: post.description,
    helpTypeSlugs: post.helpTypeSlugs
  };
}

function getCurrentPath() {
  return window.location.pathname;
}

function getTimeLabel(post: { timeFrom: string | null; timeTo: string | null }) {
  return post.timeFrom && post.timeTo ? `${post.timeFrom} - ${post.timeTo}` : 'Cualquier momento';
}

function getStatusLabel(status: HelpPostStatus) {
  const labels: Record<HelpPostStatus, string> = {
    ACTIVE: 'Visible',
    HIDDEN: 'Oculta',
    CLOSED: 'Cerrada',
    DELETED: 'Eliminada',
    REPORTED: 'Reportada'
  };

  return labels[status];
}

function toUpdateInput(form: HelpPostForm): UpdateHelpPostInput {
  return {
    identityCard: form.identityCard,
    name: form.name,
    contact: form.contact,
    locationLabel: form.locationLabel,
    latitude: form.latitude,
    longitude: form.longitude,
    timeFrom: form.timeFrom,
    timeTo: form.timeTo,
    urgency: form.urgency,
    description: form.description,
    helpTypeSlugs: form.helpTypeSlugs
  };
}

function createMarkerIcon(kind: PublicMapPost['kind']) {
  return L.divIcon({
    className: '',
    html: `<span class="map-marker ${kind === 'NEED' ? 'need' : 'offer'}">${kind === 'NEED' ? 'N' : 'O'}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18]
  });
}

export function App() {
  const [path, setPath] = useState(getCurrentPath);
  const formKind = useMemo<FormKind | null>(() => {
    if (path === '/formulario/ayudar') {
      return 'OFFER';
    }

    if (path === '/formulario/ser-ayudado') {
      return 'NEED';
    }

    return null;
  }, [path]);
  const [form, setForm] = useState<HelpPostForm>(() => createInitialForm(formKind ?? 'NEED'));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [mapPosts, setMapPosts] = useState<PublicMapPost[]>([]);
  const [ownerIdentityCard, setOwnerIdentityCard] = useState('');
  const [ownerPosts, setOwnerPosts] = useState<HelpPost[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<HelpPostForm | null>(null);
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    function syncPath() {
      setPath(getCurrentPath());
    }

    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  useEffect(() => {
    if (formKind) {
      setForm(createInitialForm(formKind));
      setMessage('');
      setError('');
    }
  }, [formKind]);

  useEffect(() => {
    if (path !== '/mapa') {
      return;
    }

    getMapHelpPosts()
      .then(setMapPosts)
      .catch(() => setError('No se pudo cargar el mapa de publicaciones.'));
  }, [path]);

  useEffect(() => {
    if (path !== '/mapa' || !mapCanvasRef.current) {
      return;
    }

    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapCanvasRef.current, {
        center: [8.0019, -66.1109],
        zoom: 6
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(leafletMapRef.current);
      markerLayerRef.current = L.layerGroup().addTo(leafletMapRef.current);
    }

    const map = leafletMapRef.current;
    const markerLayer = markerLayerRef.current;
    markerLayer?.clearLayers();

    window.setTimeout(() => map.invalidateSize(), 0);

    if (mapPosts.length === 0) {
      map.setView([8.0019, -66.1109], 6);
      return;
    }

    const bounds = L.latLngBounds([]);
    mapPosts.forEach((post) => {
      const position: L.LatLngTuple = [post.publicLatitude, post.publicLongitude];
      bounds.extend(position);
      L.marker(position, { icon: createMarkerIcon(post.kind), title: post.locationLabel })
        .bindPopup(
          `<strong>${post.kind === 'NEED' ? 'Necesita ayuda' : 'Ofrece ayuda'}</strong><br>${post.locationLabel}<br>${getTimeLabel(post)}`
        )
        .addTo(markerLayer ?? map);
    });

    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
  }, [path, mapPosts]);

  useEffect(() => {
    if (path === '/mapa') {
      return;
    }

    leafletMapRef.current?.remove();
    leafletMapRef.current = null;
    markerLayerRef.current = null;
  }, [path]);

  function navigate(nextPath: string) {
    window.history.pushState(null, '', nextPath);
    setPath(nextPath);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      await createHelpPost(form);
      setMessage('Publicacion creada. Puedes gestionarla desde Mis publicaciones usando tu cedula.');
      setForm(createInitialForm(form.kind));
    } catch {
      setError('No se pudo crear la publicacion. Revisa los campos e intenta otra vez.');
    }
  }

  async function loadOwnerPosts(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setMessage('');
    setError('');
    setEditingPostId(null);
    setEditingForm(null);

    try {
      const posts = await getPersonPosts(ownerIdentityCard);
      setOwnerPosts(posts);
      setMessage(posts.length ? '' : 'No hay publicaciones asociadas a esa cedula.');
    } catch {
      setError('No se pudieron cargar tus publicaciones.');
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingForm || !editingPostId) {
      return;
    }

    setMessage('');
    setError('');

    try {
      await updateHelpPost(editingPostId, toUpdateInput(editingForm));
      setMessage('Publicacion actualizada.');
      setEditingPostId(null);
      setEditingForm(null);
      await loadOwnerPosts();
    } catch {
      setError('No se pudo actualizar la publicacion.');
    }
  }

  async function changeStatus(postId: string, status: HelpPostStatus) {
    setMessage('');
    setError('');

    try {
      await updateHelpPostStatus(postId, ownerIdentityCard, status);
      await loadOwnerPosts();
    } catch {
      setError('No se pudo cambiar el estado de la publicacion.');
    }
  }

  function toggleHelpType(slug: string, targetForm: HelpPostForm, setTargetForm: (nextForm: HelpPostForm) => void) {
    setTargetForm({
      ...targetForm,
      helpTypeSlugs: targetForm.helpTypeSlugs.includes(slug)
        ? targetForm.helpTypeSlugs.filter((item) => item !== slug)
        : [...targetForm.helpTypeSlugs, slug]
    });
  }

  function renderPostForm(
    targetForm: HelpPostForm,
    setTargetForm: (nextForm: HelpPostForm) => void,
    onSubmit: (event: FormEvent<HTMLFormElement>) => void,
    options: { isEditing: boolean }
  ) {
    const isNeedForm = targetForm.kind === 'NEED';
    const isAnyTime = targetForm.timeFrom === null && targetForm.timeTo === null;

    return (
      <form className="panel form" onSubmit={onSubmit}>
        <div className="section-title">
          {isNeedForm ? <LifeBuoy size={20} /> : <HandHeart size={20} />}
          <div>
            <p className="eyebrow">{isNeedForm ? 'Solicitud de ayuda' : 'Oferta voluntaria'}</p>
            <h1>{isNeedForm ? 'Ser ayudado' : 'Ayudar'}</h1>
          </div>
        </div>

        {!options.isEditing && (
          <label>
            Cedula de identidad
            <input
              placeholder="Ej: V-12345678"
              value={targetForm.identityCard}
              onChange={(event) => setTargetForm({ ...targetForm, identityCard: event.target.value })}
              required
            />
          </label>
        )}

        {options.isEditing && (
          <p className="locked-field">Cedula usada para gestionar: {targetForm.identityCard}. No se puede editar.</p>
        )}

        <label>
          Nombre o alias
          <input value={targetForm.name} onChange={(event) => setTargetForm({ ...targetForm, name: event.target.value })} required />
        </label>

        <label>
          Contacto o WhatsApp
          <input
            value={targetForm.contact}
            onChange={(event) => setTargetForm({ ...targetForm, contact: event.target.value })}
            required
          />
        </label>

        <label>
          Zona o referencia
          <input
            value={targetForm.locationLabel}
            onChange={(event) => setTargetForm({ ...targetForm, locationLabel: event.target.value })}
            required
          />
        </label>

        <div className="grid-two">
          <label>
            Latitud
            <input
              type="number"
              step="0.000001"
              value={targetForm.latitude}
              onChange={(event) => setTargetForm({ ...targetForm, latitude: Number(event.target.value) })}
              required
            />
          </label>
          <label>
            Longitud
            <input
              type="number"
              step="0.000001"
              value={targetForm.longitude}
              onChange={(event) => setTargetForm({ ...targetForm, longitude: Number(event.target.value) })}
              required
            />
          </label>
        </div>

        <label className="switch-row">
          <input
            checked={isAnyTime}
            onChange={(event) =>
              setTargetForm({
                ...targetForm,
                timeFrom: event.target.checked ? null : '08:00',
                timeTo: event.target.checked ? null : '18:00'
              })
            }
            type="checkbox"
          />
          Cualquier momento
        </label>

        {!isAnyTime && (
          <div className="grid-two">
            <label>
              Inicio
              <input
                type="time"
                value={targetForm.timeFrom ?? ''}
                onChange={(event) => setTargetForm({ ...targetForm, timeFrom: event.target.value })}
                required
              />
            </label>
            <label>
              Fin
              <input
                type="time"
                value={targetForm.timeTo ?? ''}
                onChange={(event) => setTargetForm({ ...targetForm, timeTo: event.target.value })}
                required
              />
            </label>
          </div>
        )}

        {isNeedForm && (
          <label>
            Urgencia
            <select
              value={targetForm.urgency}
              onChange={(event) => setTargetForm({ ...targetForm, urgency: event.target.value as typeof targetForm.urgency })}
            >
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
            </select>
          </label>
        )}

        <fieldset>
          <legend>{isNeedForm ? 'Que ayudas necesitas?' : 'Que ayudas puedes ofrecer?'}</legend>
          <div className="chips">
            {helpTypes.map((type) => (
              <button
                className={targetForm.helpTypeSlugs.includes(type.slug) ? 'chip selected' : 'chip'}
                key={type.slug}
                onClick={() => toggleHelpType(type.slug, targetForm, setTargetForm)}
                type="button"
              >
                {type.name}
              </button>
            ))}
          </div>
        </fieldset>

        <label>
          Descripcion
          <textarea
            maxLength={descriptionMaxLength}
            value={targetForm.description}
            onChange={(event) => setTargetForm({ ...targetForm, description: event.target.value })}
            required
          />
          <span className="character-count">
            {targetForm.description.length}/{descriptionMaxLength}
          </span>
        </label>

        <button className="primary-button" type="submit">
          <Send size={18} />
          {options.isEditing ? 'Guardar cambios' : isNeedForm ? 'Solicitar ayuda' : 'Ofrecer ayuda'}
        </button>
      </form>
    );
  }

  if (path === '/mapa') {
    return (
      <main className="map-shell">
        <header className="map-header">
          <button className="back-button" onClick={() => navigate('/')} type="button">
            <ArrowLeft size={18} />
            Volver
          </button>
          <div>
            <p className="eyebrow">Vista publica</p>
            <h1>Mapa de ayuda</h1>
          </div>
        </header>

        <section className="map-fullscreen" aria-label="Mapa de puntos de ayuda">
          <div className="leaflet-map" ref={mapCanvasRef} />
          <aside className="map-posts-panel">
            <h2>Publicaciones visibles</h2>
            {mapPosts.length === 0 && <p>No hay publicaciones activas todavia.</p>}
            {mapPosts.map((post) => (
              <article className="map-post-card" key={post.id}>
                <div className="post-head">
                  <strong>{post.kind === 'NEED' ? 'Necesita ayuda' : 'Ofrece ayuda'}</strong>
                  <span>{post.urgency ?? 'Oferta'}</span>
                </div>
                <p>{post.locationLabel}</p>
                <small>{getTimeLabel(post)}</small>
                <p>{post.descriptionPreview}</p>
                <small>
                  Punto publico: {post.publicLatitude}, {post.publicLongitude}
                </small>
              </article>
            ))}
          </aside>
          <div className="map-status">
            <MapPin size={18} />
            <span>Los puntos se muestran de forma aproximada para proteger a las personas.</span>
          </div>
        </section>
      </main>
    );
  }

  if (path === '/mis-publicaciones') {
    return (
      <main className="app-shell">
        <section className="owner-page">
          <button className="back-button" onClick={() => navigate('/')} type="button">
            <ArrowLeft size={18} />
            Volver
          </button>

          <form className="panel form" onSubmit={(event) => void loadOwnerPosts(event)}>
            <div className="section-title">
              <Pencil size={20} />
              <div>
                <p className="eyebrow">Gestion por cedula</p>
                <h1>Mis publicaciones</h1>
              </div>
            </div>
            <label>
              Cedula de identidad
              <input
                placeholder="Ej: V-12345678"
                value={ownerIdentityCard}
                onChange={(event) => setOwnerIdentityCard(event.target.value)}
                required
              />
            </label>
            <button className="primary-button" type="submit">
              Buscar publicaciones
            </button>
          </form>

          {editingForm && (
            <section>
              {renderPostForm(editingForm, setEditingForm, (event) => void handleEditSubmit(event), { isEditing: true })}
            </section>
          )}

          <section className="post-list">
            {ownerPosts.map((post) => (
              <article className="panel post-card" key={post.id}>
                <div className="post-head">
                  <strong>{post.kind === 'NEED' ? 'Solicitud' : 'Oferta'}</strong>
                  <span>{getStatusLabel(post.status)}</span>
                </div>
                <h3>{post.locationLabel}</h3>
                <p>{post.description}</p>
                <small>{getTimeLabel(post)}</small>
                <div className="actions-row">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setEditingPostId(post.id);
                      setEditingForm(createFormFromPost(post, ownerIdentityCard));
                    }}
                    type="button"
                  >
                    <Pencil size={16} />
                    Editar
                  </button>
                  <button className="secondary-button" onClick={() => void changeStatus(post.id, 'ACTIVE')} type="button">
                    <Eye size={16} />
                    Mostrar
                  </button>
                  <button className="secondary-button" onClick={() => void changeStatus(post.id, 'HIDDEN')} type="button">
                    <EyeOff size={16} />
                    Ocultar
                  </button>
                  <button className="danger-button" onClick={() => void changeStatus(post.id, 'DELETED')} type="button">
                    <Trash2 size={16} />
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </section>

          {message && <p className="notice">{message}</p>}
          {error && <p className="notice error">{error}</p>}
        </section>
      </main>
    );
  }

  if (!formKind) {
    return (
      <main className="home-shell">
        <section className="home-content">
          <h1>Help Venezuela</h1>
          <p>Que necesitas?</p>
          <div className="choice-grid">
            <button className="choice-card" onClick={() => navigate('/formulario/ayudar')} type="button">
              <HandHeart size={32} />
              <span>Ayudar</span>
            </button>
            <button className="choice-card" onClick={() => navigate('/formulario/ser-ayudado')} type="button">
              <LifeBuoy size={32} />
              <span>Ser ayudado</span>
            </button>
          </div>
          <div className="home-links">
            <a
              className="home-map-link"
              href="/mapa"
              onClick={(event) => {
                event.preventDefault();
                navigate('/mapa');
              }}
            >
              <MapPin size={18} />
              Ver mapa
            </a>
            <a
              className="home-map-link"
              href="/mis-publicaciones"
              onClick={(event) => {
                event.preventDefault();
                navigate('/mis-publicaciones');
              }}
            >
              <Pencil size={18} />
              Mis publicaciones
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="form-page">
        <button className="back-button" onClick={() => navigate('/')} type="button">
          <ArrowLeft size={18} />
          Volver
        </button>

        {renderPostForm(form, setForm, (event) => void handleSubmit(event), { isEditing: false })}

        {message && <p className="notice">{message}</p>}
        {error && <p className="notice error">{error}</p>}
      </section>
    </main>
  );
}
