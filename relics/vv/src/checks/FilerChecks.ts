//
import {
  str, arr, obj, oneof, bag, idk, num, trimmed, anybag, literal,
} from './BasicChecks.ts'
import      {
  ComprFextVals, FextVals, KnownFextVals, S3BUCKET,
  ABSGLOB, ABSPATH, ANYGLOB, ANYPATH, BAREGLOB, BARENAME, BASEGLOB, BASENAME, EXTGLOB, EXTNAME,
  GLOBSEG, PATHSEG, RELGLOB, RELPATH, PATHSEGS,
  ANYFEXT,
} from '../Consts.ts'

// == [Filepath Checks] ==
export const relpath        = trimmed.min(1).max(1000).regex(RELPATH.re,   RELPATH.msg)
export const anypath        = trimmed.min(1).max(1000).regex(ANYPATH.re,   ANYPATH.msg)
export const abspath        = trimmed.min(1).max(1000).regex(ABSPATH.re,   ABSPATH.msg)
export const barename       = trimmed.min(1).max(1000).regex(BARENAME.re, BARENAME.msg)
export const basename       = trimmed.min(1).max(1000).regex(BASENAME.re, BASENAME.msg)
export const extname        = trimmed.min(0).max(1000).regex(EXTNAME.re,   EXTNAME.msg)
export const pathseg        = trimmed.min(1).max(1000).regex(PATHSEG.re,   PATHSEG.msg)
export const pathsegs       = trimmed.min(1).max(1000).regex(PATHSEGS.re, PATHSEGS.msg)
export const pathseglist    = arr(trimmed.min(1).max(50).regex(PATHSEG.re,  PATHSEG.msg)).max(20)
//
export const relglob        = trimmed.min(1).max(1000).regex(RELGLOB.re,   RELGLOB.msg)
export const anyglob        = trimmed.min(1).max(1000).regex(ANYGLOB.re,   ANYGLOB.msg)
export const absglob        = trimmed.min(1).max(1000).regex(ABSGLOB.re,   ABSGLOB.msg)
export const bareglob       = trimmed.min(1).max(1000).regex(BAREGLOB.re, BAREGLOB.msg)
export const baseglob       = trimmed.min(1).max(1000).regex(BASEGLOB.re, BASEGLOB.msg)
export const globseg        = trimmed.min(1).max(1000).regex(GLOBSEG.re,   GLOBSEG.msg)
export const extglob        = trimmed.min(0).max(1000).regex(EXTGLOB.re,   EXTGLOB.msg)
// --

// == [AWS Bucket Checks] ==

//
// S3 Bucket: https://regex101.com/r/731pNJ/2 -- https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html
//
// 1. Disallow the xn-- .s3alias and --ol-s3 bans:
//    (?!^xn--.*)(?!^.*(\.s3alias|--ol-s3)$)
// 2. Disallow IPv4 address (four segments of 1-3 numbers, separated by dots)
//    (?!^([0-9]{1,3}\.){3}[0-9]{1,3}$)
// 4. Disallow consecutive dots
//    (?!.*\.\.+)
// 3. must be 3-63 characters, starting and ending with alphanum, and only dots, dashes or lower alphanum
//    (^[a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9]$)
//
export const s3Bucket              = str.min(3).max(63).regex(S3BUCKET.re, S3BUCKET.msg)
export const awsregion             = oneof(['us-east-1'])

// ***********************************************************************
//
// File format Ffmt Fext extension Checks
//
//
export const dirent         = anybag
export const stream         = idk
export const ino            = num
//
export const anyfext        = str.min(1).max(1000).regex(ANYFEXT.re, ANYFEXT.msg)
export const fext           = oneof(FextVals)
export const comprfext      = oneof(ComprFextVals)
export const knownfext      = oneof(KnownFextVals)
// --
