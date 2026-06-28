import {
  helpTypes,
  isVenezuelaCityForState,
  isVenezuelaState,
  type CreateHelpPostInput,
  type LocationSource,
  type UpdateHelpPostInput,
  venezuelaCitiesByState,
  venezuelaStates,
} from "@help-venezuela/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  getAddressSuggestions,
  getMapHelpPosts,
  getPersonPosts,
  updateHelpPost,
  updateHelpPostStatus,
  type HelpPost,
  type HelpPostStatus,
  type PublicMapPost,
} from "./api";

type FormKind = "NEED" | "OFFER";
type IdentityCardPrefix = "V" | "E";
type ErrorContext = "create" | "update" | "loadOwnerPosts" | "status" | "map";

type HelpPostForm = {
  identityCard: string;
  kind: FormKind;
  name: string;
  surnames: string;
  contact: string;
  locationSource: LocationSource;
  state: string;
  city: string;
  address: string;
  referencePoint: string;
  latitude: number | null;
  longitude: number | null;
  timeFrom: string | null;
  timeTo: string | null;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  helpTypeSlugs: string[];
};

const descriptionMaxLength = 500;
const fieldErrorMessages: Record<string, string> = {
  address: "Indica una direccion valida.",
  city: "Selecciona una ciudad valida para el estado.",
  contact: "El contacto debe incluir prefijo y un numero valido.",
  description: "La descripcion debe tener entre 10 y 500 caracteres.",
  helpTypeSlugs: "Selecciona al menos un tipo de ayuda.",
  identityCard: "La cedula debe empezar por V o E y tener entre 5 y 12 numeros.",
  latitude: "La latitud debe estar entre -90 y 90.",
  locationSource: "Selecciona una fuente de ubicacion valida.",
  longitude: "La longitud debe estar entre -180 y 180.",
  name: "El nombre debe tener entre 2 y 80 caracteres y solo usar letras, espacios, tildes y ñ.",
  surnames: "Los apellidos deben tener entre 2 y 80 caracteres y solo usar letras, espacios, tildes y ñ.",
  referencePoint: "El punto de referencia no puede superar 150 caracteres.",
  state: "Selecciona un estado valido de Venezuela.",
  status: "El estado seleccionado no es valido.",
  timeFrom: "Indica una hora de inicio valida y anterior a la hora de fin.",
  timeTo: "Indica una hora de fin valida y posterior a la hora de inicio.",
  urgency: "Selecciona la urgencia de la solicitud.",
}
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

  if (error.payload?.error === "LOCATION_NOT_FOUND") {
    return "No se pudieron calcular coordenadas para esa direccion. Corrige la direccion o usa tu ubicacion actual.";
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
    <Label>
      <span>
        {label} <RequiredMark />
      </span>
      <div className="compound-input identity-input">
        <Select
          aria-label="Tipo de cédula"
          value={identityCard.prefix}
          onValueChange={(nextPrefix) =>
            onChange(
              formatIdentityCard(
                nextPrefix as IdentityCardPrefix,
                identityCard.number,
              ),
            )
          }
        >
          <SelectTrigger aria-label="Tipo de cédula">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {identityCardPrefixes.map((prefix) => (
              <SelectItem key={prefix} value={prefix}>
                {prefix}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
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
    </Label>
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
    <Label>
      <span>
        Contacto o WhatsApp <RequiredMark />
      </span>
      <div className="compound-input contact-input">
        <Select
          aria-label="Prefijo telefónico"
          value={contact.code}
          onValueChange={(nextCode) =>
            onChange(formatContact(nextCode, contact.number))
          }
        >
          <SelectTrigger aria-label="Prefijo telefónico">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {countryDialCodes.map(({ country, code }) => (
              <SelectItem key={`${country}-${code}`} value={code}>
                {country} ({code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
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
    </Label>
  );
}

function FeedbackMessage({
  children,
  variant = "default",
}: {
  children: string;
  variant?: "default" | "destructive";
}) {
  return (
    <Alert className={variant === "destructive" ? "notice error" : "notice"} variant={variant}>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function createInitialForm(kind: FormKind): HelpPostForm {
  return {
    identityCard: "",
    kind,
    name: "",
    surnames: "",
    contact: "",
    locationSource: "ADDRESS",
    state: "",
    city: "",
    address: "",
    referencePoint: "",
    latitude: null,
    longitude: null,
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
    surnames: post.surnames ?? "",
    contact: post.contact,
    locationSource: post.locationSource,
    state: post.state ?? "",
    city: post.city ?? "",
    address: post.address ?? "",
    referencePoint: post.referencePoint ?? "",
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

function createCommonInput(form: HelpPostForm) {
  return {
    name: form.name,
    surnames: form.surnames,
    contact: form.contact,
    timeFrom: form.timeFrom,
    timeTo: form.timeTo,
    urgency: form.urgency,
    description: form.description,
    helpTypeSlugs: form.helpTypeSlugs,
  };
}

function toCreateInput(form: HelpPostForm): CreateHelpPostInput {
  const commonInput = {
    ...createCommonInput(form),
    identityCard: form.identityCard,
    kind: form.kind,
  };

  if (form.locationSource === "CURRENT_LOCATION") {
    return {
      ...commonInput,
      locationSource: "CURRENT_LOCATION",
      state: form.state,
      city: form.city,
      address: form.address,
      referencePoint: form.referencePoint,
      latitude: form.latitude ?? 0,
      longitude: form.longitude ?? 0,
    };
  }

  return {
    ...commonInput,
    locationSource: "ADDRESS",
    state: form.state,
    city: form.city,
    address: form.address,
    referencePoint: form.referencePoint,
  };
}

function toUpdateInput(form: HelpPostForm): UpdateHelpPostInput {
  const commonInput = {
    ...createCommonInput(form),
    identityCard: form.identityCard,
  };

  if (form.locationSource === "CURRENT_LOCATION") {
    return {
      ...commonInput,
      locationSource: "CURRENT_LOCATION",
      state: form.state,
      city: form.city,
      address: form.address,
      referencePoint: form.referencePoint,
      latitude: form.latitude ?? 0,
      longitude: form.longitude ?? 0,
    };
  }

  return {
    ...commonInput,
    locationSource: "ADDRESS",
    state: form.state,
    city: form.city,
    address: form.address,
    referencePoint: form.referencePoint,
  };
}

function getCityOptions(state: string) {
  const normalizedState = state.trim();
  return isVenezuelaState(normalizedState)
    ? [...venezuelaCitiesByState[normalizedState]]
    : [];
}

function getLocationValidationMessage(form: HelpPostForm) {
  if (form.locationSource === "CURRENT_LOCATION") {
    return form.latitude !== null && form.longitude !== null
      ? ""
      : "Pulsa \"Utilizar mi ubicacion actual\" para obtener coordenadas.";
  }

  if (!isVenezuelaState(form.state)) {
    return "Selecciona un estado valido de Venezuela.";
  }

  if (!isVenezuelaCityForState(form.state, form.city)) {
    return "Selecciona una ciudad valida para el estado indicado.";
  }

  if (form.address.trim().length < 3) {
    return "Indica una direccion suficientemente precisa.";
  }

  if (form.referencePoint.trim().length > 150) {
    return "El punto de referencia no puede superar 150 caracteres.";
  }

  return "";
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
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const addressSuggestionForm = editingForm ?? form;

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
    const query = addressSuggestionForm.address.trim();

    if (addressSuggestionForm.locationSource !== "ADDRESS" || query.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      getAddressSuggestions({
        query,
        state: addressSuggestionForm.state,
        city: addressSuggestionForm.city,
      })
        .then((suggestions) =>
          setAddressSuggestions(
            suggestions.map((suggestion) => suggestion.description),
          ),
        )
        .catch(() => setAddressSuggestions([]));
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [
    addressSuggestionForm.address,
    addressSuggestionForm.city,
    addressSuggestionForm.locationSource,
    addressSuggestionForm.state,
  ]);

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

    const locationValidationMessage = getLocationValidationMessage(form);

    if (locationValidationMessage) {
      setError(locationValidationMessage);
      return;
    }

    try {
      await createHelpPost(toCreateInput(form));
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

    const locationValidationMessage = getLocationValidationMessage(editingForm);

    if (locationValidationMessage) {
      setError(locationValidationMessage);
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
          locationSource: "CURRENT_LOCATION",
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
    const stateOptionsId = options.isEditing
      ? "venezuela-state-options-edit"
      : "venezuela-state-options-create";
    const cityOptionsId = options.isEditing
      ? "venezuela-city-options-edit"
      : "venezuela-city-options-create";
    const addressOptionsId = options.isEditing
      ? "venezuela-address-options-edit"
      : "venezuela-address-options-create";
    const cityOptions = getCityOptions(targetForm.state);

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

          <div className="grid-two">
            <Label>
              <span>
                Nombre <RequiredMark />
              </span>
              <Input
                pattern="[A-Za-zÁÉÍÓÚáéíóúÑñ ]{2,80}"
                title="Usa solo letras, espacios, tildes en vocales y la ñ."
                value={targetForm.name}
                onChange={(event) =>
                  setTargetForm({ ...targetForm, name: event.target.value })
                }
                required
              />
            </Label>

            <Label>
              <span>
                Apellidos <RequiredMark />
              </span>
              <Input
                pattern="[A-Za-zÁÉÍÓÚáéíóúÑñ ]{2,80}"
                title="Usa solo letras, espacios, tildes en vocales y la ñ."
                value={targetForm.surnames}
                onChange={(event) =>
                  setTargetForm({ ...targetForm, surnames: event.target.value })
                }
                required
              />
            </Label>
          </div>

          <ContactInput
            value={targetForm.contact}
            onChange={(contact) => setTargetForm({ ...targetForm, contact })}
          />
        </fieldset>

                <fieldset className="form-section">
          <legend>Ubicacion</legend>

          <div className="grid-two">
            <Label>
              <span>
                Estado <RequiredMark />
              </span>
              <Input
                list={stateOptionsId}
                placeholder="Ej. Miranda"
                value={targetForm.state}
                onChange={(event) =>
                  setTargetForm({
                    ...targetForm,
                    locationSource: "ADDRESS",
                    state: event.target.value,
                    city: "",
                    latitude: null,
                    longitude: null,
                  })
                }
              />
              <datalist id={stateOptionsId}>
                {venezuelaStates.map((state) => (
                  <option key={state} value={state} />
                ))}
              </datalist>
            </Label>

            <Label>
              <span>
                Ciudad <RequiredMark />
              </span>
              <Input
                list={cityOptionsId}
                placeholder="Ej. Caracas"
                value={targetForm.city}
                onChange={(event) =>
                  setTargetForm({
                    ...targetForm,
                    locationSource: "ADDRESS",
                    city: event.target.value,
                    latitude: null,
                    longitude: null,
                  })
                }
              />
              <datalist id={cityOptionsId}>
                {cityOptions.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </Label>
          </div>

          <Label>
            <span>
              Direccion <RequiredMark />
            </span>
            <Input
              list={addressOptionsId}
              placeholder="Calle, avenida, numero o sector"
              value={targetForm.address}
              onChange={(event) =>
                setTargetForm({
                  ...targetForm,
                  locationSource: "ADDRESS",
                  address: event.target.value,
                  latitude: null,
                  longitude: null,
                })
              }
            />
            <datalist id={addressOptionsId}>
              {addressSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </Label>

          <Label>
            <span>Punto de referencia</span>
            <Textarea
              maxLength={150}
              placeholder="Ej. Frente a la panaderia, edificio azul, cerca de la plaza"
              value={targetForm.referencePoint}
              onChange={(event) =>
                setTargetForm({
                  ...targetForm,
                  referencePoint: event.target.value,
                })
              }
            />
            <span className="character-count">
              {targetForm.referencePoint.length}/150
            </span>
          </Label>

          <div className="coordinates-row">
            <p className="locked-field">
              {targetForm.latitude !== null && targetForm.longitude !== null
                ? `Coordenadas: ${targetForm.latitude}, ${targetForm.longitude}`
                : "Las coordenadas se calcularan automaticamente con OpenStreetMap al guardar la direccion."}
            </p>
            <Button
              className="secondary-button location-button"
              onClick={() => useCurrentLocation(targetForm, setTargetForm)}
              type="button"
              variant="outline"
            >
              <MapPin size={16} />
              Utilizar mi ubicacion actual
            </Button>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>
            {isNeedForm
              ? "¿Cuándo necesitas ayuda?"
              : "¿Cuándo puedes ayudar?"}
          </legend>

          <RadioGroup
            className="time-mode-options"
            value={isAnyTime ? "any" : "range"}
            onValueChange={(nextValue) => {
              if (nextValue === "any") {
                setTargetForm({
                  ...targetForm,
                  timeFrom: null,
                  timeTo: null,
                });
                return;
              }

              setTargetForm({
                ...targetForm,
                timeFrom: targetForm.timeFrom ?? "08:00",
                timeTo: targetForm.timeTo ?? "18:00",
              });
            }}
          >
            <Label className="radio-option">
              <RadioGroupItem value="any" />
              Cualquier momento
            </Label>

            <Label className="radio-option">
              <RadioGroupItem value="range" />
              Franja horaria
            </Label>
          </RadioGroup>

          {!isAnyTime && (
            <div className="grid-two">
              <Label>
                <span>
                  Inicio <RequiredMark />
                </span>
                <Input
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
              </Label>
              <Label>
                <span>
                  Fin <RequiredMark />
                </span>
                <Input
                  type="time"
                  value={targetForm.timeTo ?? ""}
                  onChange={(event) =>
                    setTargetForm({ ...targetForm, timeTo: event.target.value })
                  }
                  required
                />
              </Label>
            </div>
          )}
        </fieldset>

        <fieldset className="form-section">
          <legend>Detalles de la ayuda</legend>

          {isNeedForm && (
            <Label>
              <span>
                Urgencia <RequiredMark />
              </span>
              <Select
                value={targetForm.urgency}
                onValueChange={(nextUrgency) =>
                  setTargetForm({
                    ...targetForm,
                    urgency: nextUrgency as typeof targetForm.urgency,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                </SelectContent>
              </Select>
            </Label>
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
                <Button
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
                  variant={
                    targetForm.helpTypeSlugs.includes(type.slug)
                      ? "default"
                      : "outline"
                  }
                >
                  {type.name}
                </Button>
              ))}
            </div>
          </fieldset>

          <Label>
            <span>
              Descripción <RequiredMark />
            </span>
            <Textarea
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
          </Label>
        </fieldset>

        <Button className="primary-button" type="submit">
          <Send size={18} />
          {options.isEditing
            ? "Guardar cambios"
            : isNeedForm
              ? "Solicitar ayuda"
              : "Ofrecer ayuda"}
        </Button>
      </form>
    );
  }

  if (path === "/mapa") {
    return (
      <main className="map-shell">
        <header className="map-header">
          <Button
            className="back-button"
            onClick={() => navigate("/")}
            type="button"
            variant="ghost"
          >
            <ArrowLeft size={18} />
            Volver
          </Button>
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
              <Card className="map-post-card" key={post.id}>
                <CardContent>
                  <div className="post-head">
                    <strong>
                      {post.kind === "NEED" ? "Necesita ayuda" : "Ofrece ayuda"}
                    </strong>
                    <Badge variant="secondary">{post.urgency ?? "Oferta"}</Badge>
                  </div>
                  <p>{post.locationLabel}</p>
                  <small>{getTimeLabel(post)}</small>
                  <p>{post.descriptionPreview}</p>
                  <small>
                    Punto publico: {post.publicLatitude}, {post.publicLongitude}
                  </small>
                </CardContent>
              </Card>
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
          <Button
            className="back-button"
            onClick={() => navigate("/")}
            type="button"
            variant="ghost"
          >
            <ArrowLeft size={18} />
            Volver
          </Button>

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
            <Button className="primary-button" type="submit">
              Buscar publicaciones
            </Button>
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
              <Card className="panel post-card" key={post.id}>
                <CardContent>
                  <div className="post-head">
                    <strong>
                      {post.kind === "NEED" ? "Solicitud" : "Oferta"}
                    </strong>
                    <Badge variant="secondary">{getStatusLabel(post.status)}</Badge>
                  </div>
                  <h3>{post.locationLabel}</h3>
                  <p>{post.description}</p>
                  <small>{getTimeLabel(post)}</small>
                  <div className="actions-row">
                  <Button
                    className="secondary-button"
                    onClick={() => {
                      setEditingPostId(post.id);
                      setEditingForm(
                        createFormFromPost(post, ownerIdentityCard),
                      );
                    }}
                    type="button"
                    variant="outline"
                  >
                    <Pencil size={16} />
                    Editar
                  </Button>
                  <Button
                    className="secondary-button"
                    onClick={() => void changeStatus(post.id, "ACTIVE")}
                    type="button"
                    variant="outline"
                  >
                    <Eye size={16} />
                    Mostrar
                  </Button>
                  <Button
                    className="secondary-button"
                    onClick={() => void changeStatus(post.id, "HIDDEN")}
                    type="button"
                    variant="outline"
                  >
                    <EyeOff size={16} />
                    Ocultar
                  </Button>
                  <Button
                    className="danger-button"
                    onClick={() => void changeStatus(post.id, "DELETED")}
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 size={16} />
                    Eliminar
                  </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          {message && <FeedbackMessage>{message}</FeedbackMessage>}
          {error && (
            <FeedbackMessage variant="destructive">{error}</FeedbackMessage>
          )}
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
            <Button
              className="choice-card"
              onClick={() => navigate("/formulario/ayudar")}
              type="button"
              variant="outline"
            >
              <HandHeart size={32} />
              <span>Ayudar</span>
            </Button>
            <Button
              className="choice-card"
              onClick={() => navigate("/formulario/ser-ayudado")}
              type="button"
              variant="outline"
            >
              <LifeBuoy size={32} />
              <span>Solicitar ayuda</span>
            </Button>
          </div>
          <div className="home-links">
            <Button asChild className="home-map-link" variant="link">
              <a
                href="/mapa"
                onClick={(event) => {
                  event.preventDefault();
                  navigate("/mapa");
                }}
              >
                <MapPin size={18} />
                Ver mapa
              </a>
            </Button>
            <Button asChild className="home-map-link" variant="link">
              <a
                href="/mis-publicaciones"
                onClick={(event) => {
                  event.preventDefault();
                  navigate("/mis-publicaciones");
                }}
              >
                <Pencil size={18} />
                Mis publicaciones
              </a>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="form-page">
        <Button
          className="back-button"
          onClick={() => navigate("/")}
          type="button"
          variant="ghost"
        >
          <ArrowLeft size={18} />
          Volver
        </Button>

        {renderPostForm(form, setForm, (event) => void handleSubmit(event), {
          isEditing: false,
        })}

        {message && <FeedbackMessage>{message}</FeedbackMessage>}
        {error && (
          <FeedbackMessage variant="destructive">{error}</FeedbackMessage>
        )}
      </section>
    </main>
  );
}
