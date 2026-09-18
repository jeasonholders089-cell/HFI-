import {categorized,CATEGORIES,CATEGORY_ENUM,CATEGORY_RULES} from '@/lib/growth-categories';
import {NextResponse} from 'next/server';
import {getDb} from '@/lib/db';
import {children} from '@/db/schema';
import {eq} from 'drizzle-orm';
import {runInference} from '@/lib/inference';
import {parseModelJson} from '@/lib/model-json';
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
 const task=await runInference('anthropic/claude-haiku-4-5',{text:JSON.stringify(existing),system_prompt:`对输入的3个教育探索方向按原顺序分类。仅返回JSON {"categories":["类别1","类别2","类别3"]}。每个类别必须是${CATEGORY_ENUM}之一。判定规则：${CATEGORY_RULES}根据方向的完整语义判断，不要只看方向名里的一个词。`});
 const raw=(task.output as {response?:string}|null)?.response||'';
 const cats=parseModelJson<{categories?:unknown[]}>(raw).categories;
 if(!Array.isArray(cats)||cats.length!==3||!cats.every((c)=>CATEGORIES.includes(c as typeof CATEGORIES[number])))throw Error('分类结果无效，请重试');
 const saved=await getDb().update(children).set({aiDirections:JSON.stringify(existing.map((d,i)=>({...d,category:cats[i]})))}).where(eq(children.id,id)).returning({id:children.id});
 if(!saved.length)return NextResponse.json({error:'记录已删除'},{status:409});
 return NextResponse.json({ok:true});
 }
 const {age,dreamSchool,interests,activities,selfDescription,parentObservation,dreamCareer}=child;
 // 空字段统一送空串（不是 null）：问卷里没填的项就是"没提供"，别让模型去猜
 const task=await runInference('anthropic/claude-haiku-4-5',{text:JSON.stringify({age:age??"",dreamSchool,interests,activities,selfDescription,parentObservation,dreamCareer}),system_prompt:`你是HFI家长成长营的美国教育探索顾问。根据问卷信息输出严格JSON，不要代码围栏，只包含三个学术方向及其依据：{"directions":[{"category":"${CATEGORIES.join('|')}中的一个","name":"方向中文名","nameEn":"英文领域名","reason":"引用问卷信息说明依据"}]}。每个方向category必须从${CATEGORY_ENUM}中选一个最适合的类别。判定规则：${CATEGORY_RULES}directions必须恰好3项，所有字段必须是非空字符串。只输出这三个方向与依据，不要输出画像总结、特质或其他字段。建议仅用于探索，不是能力定论或录取预测；不得编造孩子经历。**reason 里如需引用孩子的原话，一律用中文引号「」包起来，禁止在 JSON 字符串里出现英文双引号。**`});
 const raw=(task.output as {response?:string}|null)?.response||'';
 let a;try{a=parseModelJson<{directions?:Record<string,unknown>[]}>(raw)}catch{throw Error('模型返回格式异常，请重试')}
 const fields=['category','name','nameEn','reason'];
 if(!Array.isArray(a.directions)||a.directions.length!==3||!a.directions.every((d:Record<string,unknown>)=>d&&CATEGORIES.includes(d.category as typeof CATEGORIES[number])&&fields.every(k=>typeof d[k]==='string'&&String(d[k]).trim())))throw Error('模型返回的方向或依据不完整，请重试');
 const saved=await getDb().update(children).set({aiDirections:JSON.stringify(a.directions)}).where(eq(children.id,id)).returning({id:children.id});
 if(!saved.length)return NextResponse.json({error:'分析期间记录已被删除，结果未保存'},{status:409});
 return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'分析失败，请重试'},{status:500})}
}
