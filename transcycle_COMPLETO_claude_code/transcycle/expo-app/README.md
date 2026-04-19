# TransCycle Expo

Migracion de la app Flutter a Expo Go.

## Arranque

```powershell
cd expo-app
npm install
npx expo start
```

## Expo Go

En abril de 2026, la documentacion de Expo indica que durante la transicion a SDK 55, si quieres usar Expo Go en un dispositivo fisico conviene crear/probar con SDK 54.

Fuentes oficiales:

- https://docs.expo.dev/more/create-expo/
- https://docs.expo.dev/guides/typescript/

## Configuracion de API

Edita `src/config.js` y cambia `API_BASE_URL` por la URL de tu backend Express, por ejemplo:

```js
export const API_BASE_URL = "http://192.168.1.20:3000";
```

Si la API no esta configurada o no responde, la app entra en modo demo para que puedas abrirla en Expo Go igual.

## Conexion real actual

La configuracion actual ya apunta a:

```js
http://192.168.1.87:3000
```

Eso funciona si:

1. Tu celular y tu PC estan en la misma red local.
2. El backend esta corriendo en `backend` con puerto `3000`.
3. El firewall de Windows permite conexiones entrantes a Node en ese puerto.

Para arrancar el backend:

```powershell
cd ..\backend
npm install
npm run dev
```

Luego arranca Expo:

```powershell
cd ..\expo-app
npm install
npx expo start
```

Si cambias de red o tu IP local cambia, actualiza `src/config.js`.
