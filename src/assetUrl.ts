/** Public files follow the app's deployment directory, including subpath hosting. */
export function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
