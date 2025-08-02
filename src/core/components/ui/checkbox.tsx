// src/core/components/ui/checkbox.tsx

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/core/libraries/utils"

interface CheckboxProps {
  id?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, id, ...props }, ref) => {
    const handleClick = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleClick()
      }
    }

    return (
      <button
        ref={ref}
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-gray-300 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          checked && "bg-blue-600 text-white border-blue-600",
          className
        )}
        {...props}
      >
        {checked && (
          <Check className="h-3 w-3" />
        )}
      </button>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }