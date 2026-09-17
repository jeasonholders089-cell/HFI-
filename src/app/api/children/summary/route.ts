import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { children } from '@/db/schema';
import { desc } from 'drizzle-orm';
import {CATEGORIES,categorized} from '@/lib/growth-categories';
import {buildDreamSchools} from '@/lib/dream-schools';
export async function GET(){
 try{
 const rows=await getDb().select().from(children).orderBy(desc(children.createdAt));
 const directions:Record<string,number>=Object.fromEntries(CATEGORIES.map(c=>[c,0]));
 let classified=0;
 for(const r of rows){
  if(categorized(r.aiDirections)){classified++;const ds=JSON.parse(r.aiDirections!);for(const c of new Set<string>(ds.map((d:{category:string})=>d.category)))directions[c]++;}
 }
 // 梦想院校人次与坐标在服务端算完（坐标表 2468 行不进浏览器，docs/11 §1.1 / §3.4）：
 // 未命中的也返回（matched:false、坐标为 null），地图、名单、图下那行「另有 N 人次未收录坐标」三处同源。
 const dreamSchools=buildDreamSchools(rows);
 return NextResponse.json({total:rows.length,classified,directions,children:rows,dreamSchools});
 }catch{ return NextResponse.json({error:'数据库暂时无法连接，请稍后刷新重试'},{status:503}); }
}
