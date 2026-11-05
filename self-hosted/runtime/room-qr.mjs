import QRCode from 'qrcode';
export function roomReportUrl(origin,id,room){const url=new URL('/report-room',origin);url.searchParams.set('propertyId',String(id));url.searchParams.set('room',room);return url.href;}
export async function roomQR(origin,id,room){return QRCode.toString(roomReportUrl(origin,id,room),{type:'svg',width:240,margin:3,errorCorrectionLevel:'M'});}
