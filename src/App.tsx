import { useEffect, useState } from 'react'
import { addDoc, collection, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'

export function App() {
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
    <div style={{ maxWidth: 640, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Race Entries</h1>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an item"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={addItem} style={{ padding: '8px 12px' }}>Add</button>
      </div>
      <ul>
        {items.map((i) => (
          <li key={i.id}>{i.text}</li>
        ))}
      </ul>
    </div>
  )
}


