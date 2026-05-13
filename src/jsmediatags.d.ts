declare module 'jsmediatags' {
  const jsmediatags: {
    read(
      location: Blob,
      callbacks: {
        onSuccess: (tag: { tags: Record<string, unknown> }) => void
        onError: (error: unknown) => void
      },
    ): void
  }
  export default jsmediatags
}
