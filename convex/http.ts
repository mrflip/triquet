import { httpRouter } from 'convex/server'
import { auth } from './auth'

/** The deployment's HTTP routes: only Convex Auth's, which publish the key its tokens are checked by */
const http = httpRouter()
auth.addHttpRoutes(http) // eslint-disable-line unicorn/no-top-level-side-effects -- Convex Auth adds its routes to a router only this way

export default http
