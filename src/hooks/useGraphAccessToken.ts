import { useCallback } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { graphScopes } from '../auth/msalInstance'

/**
 * Devuelve un callback estable (misma referencia mientras `instance` no cambie).
 * No usar `accounts` en el closure sin useCallback: un array nuevo por render
 * rompe los useEffect que dependen de esta función y provoca bucles infinitos.
 */
export function useGraphAccessToken(): () => Promise<string> {
  const { instance } = useMsal()

  return useCallback(async (): Promise<string> => {
    const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
    if (!account) throw new Error('No hay sesión de Microsoft')
    try {
      const res = await instance.acquireTokenSilent({
        account,
        scopes: [...graphScopes],
      })
      return res.accessToken
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const res = await instance.acquireTokenPopup({
          account,
          scopes: [...graphScopes],
        })
        return res.accessToken
      }
      throw e
    }
  }, [instance])
}
