# Help Venezuela Design System

Este documento es la fuente de verdad visual de la aplicacion. Antes de modificar UI, layout, espaciado, tipografia, formularios, tarjetas o estilos globales, leerlo completo y seguirlo salvo que se decida explicitamente un rediseno.

## Principios

- Base visual: componentes `shadcn/ui` con estilo `new-york-v4`.
- No editar `apps/web/src/components/ui/*` para necesidades puntuales de pantalla. Usar composicion, `className` y estilos de aplicacion en `apps/web/src/styles.css`.
- La interfaz debe sentirse seria, clara y asistencial: baja ornamentacion, contraste legible, jerarquia evidente y mucho orden.
- La escala visual usa multiplos de `4px`, con prioridad en `8px`, `16px`, `24px` y `32px`.
- Mobile first: todas las pantallas deben funcionar comodamente desde `320px` de ancho antes de optimizar desktop.
- Cada pantalla debe tener una jerarquia unica: titulo principal, contexto breve, contenido accionable y feedback.

## Tokens

Los tokens principales viven en `apps/web/src/styles.css`.

- `--space-1`: `4px`, micro separacion.
- `--space-2`: `8px`, icono-texto, chips, acciones compactas.
- `--space-3`: `12px`, padding minimo movil y separacion compacta.
- `--space-4`: `16px`, gap estandar entre campos y tarjetas.
- `--space-5`: `20px`, separacion media.
- `--space-6`: `24px`, separacion de bloques.
- `--space-8`: `32px`, separacion fuerte.
- `--touch-target`: altura minima tactil, actualmente `44px`.
- `--surface-padding`: padding de paneles/tarjetas de contenido.
- `--section-gap`: separacion vertical entre secciones de formulario.
- `--content-max-sm`: formularios principales, `44rem`.
- `--content-max-md`: gestion/listados, `54rem`.
- `--content-max-lg`: layouts amplios excepcionales, `75rem`.

Regla: si necesitas un nuevo espacio, primero intenta usar estos tokens. Evita valores sueltos como `14px`, `18px` o `28px` salvo justificacion visual clara.

## Tipografia

- Fuente base: `Geist Variable`.
- Body: `16px`, line-height aproximado `1.55`.
- Labels y ayudas: `14px`, peso `500`.
- Metadatos, badges auxiliares y contadores: `12px`.
- Titulos de tarjeta/seccion: `16px`, peso `650`.
- Titulo de formulario/pagina: `24px-32px`, peso `700`.
- Letter spacing: usar `0`. No usar tracking negativo para resolver jerarquia.

Regla: no subir peso y tamano a la vez sin necesidad. Para dar jerarquia, preferir tamano + espacio antes que saturar con `font-weight: 800`.

## Layout Responsive

- Las pantallas usan padding fluido con `--page-inline` y `--page-block`.
- El contenido principal siempre declara `width: min(100%, max-width-token)` para no desbordar.
- Formularios principales usan `--content-max-sm`; gestion/listados usan `--content-max-md`.
- Superficies importantes usan `.panel`: borde, radio, sombra sutil y `--surface-padding`.
- En movil, los paneles reducen padding a `16px`; bajo `480px`, el padding de pagina baja a `12px`.
- Toda cuadricula de dos columnas debe pasar a una columna en `900px` o antes si el contenido se comprime.
- Controles largos, botones y textos deben permitir salto de linea. Usar `min-width: 0` y `overflow-wrap` cuando haya contenido dinamico.
- Acciones de flujo en movil deben ocupar el ancho disponible o una grilla de una columna para ser faciles de tocar.

Regla: disenar primero para una columna clara en movil; desktop solo debe ampliar la lectura, no crear otra experiencia.

## Formularios

- Separacion estandar entre campos: `16px`.
- Separacion entre secciones: `24px`.
- Cada `fieldset.form-section` debe tener `legend` claro y contenido agrupado.
- Labels van cerca de su control: gap `8px`.
- Dos columnas solo cuando ambos campos tienen el mismo peso logico; en movil siempre una columna.
- Inputs compuestos pueden mantener subcolumnas si evitan desperdicio evidente, como prefijo de cedula + numero.
- Textareas tienen altura minima de `7rem`.
- Mensajes secundarios o campos bloqueados usan `--muted` y `--muted-foreground`.
- Los botones principales de formulario usan `.primary-button`.

Regla: los formularios deben leerse por bloques, no como una lista larga indiferenciada.

## Componentes

- Botones, inputs, select, textarea, radio, badges y cards mantienen el sizing base de `shadcn new-york-v4`.
- Para acciones primarias de formulario, usar `Button` default con `.primary-button`.
- Para acciones secundarias, usar `variant="outline"` y clases de composicion como `.secondary-button`.
- Para acciones destructivas, usar `variant="destructive"` y `.danger-button`.
- Chips de ayuda usan `Button` con `.chip`, `variant="default"` cuando esta activo y `variant="outline"` cuando esta inactivo.
- Radios de opcion usan `.radio-option`.

Regla: no duplicar el sistema de botones con colores, padding y bordes manuales. El componente base decide el look; las clases de pantalla solo ajustan layout.

## Color

- La paleta general es neutral, derivada de `shadcn`.
- Usar `var(--foreground)`, `var(--muted-foreground)`, `var(--card)`, `var(--border)` y `var(--primary)` antes de introducir colores nuevos.
- Colores semanticos propios:
  - `--help-success`: oferta/accion positiva.
  - `--help-danger`: necesidad, riesgo o eliminacion.
  - `--help-warning`: aviso o estado intermedio.

Regla: no usar hexadecimales nuevos en UI general. Si hace falta un color semantico, crear token con nombre y uso concreto.

## Tarjetas y Listas

- Tarjetas usan espacio interno consistente; el contenido no debe tocar bordes.
- En listas, separacion entre tarjetas: `16px`.
- Cabecera de tarjeta: titulo/estado con gap `12px`, permitiendo wrap en movil.
- Descripciones usan `muted-foreground`.
- Acciones de tarjeta usan `.actions-row` con gap `8px`; en movil pasan a una columna.
- Textos dinamicos de ubicacion, descripcion y coordenadas deben cortar linea sin desbordar.

Regla: tarjetas densas deben ser escaneables en 3 segundos: tipo, ubicacion/descripcion, estado, acciones.

## Mapa

- El mapa es la unica pantalla con layout fullscreen.
- `map-shell` usa `100dvh` para adaptarse mejor a barras moviles del navegador.
- El panel de publicaciones flota como superficie compacta; en movil no debe superar aproximadamente un tercio de la altura visible.
- El estado inferior usa una pill informativa compacta y debe permitir varias lineas en movil.
- Marcadores pueden usar color semantico propio porque representan categorias, no branding.

Regla: los overlays del mapa no deben competir con el mapa; deben ser compactos, legibles y no bloquear la exploracion principal.

## Checklist Para Nuevas Pantallas

- Usa tokens de spacing existentes.
- Funciona desde `320px` sin scroll horizontal.
- El contenido principal tiene `width: min(100%, max-width-token)`.
- Las grillas bajan a una columna en movil.
- Las acciones tactiles miden al menos `44px` de alto.
- El titulo principal tiene una sola prioridad clara.
- Textos secundarios usan `muted-foreground`.
- Los componentes base de `shadcn` siguen intactos.
- No hay nuevos hexadecimales sueltos.
- El build pasa despues del cambio.
