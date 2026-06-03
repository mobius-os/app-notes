// Masonry grid of note cards (CSS columns — true masonry, no JS layout).
// Pinned notes get their own section above the rest.
import { T } from './theme.js'
import Card from './Card.jsx'

export default function Grid({ notes, onOpen, onPin, onColor, onDelete }) {
  const t = T()
  const pinned = notes.filter((n) => n.meta.pinned)
  const others = notes.filter((n) => !n.meta.pinned)

  const header = (txt) => (
    <h2 style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: t.muted, margin: '4px 8px 10px',
    }}>{txt}</h2>
  )
  const cards = (list) => (
    <div style={{ columnGap: 14, columns: '240px' }}>
      {list.map((n) => (
        <Card key={n.meta.id} note={n} onOpen={onOpen} onPin={onPin} onColor={onColor} onDelete={onDelete} />
      ))}
    </div>
  )

  return (
    <div style={{ padding: '16px 14px 90px', maxWidth: 1100, margin: '0 auto' }}>
      {pinned.length > 0 && <section style={{ marginBottom: 18 }}>{header('Pinned')}{cards(pinned)}</section>}
      {others.length > 0 && <section>{pinned.length > 0 && header('Others')}{cards(others)}</section>}
    </div>
  )
}
