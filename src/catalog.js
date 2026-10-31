// Tamaños y pesos orientativos para describir la carga. No determinan un precio.
export const ROOMS = [
  { id: "living", label: "Sala / living", icon: "▱" },
  { id: "dining", label: "Comedor", icon: "▦" },
  { id: "bedroom", label: "Recámara", icon: "▭" },
  { id: "storage", label: "Bodega", icon: "□" },
  { id: "sitting", label: "Sala de estar", icon: "▰" },
  { id: "study", label: "Estudio", icon: "⌨" },
  { id: "kitchen", label: "Cocina", icon: "◫" },
  { id: "laundry", label: "Cuarto de lavado", icon: "◉" },
  { id: "service", label: "Cuarto de servicio", icon: "◇" },
  { id: "dressing", label: "Vestidor", icon: "▥" },
  { id: "terrace", label: "Terraza", icon: "☀" },
];

export const PROPERTY_TYPES = {
  house: "Casa", apartment: "Departamento", storage: "Bodega", duplex: "Casa dúplex",
  residential: "Residencial", residentialPlus: "Residencial plus", office: "Oficina", other: "Otro",
};
export const ACCESS_TYPES = {
  stairs: "Escaleras", elevator: "Elevador", combined: "Combinados", ground: "Acceso directo en PB",
};
export const CARRY_RANGES = {
  "0-10": "Hasta 10 m", "11-20": "11 a 20 m", "21-30": "21 a 30 m", over30: "Más de 30 m", unknown: "Por confirmar",
};

export const FURNITURE = [
  { id: "seating", name: "Sofás y sillones", icon: "▱", roomIds: ["living", "sitting", "study"], variants: [
    { id: "sofa-two", name: "Sofá de 2 plazas", volume: 1.4, weightKg: 55 },
    { id: "sofa-three", name: "Sofá de 3 plazas", volume: 1.8, weightKg: 70 },
    { id: "sofa-sectional", name: "Sofá modular / en L", volume: 3.1, weightKg: 110 },
    { id: "armchair-single", name: "Sillón individual", volume: 0.75, weightKg: 30 },
    { id: "armchair-recliner", name: "Sillón reclinable", volume: 0.95, weightKg: 45 },
  ] },
  { id: "diningTable", name: "Mesas de comedor", icon: "▦", roomIds: ["dining", "kitchen", "terrace"], variants: [
    { id: "table-four", name: "Mesa para 4 personas", volume: 0.8, weightKg: 35 },
    { id: "table-six", name: "Mesa para 6 personas", volume: 1.2, weightKg: 55 },
    { id: "table-eight", name: "Mesa para 8 o más personas", volume: 1.7, weightKg: 80 },
  ] },
  { id: "chairs", name: "Sillas", icon: "⌑", roomIds: ["dining", "study", "kitchen", "terrace"], variants: [
    { id: "chair-dining", name: "Silla de comedor", volume: 0.25, weightKg: 8 },
    { id: "chair-office", name: "Silla de oficina", volume: 0.35, weightKg: 12 },
    { id: "chair-folding", name: "Silla plegable", volume: 0.08, weightKg: 4 },
  ] },
  { id: "beds", name: "Camas con colchón", icon: "▭", roomIds: ["bedroom", "service"], variants: [
    { id: "bed-single", name: "Cama individual", volume: 0.9, weightKg: 35 },
    { id: "bed-double", name: "Cama matrimonial", volume: 1.3, weightKg: 55 },
    { id: "bed-queen", name: "Cama queen", volume: 1.6, weightKg: 65 },
    { id: "bed-king", name: "Cama king", volume: 2, weightKg: 80 },
  ] },
  { id: "wardrobe", name: "Roperos y clósets", icon: "▥", roomIds: ["bedroom", "dressing", "service"], variants: [
    { id: "wardrobe-small", name: "Ropero de 2 puertas", volume: 1.1, weightKg: 60 },
    { id: "wardrobe-large", name: "Ropero grande / clóset desmontable", volume: 1.6, weightKg: 90 },
  ] },
  { id: "dresser", name: "Cómodas y burós", icon: "▤", roomIds: ["bedroom", "dressing", "service"], variants: [
    { id: "dresser-standard", name: "Cómoda / cajonera", volume: 0.65, weightKg: 35 },
    { id: "nightstand", name: "Buró", volume: 0.2, weightKg: 12 },
  ] },
  { id: "refrigerator", name: "Refrigeradores", icon: "▯", roomIds: ["kitchen", "terrace"], variants: [
    { id: "refrigerator-mini", name: "Frigobar", volume: 0.3, weightKg: 25 },
    { id: "refrigerator-standard", name: "Refrigerador estándar", volume: 1.1, weightKg: 65 },
    { id: "refrigerator-duplex", name: "Refrigerador dúplex", volume: 1.45, weightKg: 95 },
    { id: "refrigerator-french-door", name: "Refrigerador de puerta francesa", volume: 1.6, weightKg: 110 },
  ] },
  { id: "laundry", name: "Lavadoras y secadoras", icon: "◉", roomIds: ["laundry", "service"], variants: [
    { id: "washer-standard", name: "Lavadora", volume: 0.85, weightKg: 70 },
    { id: "dryer-standard", name: "Secadora", volume: 0.8, weightKg: 50 },
    { id: "laundry-center", name: "Centro de lavado", volume: 1.4, weightKg: 110 },
  ] },
  { id: "tv", name: "Televisiones", icon: "▣", roomIds: ["living", "sitting", "bedroom", "study"], variants: [
    { id: "tv-small", name: "Pantalla de hasta 43 pulgadas", volume: 0.15, weightKg: 10 },
    { id: "tv-medium", name: "Pantalla de 44 a 65 pulgadas", volume: 0.25, weightKg: 18 },
    { id: "tv-large", name: "Pantalla de más de 65 pulgadas", volume: 0.4, weightKg: 30 },
  ] },
  { id: "desk", name: "Escritorios", icon: "⌨", roomIds: ["study", "bedroom"], variants: [
    { id: "desk-standard", name: "Escritorio sencillo", volume: 0.85, weightKg: 40 },
    { id: "desk-large", name: "Escritorio grande / en L", volume: 1.4, weightKg: 70 },
  ] },
  { id: "bookcase", name: "Libreros y estantes", icon: "▤", roomIds: ["study", "living", "storage", "dressing"], variants: [
    { id: "bookcase-small", name: "Librero bajo / estante pequeño", volume: 0.5, weightKg: 25 },
    { id: "bookcase-large", name: "Librero alto / estante grande", volume: 1.05, weightKg: 45 },
  ] },
  { id: "appliances", name: "Electrodomésticos", icon: "◇", roomIds: ["kitchen", "laundry", "service"], variants: [
    { id: "appliance-stove", name: "Estufa", volume: 0.65, weightKg: 45 },
    { id: "appliance-microwave", name: "Microondas", volume: 0.18, weightKg: 12 },
    { id: "appliance-oven", name: "Horno independiente", volume: 0.3, weightKg: 25 },
    { id: "appliance-dishwasher", name: "Lavavajillas", volume: 0.5, weightKg: 40 },
  ] },
  { id: "boxes", name: "Cajas ya empacadas", icon: "□", roomIds: ROOMS.map((room) => room.id), variants: [
    { id: "boxes-medium", name: "Caja mediana", volume: 0.1, weightKg: 12 },
    { id: "boxes-large", name: "Caja grande", volume: 0.15, weightKg: 18 },
    { id: "boxes-kitchen", name: "Caja de vajilla / cristalería", volume: 0.12, weightKg: 15 },
  ] },
  { id: "decor", name: "Decoración y terraza", icon: "◫", roomIds: ["living", "sitting", "bedroom", "terrace"], variants: [
    { id: "decor-frames", name: "Cuadros / espejos protegidos", volume: 0.14, weightKg: 8 },
    { id: "decor-coffee-table", name: "Mesa de centro", volume: 0.4, weightKg: 20 },
    { id: "outdoor-table", name: "Mesa de jardín", volume: 0.7, weightKg: 25 },
    { id: "outdoor-lounger", name: "Camastro de terraza", volume: 0.6, weightKg: 18 },
  ] },
  { id: "piano", name: "Pianos", icon: "♫", roomIds: ["living", "sitting", "study"], variants: [
    { id: "piano-upright", name: "Piano vertical", volume: 1.4, weightKg: 230, special: true },
    { id: "piano-grand", name: "Piano de cola", volume: 3.2, weightKg: 400, special: true },
  ] },
  { id: "bar", name: "Cantinas", icon: "▥", roomIds: ["living", "dining", "sitting", "terrace"], variants: [
    { id: "bar-standard", name: "Cantina / barra de bar", volume: 1.8, weightKg: 100, special: true },
  ] },
  { id: "safe", name: "Cajas fuertes", icon: "▣", roomIds: ["study", "bedroom", "storage"], variants: [
    { id: "safe-small", name: "Caja fuerte pequeña", volume: 0.15, weightKg: 75, special: true },
    { id: "safe-large", name: "Caja fuerte grande", volume: 0.7, weightKg: 300, special: true },
  ] },
  { id: "shed", name: "Bodegas armables", icon: "⌂", roomIds: ["storage", "terrace"], variants: [
    { id: "shed-modular", name: "Bodega armable / cobertizo", volume: 2.5, weightKg: 120, special: true },
  ] },
];

export const ITEMS = FURNITURE.flatMap((group) => group.variants.map((variant) => ({
  ...variant, name: variant.name, icon: group.icon, groupId: group.id,
  roomIds: [...group.roomIds], special: variant.special === true,
})));
