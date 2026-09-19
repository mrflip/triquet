import type * as ZImp from 'zod'
import type { ParseReport } from './ZodInternal.ts'

declare module "zod" {
  // abstract class ZodType<Output = any, Def extends ZodTypeDef = ZodTypeDef, Input = Output> {

  // @ts-ignore
  // @ts-expect-error WONTFIX -- this is a monkeypatch // @ts-ignore
  interface ZodType<Output = any, _Def extends ZImp.ZodTypeDef = ZImp.ZodTypeDef, Input = Output> {
    checkname:      string

    report<RT, Paths extends string>(subj:   RT, story?: Record<string, any> | undefined, params?: Partial<ZImp.ParseParams> | undefined): ParseReport<RT, Paths>
    check(subj: any,   story?: Record<string, any> | undefined, params?: Partial<ZImp.ParseParams> | undefined): boolean
    cast(data: Input,  story?: Record<string, any> | undefined, params?: Partial<ZImp.ParseParams> | undefined): Output
    passthrough(): this
  }
}
