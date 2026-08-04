import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * The class merger every shadcn component imports. `clsx` resolves conditionals,
 * `twMerge` then drops earlier Tailwind utilities that a later one overrides — so
 * `cn("px-2", "px-4")` yields `px-4` rather than both.
 *
 * Written by hand rather than by `shadcn init`, which would also have rewritten
 * app.css and replaced this repo's token layers. See ADR-0004's amendments.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
