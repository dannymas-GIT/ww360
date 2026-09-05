import * as React from 'react';

import { cn } from '@/lib/utils';

type NativeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onChange'>;

export interface CheckboxProps extends NativeInputProps {
  /** Boolean (or `'indeterminate'`) controlled checked state. */
  checked?: boolean | 'indeterminate';
  /** Radix-style change handler used by shadcn-style call sites. */
  onCheckedChange?: (checked: boolean) => void;
  /** Native onChange still works if a caller wires it up directly. */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref]
    );

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = checked === 'indeterminate';
      }
    }, [checked]);

    const isChecked = checked === 'indeterminate' ? false : !!checked;

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onCheckedChange?.(e.target.checked);
        onChange?.(e);
      },
      [onCheckedChange, onChange]
    );

    return (
      <input
        type="checkbox"
        className={cn(
          'h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer',
          className
        )}
        ref={setRefs}
        checked={isChecked}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
