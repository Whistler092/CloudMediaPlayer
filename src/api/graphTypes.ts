export interface GraphDriveItem {
  id: string
  name: string
  folder?: { childCount: number }
  file?: { mimeType?: string }
  size?: number
  lastModifiedDateTime?: string
  parentReference?: { id: string; path?: string }
  audio?: {
    title?: string
    album?: string
    artist?: string
    duration?: number
  }
  '@microsoft.graph.downloadUrl'?: string
}

export interface GraphListResponse<T> {
  value: T[]
  '@odata.nextLink'?: string
}
