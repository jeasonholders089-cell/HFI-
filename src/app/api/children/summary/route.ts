import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { children } from '@/db/schema';
import { and, desc, gte, lt } from 'drizzle-orm';
import {CATEGORIES,categorized} from '@/lib/growth-categories';
import {buildDreamSchools} from '@/lib/dream-schools';
import { beijingDate, beijingDayRange, parseSessionParam, sessionDatesOf } from '@/lib/school-session';
export async function GET(req: Request){
 try{
 /**
  * 场次（docs/10 §3.7，一天一场）：不带参数 = **今天这一场**（大屏的默认行为），
  * `?date=YYYY-MM-DD` = 指定场次，`?date=all` = 全部场次（复盘用）。
  *
  * 日界按北京时间手算，**不用**数据库的 current_date —— 托管库跑 UTC，
  * 早上 8 点的活动在库里还是前一天，会把这一场算丢。
  */
 const session = parseSessionParam(new URL(req.url).searchParams.get('date'));
 const range = session.kind === 'day' ? beijingDayRange(session.date) : null;
 const rows = range
  ? await getDb().select().from(children)
      .where(and(gte(children.createdAt, range.start), lt(children.createdAt, range.end)))
      .orderBy(desc(children.createdAt))
  : await getDb().select().from(children).orderBy(desc(children.createdAt));
 // 有数据的场次列表（只取时间戳，量级是"天数"而不是"孩子数"）——给大屏的切换器用
 const allTimes = await getDb().select({createdAt: children.createdAt}).from(children);
 const availableDates = sessionDatesOf(allTimes.map(r => new Date(r.createdAt)));
 const directions:Record<string,number>=Object.fromEntries(CATEGORIES.map(c=>[c,0]));
 let classified=0;
 for(const r of rows){
  if(categorized(r.aiDirections)){classified++;const ds=JSON.parse(r.aiDirections!);for(const c of new Set<string>(ds.map((d:{category:string})=>d.category)))directions[c]++;}
 }
 // 梦想院校人次与坐标在服务端算完（坐标表 2468 行不进浏览器，docs/11 §1.1 / §3.4）：
 // 未命中的也返回（matched:false、坐标为 null），地图、名单、图下那行「另有 N 人次未收录坐标」三处同源。
 const dreamSchools=buildDreamSchools(rows);
 return NextResponse.json({
  total:rows.length,classified,directions,children:rows,dreamSchools,
  session:{
   date: session.kind === 'day' ? session.date : null,
   isToday: session.kind === 'day' && session.date === beijingDate(),
   all: session.kind === 'all',
   availableDates,
  },
 });
 }catch{ return NextResponse.json({error:'数据库暂时无法连接，请稍后刷新重试'},{status:503}); }
}
