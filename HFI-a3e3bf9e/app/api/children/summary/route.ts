import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { children } from '@/db/schema';
import { desc } from 'drizzle-orm';
import {CATEGORIES,categorized} from '@/lib/growth-categories';
export async function GET(){
 try{
 const rows=await getDb().select().from(children).orderBy(desc(children.createdAt));
 const directions:Record<string,number>=Object.fromEntries(CATEGORIES.map(c=>[c,0]));
 const traits:Record<string,number>={};let classified=0;
 for(const r of rows){
  if(categorized(r.aiDirections)){classified++;const ds=JSON.parse(r.aiDirections!);for(const c of new Set<string>(ds.map((d:{category:string})=>d.category)))directions[c]++;}
  try{const ts=JSON.parse(r.aiTraits||'[]');if(Array.isArray(ts))for(const t of ts){if(typeof t==='string'&&t.trim()){const word=t.trim();traits[word]=(traits[word]||0)+1;}}}catch{}
 }
 return NextResponse.json({total:rows.length,classified,directions,traits,children:rows});
 }catch{ return NextResponse.json({error:'数据库暂时无法连接，请稍后刷新重试'},{status:503}); }
}
