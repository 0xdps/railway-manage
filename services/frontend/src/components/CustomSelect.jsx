import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Custom dropdown matching the railway-manage .custom-select design.
 *
 * Props:
 *   options    — [{ value, label, Icon? }]  Icon is a React component
 *   value      — currently selected value
 *   onChange   — (value) => void
 *   placeholder — label shown when nothing is selected (default "Select…")
 *   disabled   — boolean
 *   className  — extra CSS class on the root element
 */
export default function CustomSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function toggle() {
    if (!disabled) setOpen((o) => !o);
  }

  function select(option) {
    onChange(option.value);
    setOpen(false);
  }

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : null;
  const SelectedIcon = selectedOption?.Icon ?? null;

  return (
    <div ref={rootRef} className={`custom-select${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`custom-select-trigger${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`custom-select-value${!displayLabel ? ' placeholder' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: "5rem" }}>
          {SelectedIcon && <SelectedIcon />}
          {displayLabel ?? placeholder}
        </span>
        <ChevronDown size={13} className="custom-select-caret" />
      </button>

      {open && (
        <div className="custom-select-menu" role="listbox">
          {options.length === 0 ? (
            <div className="custom-select-option" style={{ opacity: 0.5, cursor: 'default' }}>
              No options
            </div>
          ) : (
            options.map((opt) => {
              const OptIcon = opt.Icon ?? null;
              return (
                <button
                  key={String(opt.value ?? '__null__')}
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  onClick={() => select(opt)}
                  className={`custom-select-option${value === opt.value ? ' selected' : ''}`}
                >
                  {OptIcon && <OptIcon />}
                  {opt.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
