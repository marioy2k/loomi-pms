'use client';
import {useLogoContrast} from '@/app/use-logo-contrast';
export default function LoomiLogo(){const {ref,filter}=useLogoContrast();return <img ref={ref} src="/loomi-logo-transparent.png" width="1536" height="1024" alt="Loomi lampshade logo" style={{filter,width:90,height:'auto',borderRadius:8}}/>}
