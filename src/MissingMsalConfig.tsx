export function MissingMsalConfig() {
  return (
    <div className="login-layout">
      <div className="login-page">
        <h1>Configuración pendiente</h1>
        <p>
          Añade <code>VITE_MSAL_CLIENT_ID</code> (y opcionalmente <code>VITE_MSAL_TENANT_ID</code>) en un archivo{' '}
          <code>.env</code> en la raíz del proyecto.
        </p>
        <p className="muted">Consulta <code>docs/azure-app-setup.md</code>.</p>
      </div>
    </div>
  )
}
