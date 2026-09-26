import type { LoggerT }                            from './internal.ts'
import type { ZodType }                           from './BasicChecks.ts'
import      { oneof, custom  }                    from './BasicChecks.ts'
import      { LoglevelVals, LogStrategyVals }     from '../Consts.ts'

export const loglevel    = oneof(LoglevelVals)

export const logger      = custom((val: any): val is LoggerT        => { return (val?.trace !== undefined) && (!! val?.error) },        'Logger').describe('logger')          as ZodType<LoggerT>
