import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Reads `parse_archive.py`'s two controlled-vocabulary literals off its source
 * text, so a Vitest file can assert against the parser without retyping either
 * list — retyping is the drift this exists to prevent.
 *
 * Text, not execution: the suite is TypeScript and the parser needs `openpyxl`,
 * which no interpreter on the dev machine has (AGENTS.md). So this is a regex
 * over the source with two known limits, both fine for these literals: a value
 * may not contain `"` or the closing bracket of its own literal, and the
 * literal must open on the line that names it. A miss THROWS rather than
 * returning an empty list, so a moved or reformatted literal fails the tests
 * that read it instead of passing them vacuously.
 */
function source(): string {
  return readFileSync(join(import.meta.dirname, 'parse_archive.py'), 'utf8')
}

function block(name: string, open: string, close: string): string {
  const match = new RegExp(`^${name} = \\${open}([\\s\\S]*?)\\${close}`, 'm').exec(source())
  if (!match) throw new Error(`no ${name} = ${open}…${close} literal in parse_archive.py`)
  return match[1]
}

/** `ENUM`, in the parser's order — which mirrors the live dropdown's. */
export function readParserEnum(): string[] {
  return [...block('ENUM', '[', ']').matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

/** `ALIAS`, sheet spelling -> canonical `ENUM` value. */
export function readParserAlias(): Record<string, string> {
  return Object.fromEntries(
    [...block('ALIAS', '{', '}').matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((match) => [match[1], match[2]])
  )
}
