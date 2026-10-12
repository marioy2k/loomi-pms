export const licencePlans = Object.freeze({
  small: Object.freeze({name: 'Small', minRooms: 1, maxRooms: 10, monthlyUsd: 49, yearlyUsd: 490}),
  standard: Object.freeze({name: 'Standard', minRooms: 11, maxRooms: 25, monthlyUsd: 89, yearlyUsd: 890}),
  hotel: Object.freeze({name: 'Hotel', minRooms: 26, maxRooms: 50, monthlyUsd: 149, yearlyUsd: 1490}),
});

export function getLicencePlan(plan) {
  if (!Object.hasOwn(licencePlans, plan)) throw Error('Choose a Small, Standard or Hotel licence plan');
  return licencePlans[plan];
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
