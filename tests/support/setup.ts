import { installErrorMap } from '../../src/lib/vv/reporting'

// Zod consults its global error map when it builds a message, so the map has to be in place
// before anything parses. A setup file runs before each test module is even imported, which is
// the only arrangement that cannot be got wrong by accident. An app does the same at startup.
installErrorMap()
