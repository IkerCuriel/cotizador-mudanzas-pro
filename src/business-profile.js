import { buildBusinessWhatsAppUrl } from './config.js';
import { getBusinessProfile } from './business-profile-data.js';

const profile = getBusinessProfile();
if (profile) {
  document.querySelectorAll('[data-profile-name]').forEach((element) => { element.textContent = profile.name; });
  document.querySelectorAll('[data-business-whatsapp]').forEach((element) => { element.href = buildBusinessWhatsAppUrl(); });
  document.getElementById('profileHeadline').textContent = profile.headline;
  document.getElementById('profileDescription').textContent = profile.description;
  document.getElementById('profileInitials').textContent = profile.initials;
  const services = document.getElementById('profileServices');
  services.replaceChildren(...profile.services.map((service, index) => {
    const article = document.createElement('article');
    const number = document.createElement('span');
    number.className = 'profile-service-number'; number.setAttribute('aria-hidden', 'true'); number.textContent = `0${index + 1}`;
    const heading = document.createElement('h3'); heading.textContent = service.name;
    const text = document.createElement('p'); text.textContent = service.description;
    article.append(number, heading, text); return article;
  }));
  const gallery = document.getElementById('profileGallery');
  if (profile.photos.length) {
    document.getElementById('profileGalleryEmpty').hidden = true;
    document.getElementById('profileGalleryStatus').hidden = true;
    gallery.hidden = false;
    gallery.replaceChildren(...profile.photos.map((photo) => {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.src = photo.src; image.alt = photo.alt; image.loading = 'lazy'; image.decoding = 'async'; image.width = 800; image.height = 600;
      image.addEventListener('error', () => {
        const unavailable = document.createElement('p'); unavailable.className = 'profile-photo-unavailable'; unavailable.textContent = 'Fotografía no disponible por el momento.';
        image.replaceWith(unavailable);
      }, { once: true });
      figure.append(image);
      if (photo.caption) { const caption = document.createElement('figcaption'); caption.textContent = photo.caption; figure.append(caption); }
      return figure;
    }));
  }
}
