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
    const dimensions = Number.isInteger(photo.width) && Number.isInteger(photo.height) && photo.width > 0 && photo.height > 0 && photo.width <= 10000 && photo.height <= 10000
      ? { width: photo.width, height: photo.height } : {};
    return [{ src, alt, caption: cleanText(photo.caption, 180), ...dimensions }];
  });
}

// Este catálogo editorial no concede acceso al panel, membresía ni una suscripción.
// Fotografías originales proporcionadas para este perfil; no son imágenes de muestra.
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
    photos: Object.freeze([
      Object.freeze({ src: '/businesses/d-curiel/camion-d-curiel.jpeg', alt: 'Camión blanco de Mudanzas D’Curiel con la marca azul sobre la cabina', caption: 'Una de las unidades de D’Curiel.', width: 348, height: 348 }),
      Object.freeze({ src: '/businesses/d-curiel/equipo-en-mudanza.jpeg', alt: 'Equipo de D’Curiel trasladando un mueble protegido con mantas', caption: 'El equipo durante una maniobra de carga.', width: 259, height: 194 }),
    ]),
  }),
});

export function getBusinessProfile(slug = BUSINESS.slug) {
  if (!validSlug(slug) || !Object.hasOwn(BUSINESS_PROFILES, slug)) return null;
  const profile = BUSINESS_PROFILES[slug];
  return { ...profile, photos: normalizeBusinessPhotos(profile.photos, profile.slug) };
}
