import      _                                   /**/ from 'lodash'
import      { iterfunc, azalnumbar}                  from '../consts/AllPrimchecks.ts'
import type * as TY                                  from '../types/index.ts'
//
export *                                             from './BootChecks.ts'
export *                                             from '../consts/PrimshapeChecks.ts'

export interface Story {
  ok?:               boolean
  before?:           TY.BecameT
  became?:           TY.BeforeT
  gist?:             TY.Label
  [key: string]:     any
}

export const funcOrKey      = azalnumbar.or(iterfunc).describe('collection function or key of collection element')
