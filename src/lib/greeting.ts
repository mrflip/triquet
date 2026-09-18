import { z } from 'zod'
import { upperFirst } from 'es-toolkit/compat'

const GreetingValidators = z.object({
  name: z.string().min(1).optional(),
})

export type GreetingDNA = z.input<typeof GreetingValidators>

/** Friendly greeting for `dna.name`, capitalized, defaulting to 'World' when omitted */
export function greet(dna?: GreetingDNA): string {
  const { name } = GreetingValidators.parse(dna ?? {})
  return `Hello, ${upperFirst(name ?? 'world')}!`
}
