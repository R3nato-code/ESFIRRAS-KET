/* ==================================================================
   Reexporta o hook de autenticação com um caminho curto e explícito.
   ================================================================== */

import { useAdminAuth as useAdminAuthInternal } from './AdminAuthProvider'
import type { AdminAuthContextValue } from './AdminAuthProvider'

export { useAdminAuthInternal as useAdminAuth }
export type { AdminAuthContextValue }
