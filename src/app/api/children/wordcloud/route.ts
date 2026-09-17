import {NextResponse} from 'next/server';
import {getDb} from '@/lib/db';
import {children} from '@/db/schema';
import {runInference} from '@/lib/inference';
import {and,gte,lt} from 'drizzle-orm';
import {beijingDayRange,parseSessionParam} from '@/lib/school-session';
export const maxDuration=300;
export async function POST(req:Request){
 try{
 // 词云也按场次（docs/10 §3.7）：大屏是"今天这一场"的现场，词云混进历史就与地图/统计对不上了
 let body:unknown=null;try{body=await req.json()}catch{body=null}
 const dateRaw=(body as {date?:string}|null)?.date??new URL(req.url).searchParams.get('date');
 const session=parseSessionParam(dateRaw);
 const range=session.kind==='day'?beijingDayRange(session.date):null;
 const base=getDb().select({id:children.id,age:children.age,interests:children.interests,activities:children.activities,selfDescription:children.selfDescription,parentObservation:children.parentObservation,dreamCareer:children.dreamCareer}).from(children);
 const rows=range?await base.where(and(gte(children.createdAt,range.start),lt(children.createdAt,range.end))):await base;
 if(!rows.length)return NextResponse.json({error:session.kind==='all'?'数据库中还没有孩子信息，请先录入。':'这一场还没有孩子信息，先录入再生成词云。'},{status:400});
 const task=await runInference('anthropic/claude-haiku-4-5',{
 text:JSON.stringify(rows),
system_prompt:`你是儿童兴趣探索顾问。根据提供的所有学生信息生成活动特质词云。归纳并语义合并相似词，例如观察力强、善于观察、敏锐合为观察敏锐；有创意、想象力强可按具体语义归纳为想象力丰富。最终1至9个简短中文特质，每个词通常4到6字，不要重复近义词，不要为了凑数虚构特质。不作诊断、不作能力定论。根据学生原始自述、活动、兴趣、家长观察找证据。输出严格JSON：{"groups":[{"word":"观察敏锐","childIds":[1,2]}]}。childIds只能包含输入中真实存在且有该特质依据的学生ID，同一孩子同一特质只算一次，一个孩子可以对应多个特质。不要输出姓名、解释或markdown。`
 });
 const raw=(task.output as {response?:string}|null)?.response||'';
 const result=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
 if(!Array.isArray(result.groups)||result.groups.length<1||result.groups.length>9)throw Error('模型未返回有效的特质分组，请重试。');
 const ids=new Set(rows.map(r=>r.id));const words=new Set<string>();
 const groups=result.groups.map((g:{word:unknown;childIds:unknown})=>{
 if(typeof g.word!=='string'||!g.word.trim()||g.word.length>16||!Array.isArray(g.childIds)||!g.childIds.length||g.childIds.some(id=>!Number.isInteger(id)||!ids.has(id)))throw Error('模型返回的特质或人数依据无效，请重新生成。');
 const word=g.word.trim();if(words.has(word))throw Error('模型返回了重复特质，请重新生成。');words.add(word);
 return {word,count:new Set(g.childIds).size};
 }).sort((a:{count:number},b:{count:number})=>b.count-a.count);
 return NextResponse.json({groups,total:rows.length,generatedAt:new Date().toISOString()});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'词云生成失败，请稍后重试。'},{status:500})}
}
