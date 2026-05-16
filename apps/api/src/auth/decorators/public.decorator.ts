import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

// Marquer un endpoint comme public (pas d'auth requise).
// Usage : @Public()
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
