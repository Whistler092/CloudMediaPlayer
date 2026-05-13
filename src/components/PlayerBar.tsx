import { usePlayer } from '../player/PlayerContext'
import { PlayerTransport } from './PlayerTransport'

export function PlayerBar() {
  const p = usePlayer()
  if (!p.currentTrack && p.queue.length === 0) return null

  return (
    <footer className="player-bar player-bar--compact">
      <PlayerTransport variant="bar" />
    </footer>
  )
}
