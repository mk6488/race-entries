import { ReactNode } from 'react'

export function FormRow({ children, columns = 1 }: { children: ReactNode; columns?: 1 | 2 }) {
  return (
    <div className={columns === 2 ? 'form-row-2' : 'form-row-1'}>
      {children}
    </div>
  )
}
