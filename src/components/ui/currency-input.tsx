import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

interface CurrencyInputProps {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  allowNull?: boolean;
  className?: string;
}

/**
 * Formats a number to pt-BR display (dots for thousands, comma for decimals).
 * On focus the raw number is shown for easy editing.
 */
export function CurrencyInput({ id, value, onChange, allowNull = false, className }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display value from prop when not focused
  useEffect(() => {
    if (isFocused) return;
    if (value === null || value === undefined) {
      setDisplayValue('');
    } else if (value === 0) {
      setDisplayValue('');
    } else {
      setDisplayValue(formatBR(value));
    }
  }, [value, isFocused]);

  const formatBR = (num: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number for editing
    if (value === null || value === undefined || value === 0) {
      setDisplayValue('');
    } else {
      // Use dot as decimal for editing, no thousands separator
      setDisplayValue(String(value));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Parse what user typed
    const parsed = parseInput(displayValue);
    if (parsed === null) {
      onChange(allowNull ? null : 0);
    } else {
      onChange(parsed);
    }
  };

  const parseInput = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Accept both comma and dot as decimal separator
    const normalized = trimmed.replace(/\./g, '').replace(',', '.');
    const num = Number(normalized);
    return isNaN(num) ? null : num;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  };

  return (
    <Input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  );
}
