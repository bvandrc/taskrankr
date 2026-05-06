import prettyBytes from 'pretty-bytes'

const BYTES_PER_KB = 1024
const BYTES_PER_MB = BYTES_PER_KB * 1024
const BYTES_PER_GB = BYTES_PER_MB * 1024

export const mbToBytes = (mb: number) => mb * BYTES_PER_MB

export const gbToBytes = (gb: number) => gb * BYTES_PER_GB

export const formatFileSize = (bytes: number) =>
  prettyBytes(bytes, { binary: true })
