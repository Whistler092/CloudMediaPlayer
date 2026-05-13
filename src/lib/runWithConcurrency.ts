/**
 * Ejecuta tareas async con a lo sumo `limit` en vuelo (útil para varios
 * `scanDriveFolder` sin saturar Microsoft Graph).
 */
export async function runWithConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  if (tasks.length === 0) return []
  const cap = Math.max(1, Math.floor(limit))
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0
  let active = 0

  return new Promise((resolve, reject) => {
    const drain = () => {
      while (active < cap && nextIndex < tasks.length) {
        const i = nextIndex++
        active++
        void tasks[i]!()
          .then((v) => {
            results[i] = v
            active--
            if (nextIndex >= tasks.length && active === 0) resolve(results)
            else drain()
          })
          .catch(reject)
      }
    }
    drain()
  })
}
