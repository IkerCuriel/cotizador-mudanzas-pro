// Catálogo descriptivo. El equipo de mudanzas determina medidas, peso y maniobras.
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
  { id: "seating", name: "Sofás", icon: "▱", roomIds: ["living", "sitting", "study"], variants: [
    { id: "sofa-two", name: "Sofá de 2 plazas" },
    { id: "sofa-three", name: "Sofá de 3 plazas" },
    { id: "sofa-sectional", name: "Sofá modular / en L" },
  ] },
  { id: "armchairs", name: "Sillones individuales", icon: "▰", roomIds: ["living", "sitting", "study", "bedroom"], variants: [
    { id: "armchair-single", name: "Sillón individual" },
    { id: "armchair-recliner", name: "Sillón reclinable" },
  ] },
  { id: "diningTable", name: "Mesas de comedor", icon: "▦", roomIds: ["dining", "kitchen", "terrace"], variants: [
    { id: "table-four", name: "Mesa para 4 personas" },
    { id: "table-six", name: "Mesa para 6 personas" },
    { id: "table-eight", name: "Mesa para 8 o más personas" },
  ] },
  { id: "chairs", name: "Sillas", icon: "⌑", roomIds: ["dining", "study", "kitchen", "terrace"], description: "De comedor, plegables, periqueras y otras. Suma todas aquí.", variants: [
    { id: "chair-dining", name: "Sillas" },
  ] },
  { id: "officeChairs", name: "Sillas de escritorio", icon: "⌑", roomIds: ["study", "bedroom"], description: "Cuenta por separado las sillas de escritorio u oficina.", variants: [
    { id: "chair-office", name: "Silla de escritorio" },
  ] },
  { id: "beds", name: "Camas con colchón", icon: "▭", roomIds: ["bedroom", "service"], variants: [
    { id: "bed-single", name: "Cama individual" },
    { id: "bed-double", name: "Cama matrimonial" },
    { id: "bed-queen", name: "Cama queen" },
    { id: "bed-king", name: "Cama king" },
  ] },
  { id: "wardrobe", name: "Roperos y clósets", icon: "▥", roomIds: ["bedroom", "dressing", "service"], variants: [
    { id: "wardrobe-small", name: "Ropero de 2 puertas" },
    { id: "wardrobe-large", name: "Ropero grande / clóset desmontable" },
  ] },
  { id: "dresser", name: "Cómodas y burós", icon: "▤", roomIds: ["bedroom", "dressing", "service"], variants: [
    { id: "dresser-standard", name: "Cómoda / cajonera" },
    { id: "nightstand", name: "Buró" },
  ] },
  { id: "refrigerator", name: "Refrigeradores", icon: "▯", roomIds: ["kitchen", "terrace"], variants: [
    { id: "refrigerator-mini", name: "Frigobar" },
    { id: "refrigerator-standard", name: "Refrigerador estándar" },
    { id: "refrigerator-duplex", name: "Refrigerador dúplex" },
    { id: "refrigerator-french-door", name: "Refrigerador de puerta francesa" },
  ] },
  { id: "laundry", name: "Lavadoras y secadoras", icon: "◉", roomIds: ["laundry", "service"], variants: [
    { id: "washer-standard", name: "Lavadora" },
    { id: "dryer-standard", name: "Secadora" },
    { id: "laundry-center", name: "Centro de lavado" },
  ] },
  { id: "tv", name: "Televisiones", icon: "▣", roomIds: ["living", "sitting", "bedroom", "study"], variants: [
    { id: "tv-small", name: "Pantalla de hasta 43 pulgadas" },
    { id: "tv-medium", name: "Pantalla de 44 a 65 pulgadas" },
    { id: "tv-large", name: "Pantalla de más de 65 pulgadas" },
  ] },
  { id: "desk", name: "Escritorios", icon: "⌨", roomIds: ["study", "bedroom"], variants: [
    { id: "desk-standard", name: "Escritorio sencillo" },
    { id: "desk-large", name: "Escritorio grande / en L" },
  ] },
  { id: "bookcase", name: "Libreros y estantes", icon: "▤", roomIds: ["study", "living", "storage", "dressing"], variants: [
    { id: "bookcase-small", name: "Librero bajo / estante pequeño" },
    { id: "bookcase-large", name: "Librero alto / estante grande" },
  ] },
  { id: "appliances", name: "Electrodomésticos", icon: "◇", roomIds: ["kitchen", "laundry", "service"], variants: [
    { id: "appliance-stove", name: "Estufa" },
    { id: "appliance-microwave", name: "Microondas" },
    { id: "appliance-oven", name: "Horno independiente" },
    { id: "appliance-dishwasher", name: "Lavavajillas" },
  ] },
  { id: "boxes", name: "Cajas ya empacadas", icon: "□", roomIds: ROOMS.map((room) => room.id), variants: [
    { id: "boxes-medium", name: "Caja mediana" },
    { id: "boxes-large", name: "Caja grande" },
    { id: "boxes-kitchen", name: "Caja de vajilla / cristalería" },
  ] },
  { id: "decor", name: "Decoración y terraza", icon: "◫", roomIds: ["living", "sitting", "bedroom", "terrace"], variants: [
    { id: "decor-frames", name: "Cuadros / espejos protegidos" },
    { id: "decor-coffee-table", name: "Mesa de centro" },
    { id: "outdoor-table", name: "Mesa de jardín" },
    { id: "outdoor-lounger", name: "Camastro de terraza" },
  ] },
  { id: "piano", name: "Pianos", icon: "♫", roomIds: ["living", "sitting", "study"], variants: [
    { id: "piano-upright", name: "Piano vertical", special: true },
    { id: "piano-grand", name: "Piano de cola", special: true },
  ] },
  { id: "bar", name: "Cantinas", icon: "▥", roomIds: ["living", "dining", "sitting", "terrace"], variants: [
    { id: "bar-standard", name: "Cantina / barra de bar", special: true },
  ] },
  { id: "safe", name: "Cajas fuertes", icon: "▣", roomIds: ["study", "bedroom", "storage"], variants: [
    { id: "safe-small", name: "Caja fuerte pequeña", special: true },
    { id: "safe-large", name: "Caja fuerte grande", special: true },
  ] },
  { id: "shed", name: "Bodegas armables", icon: "⌂", roomIds: ["storage", "terrace"], variants: [
    { id: "shed-modular", name: "Bodega armable / cobertizo", special: true },
  ] },
];

// Conservamos este ID al abrir fichas anteriores, sin ofrecer más variantes de sillas
// al cliente ni fusionar cantidades que podrían superar el límite de un contador.
const LEGACY_ITEMS = [{ id: "chair-folding", name: "Silla plegable", icon: "⌑", groupId: "legacyChairs", roomIds: ["dining", "study", "kitchen", "terrace"], special: false }];
export const ITEMS = [...FURNITURE.flatMap((group) => group.variants.map((variant) => ({
  ...variant, name: variant.name, icon: group.icon, groupId: group.id,
  roomIds: [...group.roomIds], special: variant.special === true,
}))), ...LEGACY_ITEMS];
