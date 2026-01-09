type BaseProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  hint?: string
  error?: string
}

type InputProps = BaseProps & {
  as?: 'input'
  type?: string
}

type TextareaProps = BaseProps & {
  as: 'textarea'
  rows?: number
}

type Props = InputProps | TextareaProps

export function Field(props: Props) {
  const { id, label, value, onChange, placeholder, required, disabled, hint, error } = props
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const common = {
    id,
    value,
    placeholder,
    required,
    disabled,
    'aria-invalid': !!error || undefined,
    'aria-describedby': describedBy,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}{required ? ' *' : ''}</label>
      {props.as === 'textarea' ? (
        <textarea className="field-control" {...common} rows={props.rows ?? 4} />
      ) : (
        <input className="field-control" {...common} type={(props as InputProps).type ?? 'text'} />
      )}
      {hint && !error ? <div className="field-hint" id={hintId}>{hint}</div> : null}
      {error ? <div className="field-error" id={errorId}>{error}</div> : null}
    </div>
  )
}
