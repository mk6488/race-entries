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
  const common = {
    id,
    value,
    placeholder,
    required,
    disabled,
    'aria-invalid': !!error || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      {props.as === 'textarea' ? (
        <textarea className="field-control" {...common} rows={props.rows ?? 4} />
      ) : (
        <input className="field-control" {...common} type={(props as InputProps).type ?? 'text'} />
      )}
      {hint && !error ? <div className="field-hint">{hint}</div> : null}
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  )
}
