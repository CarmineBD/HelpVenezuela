# Help Venezuela - Spec MVP

## Objetivo

Crear una web sencilla para conectar personas que necesitan ayuda con personas voluntarias tras los terremotos en Venezuela.

La prioridad es que sea útil desde el día 1: publicar necesidades, publicar disponibilidad para ayudar, ver solicitudes cercanas en un mapa y facilitar encuentros seguros.

## Principio del producto

La aplicación no debe intentar resolver toda la logística humanitaria desde el principio. El MVP debe hacer bien tres cosas:

1. Permitir que alguien publique que necesita ayuda.
2. Permitir que alguien publique que puede ayudar.
3. Sugerir coincidencias cercanas según ubicación, fechas, horario y tipo de ayuda.

## Stack recomendado

- Monorepo: `pnpm workspaces`
- Frontend: `React + Vite + TypeScript`
- Backend: `Node.js + Fastify + TypeScript`
- Base de datos: `PostgreSQL`
- ORM: `Prisma`
- Estilos: `Tailwind CSS`
- Mapa: `Leaflet + OpenStreetMap`
- Validación: `Zod`
- Desarrollo local: `Docker Compose`

Se recomienda `Fastify` en vez de `NestJS` para este proyecto porque el objetivo es ir rápido y mantener poca ceremonia.

## Estructura del repo

```txt
HelpVenezuela/
  apps/
    web/
    api/
  packages/
    shared/
  prisma/
    schema.prisma
  docker-compose.yml
  pnpm-workspace.yaml
  package.json
  SPEC.md
```

## Roles

### Usuario necesitado

Persona que publica una solicitud de ayuda.

Puede indicar:

- Nombre o alias
- Teléfono o WhatsApp
- Ubicación aproximada
- Rango de fechas
- Horario preferido
- Tipos de ayuda requeridos
- Descripción corta
- Nivel de urgencia

### Usuario voluntario

Persona que publica que puede ayudar.

Puede indicar:

- Nombre o alias
- Teléfono o WhatsApp
- Ubicación aproximada
- Rango de fechas disponible
- Horario disponible
- Tipos de ayuda que ofrece
- Capacidad aproximada
- Descripción corta

## Tipos de ayuda iniciales

- Donar comida
- Transporte
- Donar ropa
- Proporcionar alojamiento
- Ayudar a limpiar
- Ayudar a levantar escombros
- Medicinas

Estos tipos deben vivir como catálogo editable en base de datos o como enum compartido en `packages/shared` durante el MVP.

## Funcionalidades MVP

### 1. Crear solicitud de ayuda

Formulario público para registrar una necesidad.

Campos:

- Tipo: `necesito_ayuda`
- Nombre o alias
- Contacto
- Ubicación
- Latitud
- Longitud
- Fecha inicial
- Fecha final
- Franja horaria
- Tipos de ayuda
- Urgencia: `baja`, `media`, `alta`
- Descripción

### 2. Crear ofrecimiento de ayuda

Formulario público para registrar disponibilidad voluntaria.

Campos:

- Tipo: `ofrezco_ayuda`
- Nombre o alias
- Contacto
- Ubicación
- Latitud
- Longitud
- Fecha inicial
- Fecha final
- Franja horaria
- Tipos de ayuda
- Descripción

### 3. Mapa de publicaciones

Vista principal con mapa y lista lateral.

Debe permitir:

- Ver solicitudes de ayuda
- Ver voluntarios disponibles
- Filtrar por tipo de ayuda
- Filtrar por urgencia
- Filtrar por fecha
- Click en marcador para ver detalles
- Botón de contacto directo por WhatsApp si existe teléfono

### 4. Matching básico

El sistema debe sugerir coincidencias entre una solicitud y voluntarios compatibles.

Criterios:

- Comparten al menos un tipo de ayuda
- Sus rangos de fechas se cruzan
- Sus horarios son compatibles
- Están dentro de un radio razonable

Orden recomendado:

1. Menor distancia
2. Mayor urgencia
3. Mayor cantidad de tipos de ayuda compatibles
4. Coincidencia de fecha más cercana

### 5. Página de detalle

Cada publicación debe tener una vista simple con:

- Tipo de publicación
- Tipos de ayuda
- Ubicación aproximada
- Fechas
- Horario
- Descripción
- Contacto
- Coincidencias sugeridas

## Funcionalidades fuera del MVP

Estas ideas son útiles, pero deben esperar:

- Login completo
- Chat interno
- Verificación de identidad
- Panel avanzado de administradores
- Notificaciones push
- Sistema complejo de reputación
- Optimización avanzada de rutas
- App móvil nativa

## Seguridad mínima

Aunque el proyecto sea rápido, hay que proteger a las personas.

Reglas mínimas:

- No mostrar dirección exacta públicamente.
- Mostrar ubicación aproximada en el mapa.
- Permitir borrar una publicación usando un enlace privado.
- Validar todos los campos en frontend y backend.
- Limitar spam por IP.
- Evitar publicar datos sensibles innecesarios.
- Mostrar aviso de seguridad antes de contactar.

## Modelo de datos inicial

### `HelpPost`

Representa una solicitud u ofrecimiento.

Campos:

- `id`
- `kind`: `NEED` o `OFFER`
- `name`
- `surnames`
- `contact`
- `locationLabel`
- `latitude`
- `longitude`
- `dateFrom`
- `dateTo`
- `timeSlot`
- `urgency`
- `description`
- `status`: `ACTIVE`, `MATCHED`, `CLOSED`
- `deleteToken`
- `createdAt`
- `updatedAt`

### `HelpType`

Catálogo de ayudas.

Campos:

- `id`
- `slug`
- `name`

### `HelpPostType`

Relación entre publicaciones y tipos de ayuda.

Campos:

- `helpPostId`
- `helpTypeId`

## API inicial

### Publicaciones

- `POST /help-posts`
- `GET /help-posts`
- `GET /help-posts/:id`
- `DELETE /help-posts/:id?token=...`

### Matching

- `GET /help-posts/:id/matches`

### Catálogo

- `GET /help-types`

## Pantallas iniciales

### `/`

Mapa principal con filtros y publicaciones.

### `/publicar`

Selector entre:

- Necesito ayuda
- Quiero ayudar

Después muestra el formulario correspondiente.

### `/publicaciones/:id`

Detalle de publicación y matches sugeridos.

## Matching MVP en pseudocódigo

```ts
function getMatches(post) {
  const oppositeKind = post.kind === 'NEED' ? 'OFFER' : 'NEED';

  return findPosts({
    kind: oppositeKind,
    status: 'ACTIVE',
    helpTypesOverlap: post.helpTypes,
    dateRangeOverlaps: [post.dateFrom, post.dateTo],
    timeSlotCompatible: post.timeSlot,
    maxDistanceKm: 25,
  }).sort(byDistanceThenUrgencyThenHelpOverlap);
}
```

Para empezar, el cálculo de distancia puede hacerse en Node con la fórmula Haversine. Más adelante se puede mover a PostgreSQL con PostGIS si hace falta.

## Prioridad de desarrollo

### Día 1

- Crear monorepo.
- Crear frontend con Vite.
- Crear backend con Fastify.
- Levantar PostgreSQL con Docker.
- Configurar Prisma.
- Crear modelo `HelpPost`.

### Día 2

- Crear formulario de publicación.
- Guardar solicitudes y ofrecimientos.
- Listar publicaciones.
- Crear catálogo de tipos de ayuda.

### Día 3

- Integrar mapa con Leaflet.
- Mostrar marcadores.
- Crear filtros básicos.
- Crear página de detalle.

### Día 4

- Implementar matching básico.
- Añadir botón de contacto por WhatsApp.
- Añadir borrado con `deleteToken`.
- Pulir validaciones.

### Día 5

- Probar flujo completo.
- Añadir mensajes de seguridad.
- Preparar deploy.

## Deploy recomendado

Opción rápida:

- Frontend: Vercel
- Backend: Render, Railway o Fly.io
- Base de datos: Supabase Postgres, Neon o Railway Postgres

Opción más simple para un solo proveedor:

- Railway para backend y PostgreSQL
- Vercel para frontend

## Decisiones importantes

### Sin login al principio

Para salir rápido, el MVP puede funcionar sin cuentas de usuario.

Cada publicación genera un `deleteToken`. El usuario recibe un enlace privado para borrar o cerrar su publicación.

### Ubicación aproximada

La app debe guardar coordenadas para calcular cercanía, pero en público debe mostrar una zona aproximada, no una dirección exacta.

### WhatsApp como contacto inicial

Crear chat interno retrasaría el proyecto. Para el MVP, es suficiente un botón que abra WhatsApp con un mensaje prellenado.

## Riesgos

- Publicaciones falsas o spam.
- Personas compartiendo datos sensibles.
- Encuentros inseguros.
- Datos de ubicación demasiado precisos.
- Falta de moderación.

## Medidas prácticas contra riesgos

- Rate limit por IP.
- Botón para reportar publicación.
- Avisos de seguridad visibles.
- Ubicación aproximada.
- Moderación manual básica desde base de datos o panel mínimo.
- Estados de publicación: activa, cerrada, reportada.

## Definición de MVP terminado

El MVP está listo cuando una persona puede:

1. Publicar que necesita ayuda.
2. Publicar que quiere ayudar.
3. Ver ambas publicaciones en un mapa.
4. Filtrar por tipo de ayuda.
5. Abrir una publicación.
6. Ver matches sugeridos.
7. Contactar por WhatsApp.
8. Borrar o cerrar su publicación con un enlace privado.
