import type { Snapshot } from '../engine/types'
import type { Text } from './types'

export const say = (v: Text | undefined, s: Snapshot) => (!v ? '' : typeof v === 'function' ? v(s) : v)
