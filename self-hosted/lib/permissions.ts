import {Module,LicenceSummary,moduleEnabled} from '@/lib/modules';
export const permissionLabels={waterChecks:'Check water tanks and record daily water levels',securityView:'View security log and key history',securityRegister:'Register keys, visitors, incidents and handovers',securityReview:'Assess and close security incidents and handovers',securityManage:'Manage property and vehicle keys',vehicleView:'View vehicle dashboard and history',vehicleDispatch:'Register vehicle departures, returns and defects',vehicleReview:'Review and resolve vehicle defects',vehicleManage:'Manage vehicles and release vehicle availability',invoices:'View and print reservation invoices',overview:'View hotel overview',calendar:'View room calendar',guests:'View guest history',bookingPayments:'Collect reservation payments',bookingRefunds:'Refund reservation payments',bookingRates:'Change reservation nightly rates',accountingView:'View accounting and payment reports',passManage:'Manage swimming prices and pool information',passRefund:'Cancel and refund swimming vouchers',suppliers:'Manage suppliers',purchasing:'Manage purchase orders',shifts:'Manage shifts and cash reconciliation',bookingPolicies:'Manage booking and cancellation policies',guestRequests:'Manage guest booking requests',reminders:'Manage guest reminders',maintenance:'Manage maintenance tasks and accommodation blocks',audit:'View activity history',dashboard:'View multi-property performance',inventoryRequest:'Request inventory supplies',inventoryApprove:'Approve supply handovers and returns',inventoryManage:'Manage inventory items and stock receipts',dayPasses:'Sell swimming day passes',passCheck:'Check and redeem swimming vouchers',pos:'Use POS and take payments',posManage:'Manage POS products, refunds and daily closing',reservations:'Create and update reservations',payments:'Create accounting entries and settle bills',housekeeping:'Update housekeeping status',rooms:'Manage rooms and standard rates',property:'Edit hotel name and currency'};
export type Permission=keyof typeof permissionLabels;
export type Access={email:string;name:string;role:'owner'|'superadmin'|'admin'|'employee';permissions:Permission[];propertyIds:number[]|null;enabledModules?:Module[];licensedModules?:Module[];licenceSummary?:LicenceSummary};
export type Staff=Access&{active:boolean;password?:string;team?:string};
export const allPermissions=Object.keys(permissionLabels) as Permission[];
const permissionModule:Partial<Record<Permission,Module>>={waterChecks:'maintenance',securityView:'security',securityRegister:'security',securityReview:'security',securityManage:'security',vehicleView:'vehicles',vehicleDispatch:'vehicles',vehicleReview:'vehicles',vehicleManage:'vehicles',invoices:'invoices',overview:'overview',calendar:'calendar',guests:'guests',bookingPayments:'payments',bookingRefunds:'payments',bookingRates:'payments',accountingView:'accounting',passManage:'swimming',passRefund:'swimming',suppliers:'suppliers',purchasing:'purchasing',shifts:'shifts',bookingPolicies:'policies',guestRequests:'guestBooking',reminders:'reminders',reservations:'reservations',payments:'accounting',rooms:'rooms',property:'property',maintenance:'maintenance',audit:'audit',dashboard:'dashboard',housekeeping:'housekeeping',pos:'pos',posManage:'pos',dayPasses:'swimming',passCheck:'swimming',inventoryRequest:'inventory',inventoryApprove:'inventory',inventoryManage:'inventory'};
export const hasPermission=(a:Access|null,p:Permission)=>!!a&&(isSuperAdmin(a)||(a.role==='admin'&&['housekeeping','inventoryRequest'].includes(p))||a.permissions.includes(p));
export const can=(a:Access|null,p:Permission)=>hasPermission(a,p)&&(!permissionModule[p]||moduleEnabled(a,permissionModule[p]!));

export const canAccessProperty=(a:Access|null,id:number)=>!!a&&(a.role!=='employee'||!!a.propertyIds?.includes(id));

export const permissionGroups: {label:string;permissions:Permission[]}[]=[
 {label:'Front desk',permissions:['overview','reservations','calendar','guests','bookingPayments','bookingRefunds','bookingRates','invoices','guestRequests','reminders','bookingPolicies']},
 {label:'Security & keys',permissions:['securityView','securityRegister','securityReview','securityManage']},
 {label:'Vehicle security',permissions:['vehicleView','vehicleDispatch','vehicleReview','vehicleManage','securityView','securityRegister','securityReview','securityManage']},
 {label:'Housekeeping',permissions:['housekeeping']},
 {label:'Accounting',permissions:['accountingView','payments']},
 {label:'Swimming',permissions:['dayPasses','passCheck','passManage','passRefund']},
 {label:'Point of sale',permissions:['pos','posManage','shifts']},
 {label:'Inventory & purchasing',permissions:['inventoryRequest','inventoryApprove','inventoryManage','suppliers','purchasing']},
 {label:'Facilities',permissions:['waterChecks','maintenance']},
 {label:'Property & reports',permissions:['rooms','property','maintenance','audit','dashboard']},
];
export const staffPresets:Record<string,{label:string;permissions:Permission[]}>= {
 technical:{label:'Technical department',permissions:['maintenance','waterChecks','inventoryRequest']},
 water:{label:'Water-tank attendant',permissions:['waterChecks']},
 security:{label:'Security',permissions:['vehicleView','vehicleDispatch','securityView','securityRegister']},
 securitySupervisor:{label:'Security supervisor',permissions:['vehicleView','vehicleDispatch','vehicleReview','vehicleManage','securityView','securityRegister','securityReview','securityManage']},
 frontdesk:{label:'Front desk',permissions:['overview','reservations','calendar','guests','bookingPayments','invoices','guestRequests','reminders']},
 housekeeping:{label:'Housekeeping',permissions:['overview','housekeeping','inventoryRequest']},
 accounting:{label:'Accounting',permissions:['overview','accountingView','payments']},
 cashier:{label:'Cashier / POS',permissions:['overview','pos']},
 swimming:{label:'Swimming attendant',permissions:['overview','dayPasses','passCheck']},
 maintenance:{label:'Maintenance',permissions:['overview','maintenance','inventoryRequest']},
 custom:{label:'Custom access',permissions:[]},
};
export const canViewAccounting=(a:Access|null)=>can(a,'accountingView')||can(a,'payments');
export const isSuperAdmin=(a:Access|null|undefined)=>!!a&&(a.role==='owner'||a.role==='superadmin');

