import { BUSINESS } from './config.js';

const cleanText = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const validSlug = (value) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;

/** Solo fotografías revisadas y alojadas en la carpeta pública del negocio. */
export function normalizeBusinessPhotos(photos, slug) {
  if (!validSlug(slug) || !Array.isArray(photos)) return [];
  const prefix = `/businesses/${slug}/`;
  const seen = new Set();
  return photos.slice(0, 12).flatMap((photo) => {
    if (!photo || typeof photo !== 'object' || Array.isArray(photo)) return [];
    const src = typeof photo.src === 'string' ? photo.src : '';
    const filename = src.startsWith(prefix) ? src.slice(prefix.length) : '';
    const alt = cleanText(photo.alt, 180);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|avif)$/i.test(filename) || filename.includes('..') || !alt || seen.has(src)) return [];
    seen.add(src);
    return [{ src, alt, caption: cleanText(photo.caption, 180) }];
  });
}

// Este catálogo editorial no concede acceso al panel, membresía ni una suscripción.
// Añadir fotos reales revisadas en public/businesses/d-curiel/ y declararlas aquí.
export const BUSINESS_PROFILES = Object.freeze({
  'd-curiel': Object.freeze({
    slug: 'd-curiel',
    name: BUSINESS.name,
    initials: 'DC',
    headline: 'Tu mudanza empieza con un buen plan.',
    description: 'Comparte tu ruta, tus muebles y lo que necesitas. El equipo de Mudanzas D’Curiel revisa contigo los detalles para preparar una propuesta y acordar el servicio.',
    services: Object.freeze([
      { name: 'Mudanzas locales y foráneas', description: 'Cuéntanos el origen, el destino y la fecha que tienes en mente.' },
      { name: 'Empaque y preparación', description: 'Consulta opciones para cajas, muebles y artículos que requieren más cuidado.' },
      { name: 'Accesos y maniobras', description: 'Revisa con el equipo escaleras, elevadores, acarreos y servicios especiales.' },
    ]),
    photos: Object.freeze([]),
  }),
});

export function getBusinessProfile(slug = BUSINESS.slug) {
  if (!validSlug(slug) || !Object.hasOwn(BUSINESS_PROFILES, slug)) return null;
  const profile = BUSINESS_PROFILES[slug];
  return { ...profile, photos: normalizeBusinessPhotos(profile.photos, profile.slug) };
}
