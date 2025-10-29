# Burako Online

Monorepo para un MVP de Burako en tiempo real con un cliente React + Vite y un servidor Node.js con Socket.IO. Está pensado para desplegarse en Render.com con una base de datos PostgreSQL.

## Tech stack

- **Cliente**: React 19, Vite 7, TypeScript.
- **Servidor**: Node.js 18+, Express 5, Socket.IO 4, TypeScript.
- **Base de datos**: PostgreSQL (pendiente de integración real; se entrega la estructura para configurar la conexión).
- **Workspace**: npm workspaces (`client/`, `server/`).

## Requisitos previos

- Node.js 18.20 o superior.
- npm 10+.
- PostgreSQL (local o gestionado) para las futuras integraciones de persistencia.

## Instalación

```bash
npm install
```

npm instalará las dependencias del cliente y del servidor gracias a la configuración de workspaces.

## Variables de entorno

Crea archivos `.env` en cada paquete usando los ejemplos provistos:

- `client/.env` basado en `client/.env.example`.
- `server/.env` basado en `server/.env.example`.

Variables clave:

- `VITE_SERVER_URL`: URL del servidor WebSocket/HTTP.
- `PORT`: puerto de escucha del servidor.
- `CLIENT_ORIGINS`: lista de orígenes permitidos (separados por comas) para CORS.
- `DATABASE_URL`: cadena de conexión a PostgreSQL.

## Scripts principales

| Comando              | Descripción                                |
| -------------------- | ------------------------------------------ |
| `npm run dev:client` | Inicia el cliente Vite en modo desarrollo. |
| `npm run dev:server` | Inicia el servidor Node con `ts-node-dev`. |
| `npm run build`      | Compila cliente y servidor.                |
| `npm run lint`       | Ejecuta ESLint en el cliente.              |

> Ejecuta `npm run dev:client` y `npm run dev:server` en terminales separadas para desarrollo local.

## Render.com (guía rápida)

1. **Cliente**: desplegar como servicio estático apuntando al directorio `client`. Comando de build: `npm run build --workspace=client`. Directorio de publicación: `client/dist`.
2. **Servidor**: desplegar como servicio web apuntando a `server`. Comando de build: `npm run build --workspace=server`. Comando de start: `npm run start --workspace=server`. Asegurar variables `PORT`, `CLIENT_ORIGIN` y `DATABASE_URL`.
3. **Base de datos**: crear instancia PostgreSQL en Render y copiar el `DATABASE_URL` en las variables del servidor.

## Roadmap sugerido

1. Persistir mesas, usuarios y partidas usando PostgreSQL/Prisma o Drizzle.
2. Autenticación ligera (por ejemplo, magic links o Auth0) para preservar identidades.
3. Implementar reglas completas de Burako: turnos, melds, rummy y scoring.
4. Añadir reconexión y sincronización de estado al refrescar.
5. Integrar despliegues automáticos (CI/CD) y pruebas end-to-end.

## Estructura del proyecto

```
.
├── client
│   ├── src
│   │   ├── api
│   │   ├── hooks
│   │   ├── types
│   │   └── ...
│   └── package.json
├── server
│   ├── src
│   │   ├── game
│   │   ├── events.ts
│   │   ├── socketHandlers.ts
│   │   └── index.ts
│   └── package.json
└── package.json
```

## Estado actual

- Lobby en tiempo real con creación/unión de mesas.
- Gestión de jugadores en memoria (sin persistencia aún).
- UI básica para listar mesas, crear una nueva y ver los jugadores conectados.

¡A partir de aquí puedes ampliar la lógica del juego, la persistencia y pulir la experiencia visual!
