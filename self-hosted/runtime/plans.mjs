export const licencePlans = Object.freeze({
  small: Object.freeze({name: 'Small', minRooms: 1, maxRooms: 10, monthlyUsd: 49, yearlyUsd: 490}),
  standard: Object.freeze({name: 'Standard', minRooms: 11, maxRooms: 25, monthlyUsd: 89, yearlyUsd: 890}),
  hotel: Object.freeze({name: 'Hotel', minRooms: 26, maxRooms: 50, monthlyUsd: 149, yearlyUsd: 1490}),
});

export function getLicencePlan(plan) {
  if (!Object.hasOwn(licencePlans, plan)) throw Error('Choose a Small, Standard or Hotel licence plan');
  return licencePlans[plan];
}

export const licenceAddOns = Object.freeze({
  swimming: Object.freeze({name: 'Swimming Day Passes', monthlyUsd: 15, yearlyUsd: 150, available: false}),
  pos: Object.freeze({name: 'Point of Sale', monthlyUsd: 25, yearlyUsd: 250, available: false}),
  accounting: Object.freeze({name: 'Accounting', monthlyUsd: 20, yearlyUsd: 200, available: true}),
  operations: Object.freeze({name: 'Operations', monthlyUsd: 20, yearlyUsd: 200, available: false}),
});

export function validateAddOns(addOns) {
  if (!Array.isArray(addOns) || new Set(addOns).size !== addOns.length ||
      addOns.some(id => typeof id !== 'string' || !Object.hasOwn(licenceAddOns, id))) {
    throw Error('Choose each optional add-on once: swimming, pos, accounting or operations');
  }
  return addOns;
}

export function licencePricing(planId, addOns = []) {
  const plan = getLicencePlan(planId);
  validateAddOns(addOns);
  return {currency: 'USD',
    monthlyUsd: addOns.reduce((total, id) => total + licenceAddOns[id].monthlyUsd, plan.monthlyUsd),
    yearlyUsd: addOns.reduce((total, id) => total + licenceAddOns[id].yearlyUsd, plan.yearlyUsd)};
}

export function enabledAddOns(license) {
  if (!license.valid) return [];
  if (license.term === 'demo') return Object.keys(licenceAddOns);
  // Preserve Accounting for previously signed room-plan licences until renewal.
  return license.licenceVersion === 2 ? license.addOns : ['accounting'];
}

export function hasAddOn(license, id) {
  return Object.hasOwn(licenceAddOns, id) && enabledAddOns(license).includes(id);
}

export function assertRoomLimit(license, rooms) {
  if (!Array.isArray(rooms) || !Number.isSafeInteger(license.maxRooms) || license.maxRooms < 1) {
    throw Error('A licence with a valid room limit is required');
  }
  if (rooms.length > license.maxRooms) {
    throw Error(`Your ${getLicencePlan(license.plan).name} licence allows up to ${license.maxRooms} rooms per property. Contact Bitwise MSP to upgrade.`);
  }
}

export function assertLicenceCoverage(license, properties) {
  if (properties.length > license.maxProperties) throw Error('Licence does not cover the existing property count');
  for (const property of properties) assertRoomLimit(license, property.rooms);
}
