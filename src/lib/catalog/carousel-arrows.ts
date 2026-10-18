/** The step arrows stay on both mobile and desktop once another model exists. */
export function showCatalogStepArrows(groupCount: number): boolean {
  return groupCount > 1;
}
