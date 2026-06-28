# Help Venezuela Design System

Este documento define la línea visual de la aplicación. Antes de modificar UI, layout, formularios, tarjetas o estilos globales, leer este archivo y respetar estas reglas salvo que se decida explícitamente un rediseño.

## Principios

- La base visual son componentes `shadcn/ui` con estilo `new-york-v4`.
- No editar componentes de `apps/web/src/components/ui` para necesidades puntuales de pantalla; extenderlos con `className` o crear composición fuera.
- La interfaz debe sentirse seria, clara y asistencial: baja ornamentación, contraste legible, jerarquía evidente y mucho orden.
- La escala visual se basa en múltiplos de `4px`, con énfasis práctico en `8px`, `16px`, `24px` y `32px`.
- Cada pantalla debe tener una jerarquía única: título principal, contexto breve, contenido accionable y feedback.

## Tokens

Los tokens principales viven en `apps/web/src/styles.css`.

- `--space-1`: `4px`, micro separación.
- `--space-2`: `8px`, icono-texto, chips, acciones compactas.
- `--space-3`: `12px`, separación interna ligera.
- `--space-4`: `16px`, gap estándar entre campos y tarjetas.
- `--space-5`: `20px`, separación media.
- `--space-6`: `24px`, separación de bloques.
- `--space-8`: `32px`, separación fuerte y padding hero.
- `--surface-padding`: padding de paneles/tarjetas de contenido.
- `--section-gap`: separación vertical entre secciones de formulario.

Regla: si necesitas un nuevo espacio, primero intenta usar uno de estos tokens. Evita valores sueltos como `14px`, `18px`, `28px` salvo justificación visual clara.

## Tipografía

- Fuente base: `Geist Variable`.
- Body: `16px`, line-height aproximado `1.55`.
- Labels y ayudas: `14px`, peso `500`.
- Metadatos, badges auxiliares y contadores: `12px`.
- Títulos de tarjeta/sección: `16px`, peso `650`.
- Título de formulario/página: `24px–32px`, peso `700`.
- Hero home: grande, condensado visualmente, con tracking negativo.

Regla: no subir peso y tamaño a la vez sin necesidad. Para dar jerarquía, preferir tamaño + espacio antes que saturar con `font-weight: 800`.

## Layout

- Las pantallas usan padding fluido con `--page-inline` y `--page-block`.
- Formularios principales usan `--content-max-sm` (`44rem`).
- Gestión/listados usan `--content-max-md` (`54rem`).
- Superficies importantes usan `.panel`: borde, radio `--radius-xl`, sombra sutil y `--surface-padding`.
- En móvil, el contenido baja a una columna y los paneles reducen padding a `16px`.

Regla: un bloque visual nuevo debe decidir si es página, panel, sección o elemento inline. No mezclar responsabilidades.

## Formularios

- La separación estándar entre campos es `16px`.
- La separación entre secciones del formulario es `24px`.
- Cada `fieldset.form-section` debe tener `legend` claro y contenido agrupado.
- Labels van cerca de su control: gap `8px`.
- Dos columnas solo cuando ambos campos tienen el mismo peso lógico; en móvil siempre una columna.
- Textareas tienen altura mínima de `7rem`.
- Mensajes secundarios o campos bloqueados usan `--muted` y `--muted-foreground`.

Regla: los formularios deben leerse por bloques, no como una lista larga indiferenciada.

## Componentes

- Botones, inputs, select, textarea, radio, badges y cards mantienen el sizing de `shadcn new-york-v4`.
- Para una acción primaria de formulario, usar `Button` default con clase `.primary-button` si debe ocupar ancho disponible.
- Para acciones secundarias, usar `variant="outline"` sin redefinir colores custom.
- Para acciones destructivas, usar `variant="destructive"` sin estilos rojos manuales.
- Chips de ayuda usan `Button` con `.chip`, `variant="default"` cuando está activo y `variant="outline"` cuando está inactivo.

Regla: no duplicar el sistema de botones con clases como colores, padding y border manuales. El componente base decide el look.

## Color

- La paleta de UI general es neutral, derivada de `shadcn`.
- Usar `var(--foreground)`, `var(--muted-foreground)`, `var(--card)`, `var(--border)`, `var(--primary)` antes de introducir colores nuevos.
- Los únicos colores semánticos propios actuales son:
  - `--help-success`: oferta/acción positiva.
  - `--help-danger`: necesidad, riesgo o eliminación.
  - `--help-warning`: aviso o estado intermedio.

Regla: no usar hexadecimales nuevos en UI general. Si hace falta un color semántico, crear token con nombre y uso concreto.

## Tarjetas y Listas

- Tarjetas usan espacio interno consistente; el contenido no debe tocar bordes.
- En listas, separación entre tarjetas: `16px`.
- Cabecera de tarjeta: título/estado en una fila con gap `12px`.
- Descripciones usan `muted-foreground`, no negro pleno, para que el título y acciones tengan prioridad.
- Acciones de tarjeta usan `.actions-row` con gap `8px`.

Regla: tarjetas densas deben ser escaneables en 3 segundos: tipo, ubicación/descripción, estado, acciones.

## Mapa

- El mapa es la única pantalla con layout fullscreen.
- Panel flotante usa la misma lógica de superficie: card, border, radius y sombra.
- Estado inferior usa pill informativa compacta.
- Marcadores pueden usar color semántico propio porque representan categorías, no branding.

Regla: los overlays del mapa no deben competir con el mapa; deben ser compactos y legibles.

## Checklist Para Nuevas Pantallas

- ¿Usa tokens de spacing existentes?
- ¿El título principal tiene una sola prioridad clara?
- ¿Los textos secundarios usan `muted-foreground`?
- ¿Los componentes base de `shadcn` siguen intactos?
- ¿Hay separación clara entre secciones?
- ¿Funciona a una columna en móvil?
- ¿No hay nuevos hexadecimales sueltos?
- ¿El build pasa después del cambio?
