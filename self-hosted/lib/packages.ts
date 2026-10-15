import {allModules,type Module} from '@/lib/modules';
export const roomPackages={small:{name:'Small',minRooms:1,maxRooms:10,monthlyUsd:49,yearlyUsd:490},standard:{name:'Standard',minRooms:11,maxRooms:25,monthlyUsd:89,yearlyUsd:890},hotel:{name:'Hotel',minRooms:26,maxRooms:50,monthlyUsd:149,yearlyUsd:1490}} as const;
export type RoomPackage=keyof typeof roomPackages;
export const addOnPackages={swimming:{name:'Swimming Day Passes',monthlyUsd:15,yearlyUsd:150,modules:['swimming']},pos:{name:'Point of Sale',monthlyUsd:25,yearlyUsd:250,modules:['pos']},accounting:{name:'Accounting',monthlyUsd:20,yearlyUsd:200,modules:['accounting']},operations:{name:'Operations',monthlyUsd:20,yearlyUsd:200,modules:['vehicles','inventory','maintenance','suppliers','purchasing','shifts','policies','guestBooking','reminders','dashboard']}} as const;
export type AddOn=keyof typeof addOnPackages;
const extraModules=new Set<string>(Object.values(addOnPackages).flatMap(x=>[...x.modules]));
export const coreModules=allModules.filter(key=>!extraModules.has(key));
export function packageModules(addOns:AddOn[]):Module[]{return [...new Set([...coreModules,...addOns.flatMap(key=>[...addOnPackages[key].modules])])] as Module[];}
export function packagePrice(roomPlan:RoomPackage,addOns:AddOn[]){const p=roomPackages[roomPlan];return {currency:'USD',monthlyUsd:addOns.reduce<number>((n,k)=>n+addOnPackages[k].monthlyUsd,p.monthlyUsd),yearlyUsd:addOns.reduce<number>((n,k)=>n+addOnPackages[k].yearlyUsd,p.yearlyUsd)};}
export function validatePackage(x:any){if(!Object.hasOwn(roomPackages,x.roomPlan)||!Array.isArray(x.addOns)||new Set(x.addOns).size!==x.addOns.length||x.addOns.some((k:any)=>typeof k!=='string'||!Object.hasOwn(addOnPackages,k)))throw Error('Choose a room package and valid optional add-ons');}
export function assertRoomCoverage(config:any,rooms:any[]){if(config.packageVersion===2&&rooms.length>roomPackages[config.roomPlan as RoomPackage].maxRooms)throw Error(`Your ${roomPackages[config.roomPlan as RoomPackage].name} package allows up to ${roomPackages[config.roomPlan as RoomPackage].maxRooms} rooms per property. Upgrade your room package first.`);}

