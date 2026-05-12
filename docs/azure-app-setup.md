# Registro de aplicación Azure (Entra ID) — fase 1

Pasos para obtener `VITE_MSAL_CLIENT_ID` y `VITE_MSAL_TENANT_ID` (puedes usar `common` para multi-tenant personal).

## 1. Crear el registro

1. Entra al [portal de Azure](https://portal.azure.com/) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. **Name**: por ejemplo `Cloud Media Player (dev)`.
3. **Supported account types**: según tu caso (cuentas personales Microsoft: *Accounts in any organizational directory and personal Microsoft accounts*).
4. **Redirect URI**: plataforma **Single-page application (SPA)** y URL `http://localhost:5173` (añade también tu dominio de producción cuando despliegues).

## 2. Permisos delegados (Microsoft Graph)

En **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**, añade como mínimo:

| Permiso | Uso |
|---------|-----|
| `Files.Read` | Listar y leer archivos de OneDrive del usuario |
| `User.Read` | Perfil básico (`/me`) |
| `offline_access` | Refresh token para MSAL (sesión prolongada) |

Opcional si tu tenant lo requiere: `Files.Read.All`.

Pulsa **Grant admin consent** si es una cuenta corporativa y tu administrador lo exige.

## 3. Credenciales

En **Overview** copia:

- **Application (client) ID** → `VITE_MSAL_CLIENT_ID`
- **Directory (tenant) ID** → `VITE_MSAL_TENANT_ID` (o `common` / `organizations` según el tipo de cuentas)

No necesitas *client secret* para una SPA (PKCE en el navegador).

## 4. Variables en el proyecto

Copia [`.env.example`](../.env.example) a `.env` y rellena los valores. Reinicia `npm run dev` tras cambiar `.env`.

## 5. Firebase Auth (esta fase)

La app usa **Firebase Authentication anónima** solo para aislar datos en Firestore por sesión de navegador, y **MSAL** para OneDrive/Graph. En producción conviene un **Custom Token** que una el `oid` de Microsoft con `request.auth.uid` (Cloud Function); eso no forma parte de este documento.

## 6. Error AADSTS50020 (cuenta @outlook.com / live.com)

Mensaje típico: la cuenta personal **no existe en el tenant** del directorio donde registraste la app (p. ej. «Directorio predeterminado») y **no puede entrar** porque el registro solo admite usuarios **de esa organización**.

**Qué hacer**

1. Portal Azure → **Microsoft Entra ID** → **App registrations** → tu app **Cloud Media Player (dev)**.
2. **Authentication** (o al crear el registro, el paso **Supported account types**):
   - Elige **«Accounts in any organizational directory and personal Microsoft accounts»** (cuentas de trabajo y personales), **o** al menos la opción que incluya **Personal Microsoft accounts**.
3. Guarda los cambios. Si cambiaste el tipo de cuentas, puede tardar unos minutos en aplicarse.
4. En `.env`, para cuentas personales y mixtas suele ir bien `VITE_MSAL_TENANT_ID=common` (como en [`.env.example`](../.env.example)). Si la app quedó solo para consumidores MSA, en algunos casos se usa `consumers`; con **multitenant + personal** lo habitual es **`common`**.

Tras esto, **sí puedes usar tu OneDrive personal** asociado a `imramiro@outlook.com`: Graph usará `/me` y el OneDrive de **esa misma cuenta** con los permisos `Files.Read` que aceptes al iniciar sesión.

**Resumen:** no es que OneDrive «no valga»; es que el registro de la app debe **permitir el tipo de cuenta** con la que entras (personal vs solo empresa). Una misma app puede dar servicio a OneDrive personal o laboral según quién inicie sesión, siempre que el tipo de cuentas del registro lo permita.

## 7. Error al guardar Authentication: `api.requestedAccessTokenVersion is invalid`

Suele pasar al elegir **«Any Entra ID tenant + Personal Microsoft accounts»** (o equivalente) y pulsar **Save** en la hoja **Authentication**: el portal valida la versión de token de la aplicación y falla si el **manifiesto** no es coherente.

**Qué hacer (orden recomendado)**

1. Abre la misma app → **Manifest** (no Authentication).
2. Busca la propiedad **`accessTokenAcceptedVersion`**:
   - Ponla en **`2`** (número entero, sin comillas).
   - Si no existe, añádela al JSON del manifiesto al nivel raíz del objeto de la aplicación (junto a `id`, `appId`, etc.): `"accessTokenAcceptedVersion": 2`
3. **Save** el manifiesto y espera a que confirme.
4. Vuelve a **Authentication** → elige de nuevo **Any Entra ID tenant + Personal Microsoft accounts** → **Save**.

Si seguía fallando: revisa que no haya valores extraños en el manifiesto (por ejemplo `accessTokenAcceptedVersion` como cadena `"2"` en lugar de número `2`, o un valor distinto de `null`, `1` o `2`). Para SPA + cuentas personales + endpoint v2, **`2`** es lo habitual.

**Nota:** El mensaje del portal habla de `requestedAccessTokenVersion`; en la práctica se corrige casi siempre con **`accessTokenAcceptedVersion`** en el manifiesto.

## 8. Callback `localhost:5173/#error=server_error` y consola `no_token_request_cache_error`

- **`#error=server_error`**: Microsoft rechazó el inicio de sesión (motivo genérico). Revisa en Azure **Entra ID → Sign-in logs** el intento fallido para el detalle real (consentimiento, CA, cuenta, etc.).
- **`no_token_request_cache_error` (MSAL)**: Suele aparecer cuando la URL trae un fragmento de error OAuth pero **no hay** una petición redirect pendiente en `localStorage`/`sessionStorage` (p. ej. **InPrivate**, datos del sitio borrados, pestañas duplicadas, o mezcla de flujos).

**Qué hacer**

1. Prueba **fuera de InPrivate** en Edge y borra datos del sitio solo para `localhost` (Cookies + almacenamiento local).
2. Cierra pestañas extra de `localhost:5173` y vuelve a abrir `/login`.
3. La app limpia el `#error=...` del hash al arrancar para que no quede en bucle; si `server_error` sigue, el problema está **en Azure / cuenta / consentimiento**, no en el hash en sí.

Si necesitas más texto de error, a veces Microsoft añade `error_description` en el mismo hash (URL-encoded); míralo en la consola del navegador tras el aviso `[MSAL] Error en URL del IdP`.
