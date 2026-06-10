// Responsive grid of note cards. Fixed card tracks keep the home view boxy and
// scannable while still wrapping down to one column on narrow phones.
// Pinned notes get their own section above the rest.
import Card from './Card.jsx'

export default function Grid({ notes, onOpen, onPin, onColor, onDelete, resolveAttachment }) {
  const pinned = notes.filter((n) => n.meta.pinned)
  const others = notes.filter((n) => !n.meta.pinned)

  const header = (txt) => (
    <h2 className="nt-section-head">{txt}</h2>
  )
  const cards = (list) => (
    <div className="nt-cards">
      {list.map((n) => (
        <Card
          key={n.meta.id}
          note={n}
          onOpen={onOpen}
          onPin={onPin}
          onColor={onColor}
          onDelete={onDelete}
          resolveAttachment={resolveAttachment}
        />
      ))}
    </div>
  )

  return (
    <div className="nt-grid-wrap">
      {pinned.length > 0 && <section className="nt-section">{header('Pinned')}{cards(pinned)}</section>}
      {others.length > 0 && <section>{pinned.length > 0 && header('Others')}{cards(others)}</section>}
    </div>
  )
}
