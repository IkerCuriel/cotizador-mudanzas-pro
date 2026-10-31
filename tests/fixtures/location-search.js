import { setupBusinessLocationMap, setupLocationMaps } from '../../src/maps.js';

// Deliberately simulated provider for local browser QA. Never used by the production bundle.
const samplePlaces = [
  { placeId: 'TEST_public_landmark_A', label: 'Palacio de Bellas Artes, Ciudad de México', option: 'Resultado de prueba A · Palacio de Bellas Artes, CDMX' },
  { placeId: 'TEST_public_landmark_B', label: 'Zócalo de Puebla, Puebla', option: 'Resultado de prueba B · Zócalo de Puebla' },
];
const status = document.getElementById('fixtureStatus');
const wait = (field) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(10000, Number(document.getElementById(field).value) || 0))));
let sequence = 0;
const sessions = new WeakSet();
const predictions = new WeakMap();
const places = {
  available: true,
  async createSession() { const token = { testSession: ++sequence }; sessions.add(token); return token; },
  async fetchSuggestions(query, token) {
    if (!sessions.has(token)) throw new Error('Sesión de prueba caducada');
    await wait('fixtureFetchDelay');
    status.textContent = `Búsqueda simulada completada: «${query}». No se consultó Google Places.`;
    return samplePlaces.map((place) => {
      const prediction = { fixturePlace: place };
      predictions.set(prediction, token);
      return { label: place.option, prediction };
    });
  },
  async select(prediction) {
    const token = predictions.get(prediction);
    if (!token || !sessions.has(token)) throw new Error('Selección de prueba caducada');
    sessions.delete(token);
    status.textContent = 'Selección simulada en curso. Puedes pulsar Tab mientras termina.';
    await wait('fixtureSelectDelay');
    const { placeId, label } = prediction.fixturePlace;
    status.textContent = `Selección simulada completada: ${label}.`;
    return { placeId, label };
  },
  endSession(token) { sessions.delete(token); },
};
const controller = setupLocationMaps(document, { apiKey: '', places });
const businessController = setupBusinessLocationMap(document, { apiKey: '', places });
const form = document.getElementById('fixtureForm');
function render() {
  controller.update();
  businessController.update();
  document.getElementById('fixturePayload').textContent = JSON.stringify({
    origin: document.getElementById('origin').value,
    destination: document.getElementById('destination').value,
    ...controller.collect(),
    businessLocation: document.getElementById('businessLocation').value,
    ...businessController.collect(),
  }, null, 2);
}
form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (event) => event.preventDefault());
document.getElementById('fixtureReset').addEventListener('click', () => {
  form.reset(); controller.reset(); businessController.reset(); render();
  status.textContent = 'Prueba reiniciada. Ninguna solicitud fue enviada.';
});
document.getElementById('fixtureRestore').addEventListener('click', () => {
  document.getElementById('origin').value = samplePlaces[0].label;
  document.getElementById('destination').value = samplePlaces[1].label;
  controller.restore({
    originPlace: { placeId: samplePlaces[0].placeId, label: samplePlaces[0].label },
    destinationPlace: { placeId: samplePlaces[1].placeId, label: samplePlaces[1].label },
    additionalDestinations: [
      { address: 'Parque México, Ciudad de México', notes: 'Parada de prueba: entregar dos cajas.' },
      { address: 'Castillo de Chapultepec, Ciudad de México', notes: 'Parada de prueba: entregar una mesa.' },
    ],
  });
  render(); status.textContent = 'Ejemplo local restaurado. Los identificadores TEST son ficticios.';
});
render();
