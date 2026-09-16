import {categorized,CATEGORIES} from '@/lib/growth-categories';
import {NextResponse} from 'next/server';
import {getDb} from '@/lib/db';
import {children} from '@/db/schema';
import {eq} from 'drizzle-orm';
import {runInference} from '@/lib/inference';
export const maxDuration=300;
export async function POST(req:Request){
 try{
 const {id}=await req.json();if(!Number.isInteger(id)||id<1)return NextResponse.json({error:'孩子 ID 无效'},{status:400});
 const [child]=await getDb().select().from(children).where(eq(children.id,id));
 if(!child)return NextResponse.json({error:'孩子记录已删除或不存在'},{status:404});
 if(categorized(child.aiDirections))return NextResponse.json({ok:true,cached:true});
 let existing: Record<string,unknown>[]=[];
 try { const parsed=JSON.parse(child.aiDirections||'[]'); if(Array.isArray(parsed)&&parsed.length===3)existing=parsed; } catch {}
 if(existing.length===3){
 const task=await runInference('anthropic/claude-haiku-4-5',{text:JSON.stringify(existing),system_prompt:'对输入的3个教育探索方向按原顺序分类。仅返回JSON {"categories":["类别1","类别2","类别3"]}。每个类别必须是人文科学、社会科学、自然科学、艺术之一。工程计算机归自然科学，商科归社会科学，设计归艺术。根据方向的完整语义判断。'});
 const raw=(task.output as {response?:string}|null)?.response||'';
 const result=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
 if(!Array.isArray(result.categories)||result.categories.length!==3||!result.categories.every((c:typeof CATEGORIES[number])=>CATEGORIES.includes(c)))throw Error('分类结果无效，请重试');
 const saved=await getDb().update(children).set({aiDirections:JSON.stringify(existing.map((d,i)=>({...d,category:result.categories[i]})))}).where(eq(children.id,id)).returning({id:children.id});
 if(!saved.length)return NextResponse.json({error:'记录已删除'},{status:409});
 return NextResponse.json({ok:true});
 }
 const {englishName,age,dreamSchool,interests,activities,selfDescription,parentObservation,dreamCareer}=child;
 const task=await runInference('anthropic/claude-haiku-4-5',{text:JSON.stringify({englishName,age,dreamSchool,interests,activities,selfDescription,parentObservation,dreamCareer}),system_prompt:`你是HFI家长成长营的美国教育探索顾问。根据八项问卷信息输出严格JSON，不要代码围栏：{"summary":"一句话画像","directions":[{"category":"人文科学|社会科学|自然科学|艺术中的一个","name":"方向中文名","nameEn":"英文领域名","reason":"引用问卷信息说明依据","nearTerm":"适龄的未来6-12个月活动","usPath":"美国体系课程、大学专业或作品集路径"}],"traits":["特质"]}。每个方向category必须从人文科学、社会科学、自然科学、艺术中选一个最适合的类别。工程、计算机归自然科学，商科归社会科学，设计归艺术。directions必须恰好3项，所有字段必须是非空字符串。traits给出3到6个特质。建议仅用于探索，不是能力定论或录取预测；不得编造孩子经历。`});
 const raw=(task.output as {response?:string}|null)?.response||'';
 let a;try{a=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1))}catch{throw Error('模型返回格式异常，请重试')}
 const fields=['category','name','nameEn','reason','nearTerm','usPath'];
 if(typeof a.summary!=='string'||!a.summary.trim()||!Array.isArray(a.directions)||a.directions.length!==3||!a.directions.every((d:Record<string,unknown>)=>d&&CATEGORIES.includes(d.category as typeof CATEGORIES[number])&&fields.every(k=>typeof d[k]==='string'&&String(d[k]).trim()))||!Array.isArray(a.traits)||!a.traits.length||!a.traits.every((t:unknown)=>typeof t==='string'&&t.trim()))throw Error('模型画像字段不完整，请重试');
 const saved=await getDb().update(children).set({aiSummary:a.summary,aiDirections:JSON.stringify(a.directions),aiTraits:JSON.stringify(a.traits)}).where(eq(children.id,id)).returning({id:children.id});
 if(!saved.length)return NextResponse.json({error:'分析期间记录已被删除，结果未保存'},{status:409});
 return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'分析失败，请重试'},{status:500})}
}
