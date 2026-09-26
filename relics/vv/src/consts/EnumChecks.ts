import { oneof }                          from '../checks/BootChecks.ts'
import * as CO                            from './internal.ts'

export  const ffmt                        = oneof(CO.Ffmts)
export  const currency                    = oneof(CO.CurrencyVals)
export  const countryCode                 = oneof(CO.CountryCodeVals)
export  const sortdir                     = oneof(CO.SortdirVals)
export  const roundingstrat               = oneof(CO.RoundingstratVals)
export  const strcase                     = oneof(CO.StrcaseVals)
export  const futurism                    = oneof(CO.FuturismVals)
export  const became                      = oneof(CO.BecameVals)
export  const before                      = oneof(CO.BeforeVals)
