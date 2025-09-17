import { useEffect, useState } from 'react'
import { addDoc, collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export function Entries() {
  const [items, setItems] = useState<Array<{ id: string; text: string }>>([])
  const [text, setText] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'items'), (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, text: d.get('text') as string }))
      setItems(next)
    })
    return () => unsub()
  }, [])

  async function addItem() {
    if (!text.trim()) return
    await addDoc(collection(db, 'items'), { text })
    setText('')
  }

  return (
    <div>
      <h1>Entries</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an entry" />
        <button onClick={addItem}>Add</button>
      </div>
      <ul>
        {items.map((i) => (
          <li key={i.id}>{i.text}</li>
        ))}
      </ul>
    </div>
  )
}


