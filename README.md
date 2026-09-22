# Exploradores de Formas

Una aplicación de geometría para primer grado, en español rioplatense. Ocho juegos, tres niveles por juego y **48 retos base**. Todos están disponibles desde el mapa.

## Abrir y jugar

1. Descomprimí el ZIP completo.
2. Conservá los archivos en sus carpetas.
3. Abrí `index.html` con un navegador moderno que tenga JavaScript habilitado.

No hay instalación, compilación, backend, cuentas de alumnos, claves ni dependencias externas. El código no usa `fetch`. Los dibujos son SVG locales. La voz del navegador es opcional; el juego conserva sus textos y demostraciones si no hay voz disponible.

En tablets también podés abrir la dirección del sitio una vez publicado. El archivo local no instala una aplicación ni garantiza la disponibilidad sin conexión de un sitio visitado previamente; para eso usá la copia local completa.

## Publicar en Vercel

1. Subí la carpeta del proyecto a un repositorio Git e importalo en Vercel.
2. Elegí como **Root Directory** la carpeta que contiene `index.html`.
3. En **Framework Preset**, elegí **Other**.
4. Dejá vacío **Build Command**. No se necesita comando de instalación.
5. Usá la raíz `.` como **Output Directory**, o mantené el valor predeterminado de Other: este proyecto no tiene una carpeta `public`.
6. Publicá y compartí la dirección con la clase.

La aplicación no requiere servicios pagos. La publicación queda sujeta al plan y condiciones de la cuenta de alojamiento; quienes juegan no necesitan cuentas.

Referencia oficial: [configuración de proyectos estáticos en Vercel](https://vercel.com/docs/builds/configure-a-build). No se realizó una publicación en Vercel durante esta entrega.

## Qué incluye

| Lugar | Acción principal | Progresión |
|---|---|---|
| Taller de mosaicos | Elegir, girar y encajar piezas; desarmar lo construido | Pieza faltante → triángulos que componen figuras → mosaicos |
| El correo de las formas | Repartir entre buzones y revisar el reparto | Puntas y lados → tipos y bordes → propiedades de cuatro lados |
| Detectives de las pistas | Deducir con pistas acumulativas | Bordes y puntas → combinar propiedades → figuras transformadas |
| El intruso | Comparar una colección y explicar la excepción | Regla simple → observar grupos → comparar longitudes |
| Memoria de formas | Voltear cartas y recordar posiciones | 4 → 6 → 8 cartas |
| Caminos de figuras | Elegir pasos vecinos y planificar | Un tipo → alternancia AB → secuencia ABC |
| La máquina de series | Colocar figuras en huecos | AB → AAB → ABC; además creación para un compañero y serie libre |
| El reparador de figuras | Colocar segmentos o mover una esquina | Lado faltante → dirección y longitud → recuperar un cuadrado |

Cada nivel tiene dos retos. Las siguientes vueltas modifican el orden de piezas/cartas, sus transformaciones y los tableros de caminos. Cada reto generado se comprueba antes de presentarlo. El álbum tiene ocho lugares y seis piezas por lugar: volver a resolver el mismo reto no duplica su pieza.

## Para la clase

El botón **Docentes** contiene la guía completa de **38 minutos**: 5 de exploración, 24 para cuatro desafíos, 6 para buscar formas en el aula y 3 de conversación final. Permite elegir cuatro juegos, cambiar de actividad y usar un reloj opcional que se puede pausar.

- **Individual:** cada niño explora a su ritmo.
- **Parejas:** una persona manipula y otra explica.
- **Tríos:** se suma el rol de comprobar.
- **Pantalla interactiva:** todo el grupo acuerda antes de que una pareja pruebe.

Los roles rotan al pasar al siguiente reto, y también tienen un botón de cambio. No se piden nombres. Cada dispositivo mantiene su propia partida: **no hay sincronización entre tablets**.

## Controles y ayudas

- Mouse o pantalla táctil: elegí una pieza y luego el destino. En correo y series también hay arrastre.
- Teclado: `Tab` / `Mayús + Tab` para navegar, `Enter` o espacio para accionar; `Esc` para cerrar diálogos.
- **Escuchar**, **Repetir ejemplo** y **Pedir ayuda** están visibles en todos los juegos.
- Las ayudas progresan desde una propiedad hasta una señal visual, una demostración y una práctica parecida. La práctica conserva el reto original para volver a él.
- Memoria comienza en **modo tranquilo**: el niño decide cuándo tapar un par distinto. Al desactivarlo, permanece visible al menos tres segundos.
- **Deshacer** está disponible donde se colocan o mueven piezas y se construyen recorridos.
- **Reiniciar reto** limpia el tablero actual y conserva el álbum.
- Para empezar completamente de nuevo: **Docentes → Uso, accesibilidad y datos del dispositivo → Borrar progreso local y reiniciar**.
- **Sonido** permite silenciar voz y efectos por separado. Se respeta la preferencia de movimiento reducido.

El álbum y las preferencias se guardan en `localStorage`, si está disponible. Los tableros en curso se conservan al cambiar de juego durante la visita; al recargar comienzan de nuevo. Si el almacenamiento está bloqueado, se puede seguir jugando y el avance vive en memoria hasta cerrar o recargar la página.

Salir de un juego detiene sus esperas y locuciones. El reloj de clase pertenece al docente y continúa al cambiar de juego; puede pausarse y se detiene al cerrar la página.

## Exactitud geométrica

Un cuadrado girado sigue siendo cuadrado y es un caso particular de rectángulo. Cuando se separan sus nombres habituales, los otros rectángulos son **no cuadrados**. Una figura con cuatro lados iguales solo se acepta como cuadrado si también tiene cuatro ángulos rectos.

Los mosaicos comprueban cobertura exacta, huecos y superposiciones sobre una partición de triángulos, no por proximidad de píxeles. Los caminos aceptan cualquier recorrido válido, incluso revisitas compatibles con la secuencia. Las pistas no penalizan una figura que todavía es compatible: agregan información para distinguirla.

En el aula se buscan formas de caras, superficies y bordes, sin confundir figuras planas con cuerpos.

## Archivos

- `index.html`: entrada y recursos relativos.
- `styles.css`: identidad visual, adaptación de tamaños y accesibilidad visual.
- `geometry.js`: reglas geométricas, cobertura y búsqueda de recorridos.
- `challenges.js`: catálogo, generación y comprobación de retos.
- `script.js`: estado, interacción, presentación, voz, guía y álbum.
- `tests/verify.cjs`: pruebas opcionales de lógica, sin paquetes adicionales.

Los dos archivos JavaScript auxiliares son parte de la aplicación: deben acompañar siempre a `script.js`.

## Comprobaciones y límites

Se ejecutaron pruebas automatizadas de código que cubren:

- Los 48 retos base y 4.800 configuraciones obtenidas con 100 semillas.
- La resolución de los ocho juegos mediante sus controladores reales.
- Construcciones y recorridos alternativos, huecos, superposiciones y ángulos rectos.
- Respuestas compatibles con pistas parciales.
- Repetición de acciones sin duplicar premios, bloqueo de una tercera carta y espera de memoria.
- Deshacer, desarmar/reconstruir, reiniciar, cambiar de juego, práctica y retorno al reto original.
- Edición de patrones, serie libre, roles, selección de actividades, reloj y borrado local.
- Funcionamiento con voz ausente y almacenamiento bloqueado; cancelación de voz mediante una implementación de prueba.
- Flujo de Pointer Events mediante eventos simulados y validez del anidamiento HTML de las 48 pantallas iniciales.
- Integridad de los recursos locales y sintaxis JavaScript.

Para repetir las pruebas, **solo si tenés Node.js**:

```sh
node tests/verify.cjs
```

Node se usa únicamente para esa comprobación opcional; **no hace falta para jugar ni para publicar**.

**No se pudo completar la prueba visual en navegador:** el navegador disponible en el entorno bloqueó la apertura de archivos locales. Las pruebas de lógica usan un DOM mínimo simulado y no sustituyen el renderizado real. No se probaron tablets físicas, pantalla interactiva, lectores de pantalla, voces reales, Safari/iPadOS ni el despliegue en Vercel. Las reglas de CSS adaptables están implementadas, pero su distribución visual en esos equipos queda sin verificar.

Antes de la clase, conviene abrir el juego en el equipo que se va a usar y comprobar orientación vertical/horizontal, dos toques, sonido opcional y zoom. Esto es una verificación de dispositivo, no una funcionalidad pendiente de implementación.
#   e x p l o r a d o r e s - d e - f o r m a s  
 