'use client'

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, placeholder, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "flex h-10 w-full appearance-none rounded-[10px] border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-orange-500 [box-shadow:inset_0px_-2px_0px_0px_#e4e4e7,_0px_1px_4px_0px_rgba(228,_228,_231,_40%)] focus:[box-shadow:inset_0px_-2px_0px_0px_#f97316,_0px_1px_4px_0px_rgba(249,_115,_22,_20%)] disabled:shadow-none",
            className
          )}
          ref={ref}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-3 h-4 w-4 pointer-events-none text-zinc-500" />
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }