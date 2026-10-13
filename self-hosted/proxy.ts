import {NextRequest,NextResponse} from 'next/server';
export function proxy(req:NextRequest){if(!['GET','HEAD','OPTIONS'].includes(req.method)){if(req.headers.get('origin')!==process.env.APP_URL)return NextResponse.json({error:'Invalid request origin'},{status:403});}return NextResponse.next()}
export const config={matcher:'/api/:path*'};
