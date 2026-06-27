import {
  helpTypes,
  type CreateHelpPostInput,
  type UpdateHelpPostInput,
} from "@help-venezuela/shared";
import L from "leaflet";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  HandHeart,
  LifeBuoy,
  MapPin,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  createHelpPost,
  getMapHelpPosts,
  getPersonPosts,
  updateHelpPost,
  updateHelpPostStatus,
  type HelpPost,
  type HelpPostStatus,
  type PublicMapPost,
} from "./api";
import {
  isVenezuelaLocationOption,
  venezuelaLocationOptions,
} from "./venezuelaLocations";

type FormKind = "NEED" | "OFFER";
type IdentityCardPrefix = "V" | "E";
type ErrorContext = "create" | "update" | "loadOwnerPosts" | "status" | "map";

type HelpPostForm = CreateHelpPostInput & {
  urgency: "LOW" | "MEDIUM" | "HIGH";
};

const descriptionMaxLength = 500;
const fieldErrorMessages: Record<string, string> = {
  contact: "El contacto debe incluir prefijo y un número válido.",
  description: "La descripción debe tener entre 10 y 500 caracteres.",
  helpTypeSlugs: "Selecciona al menos un tipo de ayuda.",
  identityCard: "La cédula debe empezar por V o E y tener entre 5 y 12 números.",
  latitude: "La latitud debe estar entre -90 y 90.",
  locationLabel: "Selecciona una zona válida de la lista.",
  longitude: "La longitud debe estar entre -180 y 180.",
  name: "El nombre y apellidos deben tener entre 2 y 80 caracteres.",
  status: "El estado seleccionado no es válido.",
  timeFrom: "Indica una hora de inicio válida y anterior a la hora de fin.",
  timeTo: "Indica una hora de fin válida y posterior a la hora de inicio.",
  urgency: "Selecciona la urgencia de la solicitud.",
};
const identityCardPrefixes = ["V", "E"] as const;
const countryDialCodes = [
  { country: "Venezuela", code: "+58" },
  { country: "Colombia", code: "+57" },
  { country: "Brasil", code: "+55" },
  { country: "Perú", code: "+51" },
  { country: "Ecuador", code: "+593" },
  { country: "Chile", code: "+56" },
  { country: "Argentina", code: "+54" },
  { country: "Uruguay", code: "+598" },
  { country: "Paraguay", code: "+595" },
  { country: "Bolivia", code: "+591" },
  { country: "Panamá", code: "+507" },
  { country: "México", code: "+52" },
  { country: "España", code: "+34" },
  { country: "Estados Unidos", code: "+1" },
] as const;

function sanitizeNumeric(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function getIdentityCardParts(value: string): {
  prefix: IdentityCardPrefix;
  number: string;
} {
  const normalizedValue = value.trim().toUpperCase().replace(/[\s-]+/g, "");
  const prefix = normalizedValue.startsWith("E") ? "E" : "V";

  return {
    prefix,
    number: sanitizeNumeric(normalizedValue.replace(/^[VE]/, ""), 12),
  };
}

function formatIdentityCard(prefix: IdentityCardPrefix, value: string) {
  return `${prefix}${sanitizeNumeric(value, 12)}`;
}

function getContactParts(value: string) {
  const trimmedValue = value.trim();
  const selectedCode =
    [...countryDialCodes]
      .sort((first, second) => second.code.length - first.code.length)
      .find(({ code }) => trimmedValue.startsWith(code))?.code ?? "+58";

  return {
    code: selectedCode,
    number: sanitizeNumeric(trimmedValue.replace(selectedCode, ""), 15),
  };
}

function formatContact(code: string, value: string) {
  return `${code}${sanitizeNumeric(value, 15)}`;
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}

function getValidationErrorMessage(error: ApiError) {
  const fieldErrors = error.payload?.details?.fieldErrors ?? {};
  const formErrors = error.payload?.details?.formErrors ?? [];
  const messages = [
    ...Object.entries(fieldErrors).map(([fieldName, fieldMessages]) => {
      const customMessage = fieldErrorMessages[fieldName];
      return customMessage ?? fieldMessages[0];
    }),
    ...formErrors,
  ].filter(Boolean);

  if (messages.length === 0) {
    return "Hay campos inválidos. Revisa los datos marcados e intenta de nuevo.";
  }

  return messages.slice(0, 3).join(" ");
}

function getNetworkErrorMessage(context: ErrorContext) {
  if (context === "map") {
    return "No se pudo conectar con el servidor para cargar el mapa.";
  }

  return "No se pudo conectar con el servidor. Verifica que la API esté en ejecución y vuelve a intentar.";
}

function getApiErrorMessage(error: unknown, context: ErrorContext) {
  if (error instanceof TypeError) {
    return getNetworkErrorMessage(context);
  }

  if (!(error instanceof ApiError)) {
    return "Ocurrió un error inesperado. Intenta de nuevo.";
  }

  if (error.status === 400) {
    if (error.payload?.error === "INVALID_PAYLOAD") {
      return getValidationErrorMessage(error);
    }

    if (error.payload?.error === "INVALID_HELP_TYPES") {
      return "Uno o más tipos de ayuda no existen. Actualiza la página y selecciona opciones disponibles.";
    }

    if (error.payload?.error === "INVALID_QUERY") {
      return "Los filtros usados para consultar publicaciones no son válidos.";
    }

    return "La solicitud contiene datos inválidos. Revisa la información enviada.";
  }

  if (error.status === 403) {
    return "La cédula indicada no coincide con la persona que creó esta publicación.";
  }

  if (error.status === 404) {
    return context === "status" || context === "update"
      ? "La publicación ya no existe o no está disponible para modificar."
      : "No se encontró información para los datos indicados.";
  }

  if (error.status === 410) {
    return "Esta acción ya no está disponible para esa publicación.";
  }

  if (error.status === 429) {
    return "Has hecho demasiadas solicitudes en poco tiempo. Espera un minuto y vuelve a intentar.";
  }

  if (error.status >= 500) {
    return "El servidor falló al procesar la solicitud. Intenta de nuevo en unos minutos.";
  }

  return error.message || "Ocurrió un error inesperado. Intenta de nuevo.";
}

function RequiredMark() {
  return (
    <span aria-label="obligatorio" className="required-mark">
      *
    </span>
  );
}

function IdentityCardInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const identityCard = getIdentityCardParts(value);

  return (
    <label>
      <span>
        {label} <RequiredMark />
      </span>
      <div className="compound-input identity-input">
        <select
          aria-label="Tipo de cédula"
          value={identityCard.prefix}
          onChange={(event) =>
            onChange(
              formatIdentityCard(
                event.target.value as IdentityCardPrefix,
                identityCard.number,
              ),
            )
          }
        >
          {identityCardPrefixes.map((prefix) => (
            <option key={prefix} value={prefix}>
              {prefix}
            </option>
          ))}
        </select>
        <input
          inputMode="numeric"
          pattern="\d{5,12}"
          placeholder="12345678"
          value={identityCard.number}
          onChange={(event) =>
            onChange(formatIdentityCard(identityCard.prefix, event.target.value))
          }
          required
          title="Introduce solo números, entre 5 y 12 dígitos."
        />
      </div>
    </label>
  );
}

function ContactInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const contact = getContactParts(value);

  return (
    <label>
      <span>
        Contacto o WhatsApp <RequiredMark />
      </span>
      <div className="compound-input contact-input">
        <select
          aria-label="Prefijo telefónico"
          value={contact.code}
          onChange={(event) =>
            onChange(formatContact(event.target.value, contact.number))
          }
        >
          {countryDialCodes.map(({ country, code }) => (
            <option key={`${country}-${code}`} value={code}>
              {country} ({code})
            </option>
          ))}
        </select>
        <input
          inputMode="numeric"
          pattern="\d{4,15}"
          placeholder="4121234567"
          type="tel"
          value={contact.number}
          onChange={(event) =>
            onChange(formatContact(contact.code, event.target.value))
          }
          required
          title="Introduce solo números para el teléfono."
        />
      </div>
    </label>
  );
}

function createInitialForm(kind: FormKind): HelpPostForm {
  return {
    identityCard: "",
    kind,
    name: "",
    contact: "",
    locationLabel: "",
    latitude: 10.4806,
    longitude: -66.9036,
    timeFrom: null,
    timeTo: null,
    urgency: "MEDIUM",
    description: "",
    helpTypeSlugs: [],
  };
}

function createFormFromPost(
  post: HelpPost,
  identityCard: string,
): HelpPostForm {
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
    urgency: post.urgency ?? "MEDIUM",
    description: post.description,
    helpTypeSlugs: post.helpTypeSlugs,
  };
}

function getCurrentPath() {
  return window.location.pathname;
}

function getTimeLabel(post: {
  timeFrom: string | null;
  timeTo: string | null;
}) {
  return post.timeFrom && post.timeTo
    ? `${post.timeFrom} - ${post.timeTo}`
    : "Cualquier momento";
}

function getStatusLabel(status: HelpPostStatus) {
  const labels: Record<HelpPostStatus, string> = {
    ACTIVE: "Visible",
    HIDDEN: "Oculta",
    CLOSED: "Cerrada",
    DELETED: "Eliminada",
    REPORTED: "Reportada",
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
    helpTypeSlugs: form.helpTypeSlugs,
  };
}

function createMarkerIcon(kind: PublicMapPost["kind"]) {
  return L.divIcon({
    className: "",
    html: `<span class="map-marker ${kind === "NEED" ? "need" : "offer"}">${kind === "NEED" ? "N" : "O"}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

export function App() {
  const [path, setPath] = useState(getCurrentPath);
  const formKind = useMemo<FormKind | null>(() => {
    if (path === "/formulario/ayudar") {
      return "OFFER";
    }

    if (path === "/formulario/ser-ayudado") {
      return "NEED";
    }

    return null;
  }, [path]);
  const [form, setForm] = useState<HelpPostForm>(() =>
    createInitialForm(formKind ?? "NEED"),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mapPosts, setMapPosts] = useState<PublicMapPost[]>([]);
  const [ownerIdentityCard, setOwnerIdentityCard] = useState("");
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

    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => {
    if (formKind) {
      setForm(createInitialForm(formKind));
      setMessage("");
      setError("");
    }
  }, [formKind]);

  useEffect(() => {
    if (path !== "/mapa") {
      return;
    }

    getMapHelpPosts()
      .then(setMapPosts)
      .catch((caughtError: unknown) =>
        setError(getApiErrorMessage(caughtError, "map")),
      );
  }, [path]);

  useEffect(() => {
    if (path !== "/mapa" || !mapCanvasRef.current) {
      return;
    }

    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapCanvasRef.current, {
        center: [8.0019, -66.1109],
        zoom: 6,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
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
      const position: L.LatLngTuple = [
        post.publicLatitude,
        post.publicLongitude,
      ];
      bounds.extend(position);
      L.marker(position, {
        icon: createMarkerIcon(post.kind),
        title: post.locationLabel,
      })
        .bindPopup(
          `<strong>${post.kind === "NEED" ? "Necesita ayuda" : "Ofrece ayuda"}</strong><br>${post.locationLabel}<br>${getTimeLabel(post)}`,
        )
        .addTo(markerLayer ?? map);
    });

    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
  }, [path, mapPosts]);

  useEffect(() => {
    if (path === "/mapa") {
      return;
    }

    leafletMapRef.current?.remove();
    leafletMapRef.current = null;
    markerLayerRef.current = null;
  }, [path]);

  function navigate(nextPath: string) {
    window.history.pushState(null, "", nextPath);
    setPath(nextPath);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!isVenezuelaLocationOption(form.locationLabel)) {
      setError("Selecciona una zona válida del autocompletado.");
      return;
    }

    try {
      await createHelpPost(form);
      setMessage(
        "Publicación creada. Puedes gestionarla desde Mis publicaciones usando tu cédula.",
      );
      setForm(createInitialForm(form.kind));
    } catch (caughtError) {
      setError(getApiErrorMessage(caughtError, "create"));
    }
  }

  async function loadOwnerPosts(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setMessage("");
    setError("");
    setEditingPostId(null);
    setEditingForm(null);

    try {
      const posts = await getPersonPosts(ownerIdentityCard);
      setOwnerPosts(posts);
      setMessage(
        posts.length ? "" : "No hay publicaciones asociadas a esa cédula.",
      );
    } catch (caughtError) {
      setError(getApiErrorMessage(caughtError, "loadOwnerPosts"));
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingForm || !editingPostId) {
      return;
    }

    setMessage("");
    setError("");

    if (!isVenezuelaLocationOption(editingForm.locationLabel)) {
      setError("Selecciona una zona válida del autocompletado.");
      return;
    }

    try {
      await updateHelpPost(editingPostId, toUpdateInput(editingForm));
      setMessage("Publicación actualizada.");
      setEditingPostId(null);
      setEditingForm(null);
      await loadOwnerPosts();
    } catch (caughtError) {
      setError(getApiErrorMessage(caughtError, "update"));
    }
  }

  async function changeStatus(postId: string, status: HelpPostStatus) {
    setMessage("");
    setError("");

    try {
      await updateHelpPostStatus(postId, ownerIdentityCard, status);
      await loadOwnerPosts();
    } catch (caughtError) {
      setError(getApiErrorMessage(caughtError, "status"));
    }
  }

  function useCurrentLocation(
    targetForm: HelpPostForm,
    setTargetForm: (nextForm: HelpPostForm) => void,
  ) {
    setMessage("");
    setError("");

    if (!navigator.geolocation) {
      setError("Tu navegador no permite solicitar la ubicación actual.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setTargetForm({
          ...targetForm,
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
        });
        setMessage("Coordenadas actualizadas con tu ubicación actual.");
      },
      () => {
        setError("No se pudo obtener la ubicación. Revisa el permiso del navegador.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 10_000,
      },
    );
  }

  function toggleHelpType(
    slug: string,
    targetForm: HelpPostForm,
    setTargetForm: (nextForm: HelpPostForm) => void,
  ) {
    setTargetForm({
      ...targetForm,
      helpTypeSlugs: targetForm.helpTypeSlugs.includes(slug)
        ? targetForm.helpTypeSlugs.filter((item) => item !== slug)
        : [...targetForm.helpTypeSlugs, slug],
    });
  }

  function renderPostForm(
    targetForm: HelpPostForm,
    setTargetForm: (nextForm: HelpPostForm) => void,
    onSubmit: (event: FormEvent<HTMLFormElement>) => void,
    options: { isEditing: boolean },
  ) {
    const isNeedForm = targetForm.kind === "NEED";
    const isAnyTime =
      targetForm.timeFrom === null && targetForm.timeTo === null;
    const locationOptionsId = options.isEditing
      ? "venezuela-location-options-edit"
      : "venezuela-location-options-create";

    return (
      <form className="panel form" onSubmit={onSubmit}>
        <div className="section-title">
          {isNeedForm ? <LifeBuoy size={20} /> : <HandHeart size={20} />}
          <div>
            <p className="eyebrow">
              {isNeedForm ? "Solicitud de ayuda" : "Oferta voluntaria"}
            </p>
            <h1>{isNeedForm ? "Ser ayudado" : "Ayudar"}</h1>
          </div>
        </div>

        <fieldset className="form-section">
          <legend>Información personal</legend>

          {!options.isEditing && (
            <IdentityCardInput
              label="Cédula de identidad"
              value={targetForm.identityCard}
              onChange={(identityCard) =>
                setTargetForm({ ...targetForm, identityCard })
              }
            />
          )}

          {options.isEditing && (
            <p className="locked-field">
              Cédula usada para gestionar: {targetForm.identityCard}. No se
              puede editar.
            </p>
          )}

          <label>
            <span>
              Nombre y apellidos <RequiredMark />
            </span>
            <input
              value={targetForm.name}
              onChange={(event) =>
                setTargetForm({ ...targetForm, name: event.target.value })
              }
              required
            />
          </label>

          <ContactInput
            value={targetForm.contact}
            onChange={(contact) => setTargetForm({ ...targetForm, contact })}
          />
        </fieldset>

        <fieldset className="form-section">
          <legend>Ubicación</legend>

          <label>
            <span>
              Zona o referencia <RequiredMark />
            </span>
            <input
              list={locationOptionsId}
              placeholder="Escribe código postal, ciudad o estado"
              value={targetForm.locationLabel}
              onBlur={(event) =>
                event.currentTarget.setCustomValidity(
                  isVenezuelaLocationOption(event.currentTarget.value)
                    ? ""
                    : "Selecciona una zona válida de la lista.",
                )
              }
              onChange={(event) => {
                const nextLocationLabel = event.target.value;
                event.target.setCustomValidity(
                  nextLocationLabel === "" ||
                    isVenezuelaLocationOption(nextLocationLabel)
                    ? ""
                    : "Selecciona una zona válida de la lista.",
                );
                setTargetForm({
                  ...targetForm,
                  locationLabel: nextLocationLabel,
                });
              }}
              required
            />
            <datalist id={locationOptionsId}>
              {venezuelaLocationOptions.map((locationOption) => (
                <option key={locationOption} value={locationOption} />
              ))}
            </datalist>
          </label>

          <div className="coordinates-row">
            <div className="grid-two coordinates-fields">
              <label>
                <span>
                  Latitud <RequiredMark />
                </span>
                <input
                  type="number"
                  step="0.000001"
                  value={targetForm.latitude}
                  onChange={(event) =>
                    setTargetForm({
                      ...targetForm,
                      latitude: Number(event.target.value),
                    })
                  }
                  required
                />
              </label>
              <label>
                <span>
                  Longitud <RequiredMark />
                </span>
                <input
                  type="number"
                  step="0.000001"
                  value={targetForm.longitude}
                  onChange={(event) =>
                    setTargetForm({
                      ...targetForm,
                      longitude: Number(event.target.value),
                    })
                  }
                  required
                />
              </label>
            </div>
            <button
              className="secondary-button location-button"
              onClick={() => useCurrentLocation(targetForm, setTargetForm)}
              type="button"
            >
              <MapPin size={16} />
              Utilizar mi ubicación actual
            </button>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>
            {isNeedForm
              ? "¿Cuándo necesitas ayuda?"
              : "¿Cuándo puedes ayudar?"}
          </legend>

          <label className="switch-row">
            <input
              checked={isAnyTime}
              onChange={(event) =>
                setTargetForm({
                  ...targetForm,
                  timeFrom: event.target.checked ? null : "08:00",
                  timeTo: event.target.checked ? null : "18:00",
                })
              }
              type="checkbox"
            />
            Cualquier momento
          </label>

          {!isAnyTime && (
            <div className="grid-two">
              <label>
                <span>
                  Inicio <RequiredMark />
                </span>
                <input
                  type="time"
                  value={targetForm.timeFrom ?? ""}
                  onChange={(event) =>
                    setTargetForm({
                      ...targetForm,
                      timeFrom: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                <span>
                  Fin <RequiredMark />
                </span>
                <input
                  type="time"
                  value={targetForm.timeTo ?? ""}
                  onChange={(event) =>
                    setTargetForm({ ...targetForm, timeTo: event.target.value })
                  }
                  required
                />
              </label>
            </div>
          )}
        </fieldset>

        <fieldset className="form-section">
          <legend>Detalles de la ayuda</legend>

          {isNeedForm && (
            <label>
              <span>
                Urgencia <RequiredMark />
              </span>
              <select
                value={targetForm.urgency}
                onChange={(event) =>
                  setTargetForm({
                    ...targetForm,
                    urgency: event.target.value as typeof targetForm.urgency,
                  })
                }
              >
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
              </select>
            </label>
          )}

          <fieldset>
            <legend>
              {isNeedForm
                ? "¿Qué ayudas necesitas?"
                : "¿Qué ayudas puedes ofrecer?"}{" "}
              <RequiredMark />
            </legend>
            <div className="chips">
              {helpTypes.map((type) => (
                <button
                  className={
                    targetForm.helpTypeSlugs.includes(type.slug)
                      ? "chip selected"
                      : "chip"
                  }
                  key={type.slug}
                  onClick={() =>
                    toggleHelpType(type.slug, targetForm, setTargetForm)
                  }
                  type="button"
                >
                  {type.name}
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            <span>
              Descripción <RequiredMark />
            </span>
            <textarea
              maxLength={descriptionMaxLength}
              value={targetForm.description}
              onChange={(event) =>
                setTargetForm({
                  ...targetForm,
                  description: event.target.value,
                })
              }
              required
            />
            <span className="character-count">
              {targetForm.description.length}/{descriptionMaxLength}
            </span>
          </label>
        </fieldset>

        <button className="primary-button" type="submit">
          <Send size={18} />
          {options.isEditing
            ? "Guardar cambios"
            : isNeedForm
              ? "Solicitar ayuda"
              : "Ofrecer ayuda"}
        </button>
      </form>
    );
  }

  if (path === "/mapa") {
    return (
      <main className="map-shell">
        <header className="map-header">
          <button
            className="back-button"
            onClick={() => navigate("/")}
            type="button"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          <div>
            <p className="eyebrow">Vista publica</p>
            <h1>Mapa de ayuda</h1>
          </div>
        </header>

        <section
          className="map-fullscreen"
          aria-label="Mapa de puntos de ayuda"
        >
          <div className="leaflet-map" ref={mapCanvasRef} />
          <aside className="map-posts-panel">
            <h2>Publicaciones visibles</h2>
            {mapPosts.length === 0 && (
              <p>No hay publicaciones activas todavia.</p>
            )}
            {mapPosts.map((post) => (
              <article className="map-post-card" key={post.id}>
                <div className="post-head">
                  <strong>
                    {post.kind === "NEED" ? "Necesita ayuda" : "Ofrece ayuda"}
                  </strong>
                  <span>{post.urgency ?? "Oferta"}</span>
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
            <span>
              Los puntos se muestran de forma aproximada para proteger a las
              personas.
            </span>
          </div>
        </section>
      </main>
    );
  }

  if (path === "/mis-publicaciones") {
    return (
      <main className="app-shell">
        <section className="owner-page">
          <button
            className="back-button"
            onClick={() => navigate("/")}
            type="button"
          >
            <ArrowLeft size={18} />
            Volver
          </button>

          <form
            className="panel form"
            onSubmit={(event) => void loadOwnerPosts(event)}
          >
            <div className="section-title">
              <Pencil size={20} />
              <div>
                <p className="eyebrow">Gestión por cédula</p>
                <h1>Mis publicaciones</h1>
              </div>
            </div>
            <IdentityCardInput
              label="Cédula de identidad"
              value={ownerIdentityCard}
              onChange={setOwnerIdentityCard}
            />
            <button className="primary-button" type="submit">
              Buscar publicaciones
            </button>
          </form>

          {editingForm && (
            <section>
              {renderPostForm(
                editingForm,
                setEditingForm,
                (event) => void handleEditSubmit(event),
                { isEditing: true },
              )}
            </section>
          )}

          <section className="post-list">
            {ownerPosts.map((post) => (
              <article className="panel post-card" key={post.id}>
                <div className="post-head">
                  <strong>
                    {post.kind === "NEED" ? "Solicitud" : "Oferta"}
                  </strong>
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
                      setEditingForm(
                        createFormFromPost(post, ownerIdentityCard),
                      );
                    }}
                    type="button"
                  >
                    <Pencil size={16} />
                    Editar
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void changeStatus(post.id, "ACTIVE")}
                    type="button"
                  >
                    <Eye size={16} />
                    Mostrar
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void changeStatus(post.id, "HIDDEN")}
                    type="button"
                  >
                    <EyeOff size={16} />
                    Ocultar
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => void changeStatus(post.id, "DELETED")}
                    type="button"
                  >
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
          <p>¿Que necesitas?</p>
          <div className="choice-grid">
            <button
              className="choice-card"
              onClick={() => navigate("/formulario/ayudar")}
              type="button"
            >
              <HandHeart size={32} />
              <span>Ayudar</span>
            </button>
            <button
              className="choice-card"
              onClick={() => navigate("/formulario/ser-ayudado")}
              type="button"
            >
              <LifeBuoy size={32} />
              <span>Solicitar ayuda</span>
            </button>
          </div>
          <div className="home-links">
            <a
              className="home-map-link"
              href="/mapa"
              onClick={(event) => {
                event.preventDefault();
                navigate("/mapa");
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
                navigate("/mis-publicaciones");
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
        <button
          className="back-button"
          onClick={() => navigate("/")}
          type="button"
        >
          <ArrowLeft size={18} />
          Volver
        </button>

        {renderPostForm(form, setForm, (event) => void handleSubmit(event), {
          isEditing: false,
        })}

        {message && <p className="notice">{message}</p>}
        {error && <p className="notice error">{error}</p>}
      </section>
    </main>
  );
}
