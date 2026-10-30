import test from "node:test";
import assert from "node:assert/strict";
import { calculatePricing, INVENTORY, PRESETS, PRICING, VEHICLES } from "../src/pricing.js";

const baseline = { inventory: { boxes: 1 }, distanceKm: 15, moveDate: "2026-11-02" };
const quote = (changes = {}) => calculatePricing({ ...baseline, ...changes });
const line = (result, key) => result.breakdown.find((entry) => entry.key === key)?.amount ?? 0;
const cents = (value) => Math.round(value * 100);
const sum = (entries) => entries.reduce((total, entry) => total + cents(entry.amount), 0);

test("inventory has illustrative weights and preserves all preset item IDs", () => {
  assert.equal(INVENTORY.length, 15);
  for (const item of INVENTORY) {
    assert.ok(item.volume > 0 && item.weightKg > 0);
    assert.equal(Object.hasOwn(item, "handling"), false);
  }
  for (const preset of Object.values(PRESETS)) {
    assert.ok(Object.keys(preset).every((id) => INVENTORY.some((item) => item.id === id)));
    assert.ok(quote({ inventory: preset }).total > 0);
  }
});

test("empty inventory is a zero quote even when optional services or overrides are populated", () => {
  for (const inventory of [undefined, {}, { boxes: 0 }, { unknown: 100 }]) {
    const result = quote({ inventory, volumeOverride: 99, weightOverride: 20000, extraLoaders: 5, packingType: "full", boxPackage: 30, storageDays: 15, hoistUpFloors: 3, services: ["fragile", "express"] });
    assert.equal(result.isEmpty, true);
    for (const key of ["low", "high", "total", "baseTotal", "variableTotal", "totalVolume", "totalWeight", "vehicleTrips"]) assert.equal(result[key], 0);
    assert.deepEqual(result.breakdown, []);
  }
});

test("one box has an auditable base without the old per-item handling charges", () => {
  const result = quote();
  assert.equal(result.totalItems, 1);
  assert.equal(result.totalVolume, 0.1);
  assert.equal(result.totalWeight, 12);
  assert.equal(result.vehicleId, "pickup");
  assert.equal(result.baseTotal, 400 + 38 + 6 + 10);
  assert.equal(result.variableTotal, 0);
  assert.equal(result.total, 454);
});

test("banderazos follow the selected vehicle and are not a universal minimum", () => {
  assert.deepEqual(VEHICLES.map((vehicle) => vehicle.baseFare), [400, 600, 800, 1300, 3500]);
  for (const vehicle of VEHICLES) {
    assert.equal(line(quote({ vehicleType: vehicle.id }), "vehicle"), vehicle.baseFare);
  }
});

test("15% volume discount applies only to cubic meters over 35", () => {
  const below = quote({ volumeOverride: 34.9, weightOverride: 100, vehicleType: "torton" });
  const boundary = quote({ volumeOverride: 35, weightOverride: 100, vehicleType: "torton" });
  const above = quote({ volumeOverride: 35.1, weightOverride: 100, vehicleType: "torton" });
  assert.equal(line(below, "volume"), 13262);
  assert.equal(line(boundary, "volume"), 13300);
  assert.equal(line(boundary, "volumeExcess"), 0);
  assert.equal(line(above, "volume"), 13300);
  assert.equal(line(above, "volumeExcess"), 32.3);
  assert.equal(cents(above.total) - cents(boundary.total), 3230);
  assert.ok(below.total < boundary.total && boundary.total < above.total);
});

test("discount leaves banderazo, weight, articles and services unchanged", () => {
  const result = quote({ volumeOverride: 40, weightOverride: 100, vehicleType: "torton", services: ["fragile"] });
  assert.equal(line(result, "volume"), 35 * 380);
  assert.equal(line(result, "volumeExcess"), 5 * 323);
  assert.equal(line(result, "vehicle"), 1300);
  assert.equal(line(result, "weight"), 50);
  assert.equal(line(result, "articles"), 10);
  assert.equal(line(result, "fragile"), 420);
});

test("distance includes the first 15 km and increases smoothly after the boundary", () => {
  assert.equal(line(quote({ distanceKm: 0 }), "distance"), 0);
  assert.equal(line(quote({ distanceKm: 15 }), "distance"), 0);
  assert.equal(line(quote({ distanceKm: 15.1 }), "distance"), 3.5);
  assert.equal(line(quote({ distanceKm: 16 }), "distance"), 35);
  assert.equal(line(quote({ distanceKm: 100 }), "distance"), 2975);
});

test("foráneo multiplier applies to chargeable kilometers only", () => {
  const local = quote({ distanceKm: 25, volumeOverride: 2, services: ["fragile"] });
  const outOfTown = quote({ distanceKm: 25, volumeOverride: 2, services: ["fragile"], routeType: "outOfTown" });
  assert.equal(line(local, "distance"), 350);
  assert.equal(line(outOfTown, "distance"), 472.5);
  assert.equal(cents(outOfTown.total) - cents(local.total), 12250);
  assert.equal(quote({ routeType: "outOfTown" }).total, quote().total);
  for (const routeType of ["local", "outOfTown"]) {
    let previous = 0;
    for (const distanceKm of [0, 14.9, 15, 15.1, 30, 30.1, 100, 100.1, 600]) {
      const current = quote({ routeType, distanceKm }).total;
      assert.ok(current >= previous);
      previous = current;
    }
  }
});

test("weight is charged separately and can determine the vehicle despite small volume", () => {
  assert.equal(line(quote({ weightOverride: 100 }), "weight"), 50);
  assert.equal(quote({ volumeOverride: 1, weightOverride: 750 }).vehicleId, "pickup");
  assert.equal(quote({ volumeOverride: 1, weightOverride: 750.1 }).vehicleId, "van");
  assert.equal(quote({ volumeOverride: 1, weightOverride: 1200.1 }).vehicleId, "truck");
  assert.equal(quote({ volumeOverride: 1, weightOverride: 3500.1 }).vehicleId, "torton");
  assert.equal(quote({ volumeOverride: 1, weightOverride: 14000.1 }).vehicleId, "trailer");
});

test("automatic selection respects both volume and payload at all capacity boundaries", () => {
  for (const [index, vehicle] of VEHICLES.entries()) {
    const exact = quote({ volumeOverride: vehicle.capacityM3, weightOverride: vehicle.capacityKg });
    assert.equal(exact.vehicleId, vehicle.id);
    assert.equal(exact.vehicleTrips, 1);
    assert.equal(exact.requiresReview, false);
    if (index < VEHICLES.length - 1) {
      assert.equal(quote({ volumeOverride: vehicle.capacityM3 + 0.01, weightOverride: 1 }).vehicleId, VEHICLES[index + 1].id);
    }
  }
});

test("overflow uses enough trips, charges vehicle and distance per trip and requires review", () => {
  const result = quote({ volumeOverride: 181, weightOverride: 500, distanceKm: 25 });
  assert.equal(result.vehicleId, "trailer");
  assert.equal(result.vehicleTrips, 3);
  assert.equal(line(result, "vehicle"), 10500);
  assert.equal(line(result, "distance"), 1050);
  assert.equal(result.requiresReview, true);
  assert.match(result.warnings.join(" "), /3 viajes/);
  const payloadOverflow = quote({ volumeOverride: 1, weightOverride: 48001 });
  assert.equal(payloadOverflow.vehicleTrips, 3);
});

test("an insufficient manual vehicle cannot silently undercharge transport", () => {
  const result = quote({ volumeOverride: 9, weightOverride: 1600, vehicleType: "pickup", distanceKm: 25, routeType: "outOfTown" });
  assert.equal(result.vehicleId, "pickup");
  assert.equal(result.vehicleTrips, 3);
  assert.equal(line(result, "vehicle"), 1200);
  assert.equal(line(result, "distance"), 1417.5);
  assert.equal(result.requiresReview, true);
  assert.ok(result.warnings.length > 0);
});

test("article count is independent of volume and estimated weight", () => {
  const one = quote({ volumeOverride: 2, weightOverride: 100 });
  const ten = quote({ inventory: { boxes: 10 }, volumeOverride: 2, weightOverride: 100 });
  assert.equal(cents(ten.total) - cents(one.total), 9000);
  assert.equal(line(ten, "articles"), 100);
});

test("carry charges apply beyond 30 meters at each endpoint, using volume and item count", () => {
  const settings = { inventory: { boxes: 10 }, volumeOverride: 5, weightOverride: 100 };
  assert.equal(line(quote({ ...settings, originCarryMeters: 30 }), "originCarry"), 0);
  const result = quote({ ...settings, originCarryMeters: 31, destinationCarryMeters: 40 });
  assert.equal(line(result, "originCarry"), 4);
  assert.equal(line(result, "destinationCarry"), 40);
  assert.equal(line(quote({ ...settings, volumeOverride: 10, originCarryMeters: 31 }), "originCarry"), 6.5);
  assert.equal(line(quote({ ...settings, inventory: { boxes: 20 }, originCarryMeters: 31 }), "originCarry"), 5.5);
});

test("each extra loader costs 300 plus 2 per cubic meter", () => {
  assert.equal(line(quote({ volumeOverride: 10, extraLoaders: 1 }), "loaders"), 320);
  assert.equal(line(quote({ volumeOverride: 20, extraLoaders: 2 }), "loaders"), 680);
});

test("property surcharges apply independently at origin and destination", () => {
  const result = quote({ volumeOverride: 10, originProperty: "apartment", destinationProperty: "office" });
  assert.equal(line(result, "originProperty"), 40);
  assert.equal(line(result, "destinationProperty"), 60);
  const houses = quote({ originProperty: "house", destinationProperty: "storage" });
  assert.equal(line(houses, "originProperty") + line(houses, "destinationProperty"), 0);
});

test("stairs scale by floor and volume; elevators charge per floor", () => {
  const result = quote({ volumeOverride: 10, originFloor: 3, originElevator: false, destinationFloor: 4, destinationElevator: true });
  assert.equal(line(result, "originFloors"), 360);
  assert.equal(line(result, "destinationFloors"), 200);
  assert.equal(line(quote({ volumeOverride: 20, originFloor: 3 }), "originFloors"), 720);
  assert.equal(line(quote({ volumeOverride: 20, originFloor: 3, originElevator: true }), "originFloors"), 150);
  assert.equal(line(quote({ originFloor: 0, originElevator: true }), "originFloors"), 0);
});

test("packing charges by volume, or one exclusive box package", () => {
  assert.equal(line(quote({ volumeOverride: 10, packingType: "full" }), "packing"), 950);
  assert.equal(line(quote({ volumeOverride: 10, packingType: "half" }), "packing"), 450);
  assert.equal(line(quote({ packingType: "none" }), "packing"), 0);
  for (const [count, cost] of [[10, 650], [20, 1200], [30, 1650]]) {
    assert.equal(line(quote({ boxPackage: count }), "boxes"), cost);
  }
  const conflicting = quote({ volumeOverride: 10, packingType: "full", boxPackage: 10 });
  assert.equal(line(conflicting, "packing"), 0);
  assert.equal(line(conflicting, "boxes"), 650);
  assert.equal(conflicting.requiresReview, true);
  assert.match(conflicting.warnings.join(" "), /excluyentes/);
});

test("assembly charges each started block of five furniture items", () => {
  for (const [count, cost] of [[0, 0], [1, 350], [5, 350], [6, 700], [10, 700], [11, 1050]]) {
    assert.equal(line(quote({ assemblyCount: count }), "assembly"), cost);
  }
});

test("facade lifts distinguish ascent and descent for each floor", () => {
  const result = quote({ hoistUpFloors: 3, hoistDownFloors: 2 });
  assert.equal(line(result, "hoistUpFloors"), 1800);
  assert.equal(line(result, "hoistDownFloors"), 900);
});

test("storage multiplies volume and days, defaulting to the full load", () => {
  const fullLoad = quote({ volumeOverride: 10, storageDays: 15 });
  assert.equal(line(fullLoad, "storage"), 1800);
  assert.equal(line(quote({ volumeOverride: 10, storageDays: 15, storageVolume: 4 }), "storage"), 720);
  assert.equal(line(quote({ storageDays: 0, storageVolume: 4 }), "storage"), 0);
});

test("priority and weekend surcharges are explicit and share the same prior subtotal", () => {
  const settings = { volumeOverride: 5, originFloor: 1, services: ["fragile"] };
  const initial = quote(settings);
  const result = quote({ ...settings, moveDate: "2026-11-01", services: ["fragile", "express"] });
  assert.equal(line(result, "express"), Math.round(initial.total * 12) / 100);
  assert.equal(line(result, "weekend"), Math.round(initial.total * 8) / 100);
  assert.equal(line(quote({ moveDate: "2026-10-31" }), "weekend"), 36.32);
  for (const invalidDate of ["2026-02-31", "not-a-date", "", null]) assert.equal(line(quote({ moveDate: invalidDate }), "weekend"), 0);
});

test("removed insurance and protection settings cannot change the price", () => {
  const initial = quote();
  for (const protectionLevel of ["standard", "plus", "premium"]) {
    const result = quote({ protectionLevel, services: ["insurance", "packing", "assembly", "longCarry"] });
    assert.equal(result.total, initial.total);
    assert.deepEqual(result.services, []);
    assert.ok(result.breakdown.every((entry) => !/seguro|cobertura|protección/i.test(entry.label)));
  }
});

test("rounded line items reconcile exactly in cents with base, variable, and total", () => {
  const result = quote({
    inventory: PRESETS.family, volumeOverride: 39.123, weightOverride: 1254.67, distanceKm: 57.45,
    routeType: "outOfTown", originProperty: "apartment", destinationProperty: "office",
    originFloor: 3, destinationFloor: 8, destinationElevator: true,
    originCarryMeters: 43.7, destinationCarryMeters: 62.1, extraLoaders: 3,
    packingType: "half", assemblyCount: 7, hoistUpFloors: 4, hoistDownFloors: 2,
    storageDays: 7, storageVolume: 12.345, services: ["fragile", "express"], moveDate: "2026-11-01",
  });
  assert.equal(sum(result.breakdown.filter((entry) => entry.group === "base")), cents(result.baseTotal));
  assert.equal(sum(result.breakdown.filter((entry) => entry.group === "variable")), cents(result.variableTotal));
  assert.equal(sum(result.breakdown), cents(result.total));
  assert.equal(cents(result.baseTotal) + cents(result.variableTotal), cents(result.total));
  assert.equal(new Set(result.breakdown.map((entry) => entry.key)).size, result.breakdown.length);
  assert.ok(result.breakdown.every((entry) => entry.detail && entry.label && entry.amount >= 0));
});

test("range starts at total rounded up to 50 and has at least 250 spread", () => {
  for (const settings of [{}, { inventory: PRESETS.family }, { volumeOverride: 200, weightOverride: 40000 }]) {
    const result = quote(settings);
    assert.equal(result.low, Math.ceil(result.total / 50) * 50);
    assert.equal(result.high, Math.ceil(Math.max(result.low + 250, result.total * 1.12) / 50) * 50);
    assert.ok(result.low >= result.total);
    assert.ok(result.high - result.low >= 250);
  }
});

test("blank overrides use inventory estimates and invalid overrides cannot erase load", () => {
  for (const blank of ["", "   ", null, undefined]) {
    const result = quote({ volumeOverride: blank, weightOverride: blank });
    assert.equal(result.totalVolume, 0.1);
    assert.equal(result.totalWeight, 12);
    assert.deepEqual(result.warnings, []);
  }
  for (const invalid of [0, -3, "abc", Infinity, NaN, 0.00001]) {
    const result = quote({ volumeOverride: invalid, weightOverride: invalid });
    assert.equal(result.totalVolume, 0.1);
    assert.equal(result.totalWeight, 12);
    assert.equal(result.requiresReview, true);
  }
});

test("invalid and negative inputs remain finite and cannot produce negative charges", () => {
  for (const invalid of [-50, "invalid", Infinity, NaN, {}, true]) {
    const result = quote({
      distanceKm: invalid, extraLoaders: invalid, assemblyCount: invalid,
      originFloor: invalid, destinationFloor: invalid, originCarryMeters: invalid,
      destinationCarryMeters: invalid, storageDays: invalid, hoistUpFloors: invalid,
      hoistDownFloors: invalid, vehicleType: "missing", services: null,
      originProperty: "toString", destinationProperty: "__proto__", packingType: "toString", boxPackage: "toString",
    });
    assert.equal(result.total, 454);
    assert.equal(result.variableTotal, 0);
    assert.ok([result.total, result.low, result.high].every(Number.isFinite));
  }
  assert.equal(calculatePricing(null).total, 0);
  assert.equal(quote({ inventory: { boxes: -4, sofa: NaN, washer: Infinity } }).total, 0);
  const decimalCount = quote({ inventory: { boxes: 2.9 } });
  assert.equal(decimalCount.totalItems, 2);
});

test("configuration identifies rates as provisional and contains no insurance setting", () => {
  assert.equal(PRICING.provisional, true);
  assert.equal(/insurance|protection/i.test(JSON.stringify(PRICING)), false);
});
