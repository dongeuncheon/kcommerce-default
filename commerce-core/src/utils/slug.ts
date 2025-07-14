/**
 * Generate URL-friendly slug from string
 */
export function generateSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove special characters except hyphens
    .replace(/[^\w\-가-힣]/g, '')
    // Replace multiple hyphens with single hyphen
    .replace(/\-\-+/g, '-')
    // Remove leading and trailing hyphens
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Validate if string is a valid slug
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9가-힣]+(?:-[a-z0-9가-힣]+)*$/.test(slug);
}

/**
 * Generate unique slug by appending number if needed
 */
export function generateUniqueSlug(
  baseSlug: string,
  existingSlugs: string[]
): string {
  let slug = baseSlug;
  let counter = 1;
  
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}