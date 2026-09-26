import _                           /**/ from 'lodash'
import type {
  ZodBoolean, ZodBranded, ZodEnum, ZodLiteral, ZodNullable, ZodNumber, ZodObject, ZodOptional, ZodPipeline, ZodString, ZodTypeAny,
}                                       from './ZodInternal.ts'
import type { AnyBag, PartialBag, StrArrNZ } from '../types/index.ts'
import      { decorate, throwable }     from '../utils/UF.ts'
import      { Z, ensureDescribed }      from './ZodInternal.ts'
import      * as CheckerTypers          from './ZodTypeguards.ts'
import      * as Checks                 from '../checks/internal.ts'
import      {
  ZMakers,         isDuration,    isLuxontime,
  //
  addrpart,       alnum,          alnumbar,       anybag,         anything,       asciish,
  azalnum,        azalnumbar,     bareint,        became,         before,         bigint,
  bigstr,         blobbish,       bool,           boolish,        boolstr,        brandcode,
  brandname,      byte,           camel,          ccmasked,       city,           colname,
  company,        country,        countryCode,    crDT,           crISO,          crTC,
  crTS,           currency,       days,           dashlabel,      deliveryHints,  distance,       dotfield,
  duration,       duration2obj,   duration2str,   email,          emoji,          expiresDT,
  expiresISO,     expiresTC,      expiresTS,      extkey,         extkeyish,      exturi,
  family,         familyName,     ffmt,           fieldname,      firstName,      float,
  fmt,            fullname,       fullstr,        func,           func0args,      func1arg,
  funcAnyargs,    funcOrKey,      funcPassthru,   futurism,       givenName,      guidv4,
  guidv4TT,       handle,         handleish,      hexcolor,       hexrange,       hostPortPair,
  hostPortStr,    hostname,       hostorip,       hours,          hrutc,          httpMETHOD,
  httpMethod,     id26,           idk,            idkbag,         idkstr,         imageOrUrl,
  imageStub,      image_path,     int32,          int64,          intstr,         ipv4host,
  ipv6host,       iso,            isodate,        isodur,         isodur_str,     isonearfut,
  isonowish,      isotime,        isoymd,         isoymdhms,      iterfunc,       jsdate,
  keyish,         label,          lastName,       lat,            liveurl,        lng,
  loalnumbar,     loazalnumbar,   locamel,        lodotfield,     longtitle,      loosetime,
  lower,          luxontime,      mashword,       masked_num,     maskedccnum,    medstr,
  middleName,     millis,         minutc,         minutes,        modern,         moneyish,
  monthday,       monthnum,       months,         namepart,       namespace,      namestr,
  nearfuttc,      nearfutts,      nearpastts,     neartc,         nearts,         nearyear,
  nickname,       notOK,          noteish,        notestr,        notnil,         notund,
  num,            numstr,         ok,             orig,           parsedUrlpath,  pctcode,
  phone,          phrasetag,      place_stub,     plain,          plainwords,     plan,
  poBox,          portnum,        postcode,       price,          pricestr,       pts_stub,
  pxdim,          qtdotfield,     qtystr,         quantity,       quarters,       refreshedDT,
  refreshedISO,   refreshedTC,    refreshedTS,    reg,            regexp,         regexstr,
  roundingstrat,  rqDT,           rqISO,          rqTC,           rqTS,           safeint,
  safenum,        seconds,        secutc,         shortstr,       sintstr,        snake,
  snumstr,        sortdir,        sstrint,        sstrnum,        str,            strToHostPort,
  stradd1,        stradd2,        strcase,        stringish,      strint,         strnum,
  strset,         tagsegs,        tax_rate,       tblname,        textish,        timecode,
  timestamp,      timevals,       titleish,       tkvDT,          tkvISO,         tkvTC,
  tkvTS,          trimmed,        trimpolice,     tstype,         typenamestr,    ubux,
  uint32,         uint64,         uintstr,        ulid,           unk,            unkbag,
  unumstr,        upDT,           upISO,          upTC,           upTS,           upalnumbar,
  upazalnum,      upazalnumbar,   upper,          urlOrPathToLiveurl, urlobj,         urlpath,
  urlstr,         ustrint,        ustrnum,        varname,        weeks,          whim,
  yayOK,          years,          znever,
  // paste newly added checks here and in the right group below
  absglob, abspath, anyfext, anyglob, anypath, awsregion, bareglob, barename, baseglob, basename, comprfext,
  dirent, extglob, extname, fext, globseg, ino, knownfext, logger, loglevel, pathseg, pathseglist,
  pathsegs, relglob, relpath, s3Bucket, stream,

} from '../checks/internal.ts'
import type { ZodType, ZodTypeDef } from 'zod/v3'

type ZodStringish  = ZodString  | ZodNullable<ZodString>  | ZodOptional<ZodString>  | ZodPipeline<any, ZodString> | ZodBranded<ZodString, string> | ZodOptional<ZodPipeline<any, ZodString>> | ZodLiteral<string>
type ZodNumberish  = ZodNumber  | ZodNullable<ZodNumber>  | ZodOptional<ZodNumber>  | ZodPipeline<any, ZodNumber> | ZodBranded<ZodNumber, number>
type ZodBooleanish = ZodBoolean | ZodNullable<ZodBoolean> | ZodOptional<ZodBoolean> | ZodPipeline<any, ZodBoolean> | ZodType<string | number, any, number, ZodTypeDef>

export const StrChecks = {
  addrpart,       alnum,          alnumbar,       asciish,        azalnum,        azalnumbar,
  bigstr,         blobbish,       brandcode,      brandname,      camel,          ccmasked,
  city,           colname,        company,        crISO,          crTC,           dashlabel, deliveryHints,
  dotfield,       email,          emoji,          expiresISO,     expiresTC,      extkey,
  extkeyish,      exturi,         family,         familyName,     fieldname,      firstName,
  fmt,            fullname,       fullstr,        givenName,      guidv4,         guidv4TT,
  handle,         handleish,      hexcolor,       hexrange,       hostPortStr,    hostname,
  hostorip,       id26,           idkstr,         image_path,     intstr,         ipv4host,
  ipv6host,       iso,            isodate,        isodur_str,     isonearfut,     isonowish,
  isotime,        isoymd,         isoymdhms,      keyish,         label,          lastName,
  loalnumbar,     loazalnumbar,   locamel,        lodotfield,     longtitle,      lower,
  mashword,       masked_num,     maskedccnum,    medstr,         middleName,     moneyish,
  namepart,       namespace,      namestr,        nearfuttc,      neartc,         nickname,
  noteish,        notestr,        numstr,         orig,           pctcode,        phone,
  phrasetag,      plain,          plan,           poBox,          postcode,       pricestr,
  qtdotfield,     qtystr,         refreshedISO,   refreshedTC,    reg,            regexstr,
  rqISO,          rqTC,           shortstr,       sintstr,        snake,          snumstr,
  str,            stradd1,        stradd2,        stringish,      tagsegs,        tax_rate,
  tblname,        textish,        timecode,       titleish,       tkvISO,         tkvTC,
  trimmed,        trimpolice,     tstype,         typenamestr,    uintstr,        ulid,
  unumstr,        upISO,          upTC,           upalnumbar,     upazalnum,      upazalnumbar,
  upper,          urlstr,         varname,        whim,
  //
  absglob, abspath, anyglob, anypath, bareglob, barename, baseglob, basename,
  extglob, extname, globseg, pathseg, pathsegs, relglob, relpath, s3Bucket,
  anyfext,
} as const satisfies PartialBag<keyof typeof Checks, ZodStringish>

export const OneofChecks = {
  became,         before,         country,        countryCode,    currency,       ffmt,
  futurism,       httpMETHOD,     httpMethod,     roundingstrat,  sortdir,        strcase,
  awsregion,      loglevel,
  comprfext, fext, knownfext,
} as const satisfies PartialBag<keyof typeof Checks, ZodEnum<StrArrNZ>>
// const ZodtypedOneofChecks = {
//   agtname,        boxname,        reponame,       agtnick,        appnick,        appname,        boxkind,        reponick,
// }
// _.merge(OneofChecks, ZodtypedOneofChecks)

export const ObjChecks = {
  imageStub,      place_stub,     price,          pts_stub,       timevals,
} as const satisfies PartialBag<keyof typeof Checks, ZodObject<any, any, any>>
export const ZodTypedObjChecks = {
} as const
_.merge(ObjChecks, ZodTypedObjChecks)

export const NumChecks = {
  bareint,        byte,           crTS,           days,           distance,       expiresTS,
  float,          hours,          hrutc,          int32,          int64,          lat,
  lng,            millis,         minutc,         minutes,        monthday,       monthnum,
  months,         nearfutts,      nearpastts,     nearts,         nearyear,       num,
  portnum,        pxdim,          quantity,       quarters,       refreshedTS,    rqTS,
  safeint,        safenum,        seconds,        secutc,         sstrint,        sstrnum,
  strint,         strnum,         timestamp,      tkvTS,          ubux,           uint32,
  uint64,         upTS,           ustrint,        ustrnum,        weeks,          years,
  ino,
} as const satisfies PartialBag<keyof typeof Checks, ZodNumberish | typeof sstrint>
// export const ZodTypedNumChecks = {
//   appnum,
// } as const
// _.merge(NumChecks, ZodTypedNumChecks)

export const BoolChecks = {
  bool,           boolish,        boolstr,        ok,
} as const satisfies PartialBag<keyof typeof Checks, ZodBooleanish>

export const OtherChecks = {
  anybag,         anything,       bigint,         crDT,           duration,       duration2obj,
  duration2str,   expiresDT,      func,           func0args,      func1arg,       funcAnyargs,
  funcOrKey,      funcPassthru,   hostPortPair,   idk,            idkbag,         imageOrUrl,
  isodur,         iterfunc,       jsdate,         liveurl,        loosetime,      luxontime,
  modern,         notOK,          notnil,         notund,         parsedUrlpath,  plainwords,
  refreshedDT,    regexp,         rqDT,           strToHostPort,  strset,         tkvDT,
  unk,            unkbag,         upDT,           urlobj,         urlpath,        urlOrPathToLiveurl,
  yayOK,          znever,
  dirent, logger, pathseglist,
  stream,
  // appnick, boxname, agtname, reponame, appnum,
} as const satisfies PartialBag<keyof typeof Checks, ZodTypeAny>

// export const StringishChecks = { ...StrChecks, ...OneofChecks  } as const satisfies PartialBag<keyof typeof Checks, ZodStringish | ZodEnum<StrArrNZ>>
export const Zcheckers = {
  ...StrChecks, ...OneofChecks, ...NumChecks, ...BoolChecks, ...ObjChecks, ...OtherChecks,
  ...ZodTypedObjChecks, // ...ZodtypedOneofChecks, ...ZodTypedNumChecks,
} as const // satisfies Record<keyof typeof Zcheckers, ZodTypeAny>

// Combine the Makers (obj, arr, etc), the utils (zShape, ...) and the Shapers (quantity, safeint, ...)
export const ZodFood = {
  ...Zcheckers, ...ZMakers,
  isDuration, isLuxontime,
} as const // satisfies ZcheckersT & ZMakersT

export type ZcheckersT       = typeof Zcheckers
export type ZodFoodT       = typeof ZodFood
export type Checkname      = keyof  ZcheckersT
export type StrCheckname   = keyof typeof StrChecks
export type OneofCheckname = keyof typeof OneofChecks
export type NumCheckname   = keyof typeof NumChecks
export type BoolCheckname  = keyof typeof BoolChecks
export type ObjCheckname   = keyof typeof ObjChecks
export type OtherCheckname = keyof typeof OtherChecks
//
// type _NameChecks = AsExpected<[
//   [never, Exclude<StrCheckname, Checkname>],
//   [never, Exclude<Checkname, StrCheckname | OneofCheckname | NumCheckname | BoolCheckname | ObjCheckname | OtherCheckname>],
// ]>

// What the function inside a Validator call returns: checknames as keys, zod checks as values
export type Zodderbag<KT extends string> = { [key in KT]: ZodTypeAny }  // , Output = any, Def extends ZodTypeDef = ZodTypeDef, Input = Output> = Record<KT, ZodType<Output, Def, Input>>
// These are the functions fed to Validator: turning the big ZodFood menu into a Zodderbag
export type  ZVShaper<KT extends string, ZOT extends Zodderbag<KT>> = (zvs: ZodFoodT) => ZOT

// Call this with a
export function Validator<KT extends string, ZOT extends Zodderbag<KT>>(shaper: (zvs: ZodFoodT) => ZOT) {
  // const shapes: ZOT = shaper(ZodFood)
  // return _.mapValues(shapes, (shape) => Z.object(shape)) as Zodified<KT, ZOT>
  const lintbag = {} as AnyBag
  const raws = shaper(ZodFood)
  const validator = _.mapValues(raws, (zcheck, checkname) => {
    if (! CheckerTypers.isChecker(zcheck)) { lintbag[checkname] = `Validator got ${checkname}, but it is not a checker -- maybe it's missing or needs an obj() wrapper?` }
    return ensureDescribed(zcheck, checkname)
  }) as ZOT
  // if (! _.isEmpty(lintbag)) { throw BadValue({ ...lintbag }, validator) }
  if (! _.isEmpty(lintbag)) { throw throwable(`Validation issue`, 'invalid', { ...lintbag }) }
  return validator
}
export interface ValidatorT {
  (shaper: ZVShaper<string, Zodderbag<string>>): Zodderbag<string>
  Zods: ZodFoodT
  Checks: ZcheckersT
  Z: typeof Z
  CheckerTypers: typeof CheckerTypers
  StrChecks: typeof StrChecks
  OneofChecks: typeof OneofChecks
  NumChecks: typeof NumChecks
  ZodTypedObjChecks: typeof ZodTypedObjChecks
}
Validator.Checks        = Zcheckers
Validator.Zods          = ZodFood
Validator.Z             = Z
Validator.CheckerTypers = CheckerTypers
decorate(Validator, {
  StrChecks, OneofChecks, NumChecks, BoolChecks, ObjChecks, OtherChecks,
  ZodTypedObjChecks, // ZodtypedOneofChecks
})
//
export default Validator
