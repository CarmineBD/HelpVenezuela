import { helpTypes, type CreateHelpPostInput } from '@help-venezuela/shared';
import { ArrowLeft, HandHeart, LifeBuoy, Send } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createHelpPost } from './api';

type HelpPostForm = CreateHelpPostInput & {
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
};

type FormKind = 'NEED' | 'OFFER';

function createInitialForm(kind: FormKind): HelpPostForm {
  return {
    kind,
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
    helpTypeSlugs: []
  };
}

function getCurrentPath() {
  return window.location.pathname;
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

  function navigate(nextPath: string) {
    window.history.pushState(null, '', nextPath);
    setPath(nextPath);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await createHelpPost(form);
      setMessage(`Publicacion creada. Guarda este token para cerrar o borrar: ${response.deleteToken}`);
      setForm(createInitialForm(form.kind));
    } catch {
      setError('No se pudo crear la publicacion. Revisa los campos e intenta otra vez.');
    }
  }

  function toggleHelpType(slug: string) {
    setForm((current) => ({
      ...current,
      helpTypeSlugs: current.helpTypeSlugs.includes(slug)
        ? current.helpTypeSlugs.filter((item) => item !== slug)
        : [...current.helpTypeSlugs, slug]
    }));
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
        </section>
      </main>
    );
  }

  const isNeedForm = formKind === 'NEED';

  return (
    <main className="app-shell">
      <section className="form-page">
        <button className="back-button" onClick={() => navigate('/')} type="button">
          <ArrowLeft size={18} />
          Volver
        </button>

        <form className="panel form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="section-title">
            {isNeedForm ? <LifeBuoy size={20} /> : <HandHeart size={20} />}
            <div>
              <p className="eyebrow">{isNeedForm ? 'Solicitud de ayuda' : 'Oferta voluntaria'}</p>
              <h1>{isNeedForm ? 'Ser ayudado' : 'Ayudar'}</h1>
            </div>
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
              placeholder="Ej: manana, tarde, 09:00-13:00"
              value={form.timeSlot}
              onChange={(event) => setForm({ ...form, timeSlot: event.target.value })}
              required
            />
          </label>

          {isNeedForm && (
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
            <legend>{isNeedForm ? 'Que ayudas necesitas?' : 'Que ayudas puedes ofrecer?'}</legend>
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
            Descripcion
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
          </label>

          <button className="primary-button" type="submit">
            <Send size={18} />
            {isNeedForm ? 'Solicitar ayuda' : 'Ofrecer ayuda'}
          </button>

          {message && <p className="notice">{message}</p>}
          {error && <p className="notice error">{error}</p>}
        </form>
      </section>
    </main>
  );
}
