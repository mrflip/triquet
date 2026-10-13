'use client'

import { Box, Button, Stack, Typography, type SxProps, type Theme } from '@mui/material'
import { useShown } from '../state/shown'

/** Where Google's "G" mark is served from: Google's own asset, kept beside the app, never fetched from Google */
export const GoogleMarkPath = '/google/g-logo.svg'

/**
 * What the button may say: Google's own words for it, as its branding guidelines allow no others.
 * *Sign in* where an account may already be there; *Continue* where a standalone account is
 * verified.
 */
export const GoogleButtonWords = { signIn: 'Sign in with Google', continue: 'Continue with Google' } as const

/** Which of Google's words the button says */
export type GoogleButtonWordsT = keyof typeof GoogleButtonWords

/**
 * The button's dress, as Google's sign-in branding guidelines set it: 40 pixels high, Roboto
 * Medium at 14 pixels, the "G" at 20 pixels, 12 pixels in from the edge and from the words; in the
 * light scheme white with a grey line, in the dark one near-black with a lighter line. The app's
 * pill shape is one of the two shapes Google allows.
 */
const GoogleButtonSx: SxProps<Theme> = [
  {
    height:        40,
    px:            '12px',
    gap:           '10px',
    fontFamily:    'var(--font-google-button), Roboto, Arial, sans-serif',
    fontWeight:    500,
    fontSize:      14,
    letterSpacing: '0.25px',
    whiteSpace:    'nowrap',
    bgcolor:       '#FFFFFF',
    color:         '#1F1F1F',
    border:        '1px solid #747775',
    '&:hover':     { bgcolor: '#F2F2F2', borderColor: '#747775' },
    '& .MuiButton-startIcon': { m: 0 },
  },
  (theme) => theme.applyStyles('dark', {
    bgcolor:   '#131314',
    color:     '#E3E3E3',
    border:    '1px solid #8E918F',
    '&:hover': { bgcolor: '#2A2A2C', borderColor: '#8E918F' },
  }),
]

export type GoogleSignInButtonProps = {
  /** Leave for Google to sign in (`useGoogleSignIn`'s `start`) */
  onClick:   () => void
  /** Whether it is shown but not to be pressed */
  disabled?: boolean
  /** Which of Google's words it says (`GoogleButtonWords`): *Sign in with Google* unless told */
  words?:    GoogleButtonWordsT
}

/**
 * Google's sign-in button, as its branding guidelines draw it: Google's "G" and its words, *Sign in
 * with Google* or *Continue with Google*. An MUI button with Google's published mark, not Google's
 * own script, which serves another way of signing in.
 *
 * @example <GoogleSignInButton onClick={() => { void start() }} />
 * @example <GoogleSignInButton words="continue" onClick={() => { void start() }} />
 */
export function GoogleSignInButton({ onClick, disabled = false, words = 'signIn' }: Readonly<GoogleSignInButtonProps>) {
  return (
    <Button
      variant="outlined" disabled={disabled} onClick={onClick} sx={GoogleButtonSx}
      startIcon={<Box component="img" src={GoogleMarkPath} alt="" width={20} height={20} sx={{ display: 'block' }} />}
    >
      {GoogleButtonWords[words]}
    </Button>
  )
}

export type GoogleSignInOfferProps = {
  /** Said above the button: why to sign up here; nothing when the button says enough */
  reason?: string
}

/**
 * A verified account, offered to a standalone one: a reason, when there is one to give, above Google's
 * button, *Continue with Google*, which leaves for Google and comes back to this page, keeping the
 * handle. Shown only where the page has said Google is offered (`ShowUser`, from
 * `useGoogleSignIn`): nothing on a deployment without Google's keys, nor before the browser's
 * session is ready, nor on a page that does not open the database.
 *
 * @example <GoogleSignInOffer reason={keepHandleNotice('mrflip')} />
 */
export function GoogleSignInOffer({ reason }: Readonly<GoogleSignInOfferProps>) {
  const google = useShown().user?.google
  if (google?.offered !== true) { return null }
  return (
    <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
      {reason !== undefined && <Typography variant="body2">{reason}</Typography>}
      <GoogleSignInButton words="continue" onClick={() => { void google.start() }} />
    </Stack>
  )
}
