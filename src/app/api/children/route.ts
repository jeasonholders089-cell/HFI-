import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { children } from "@/db/schema";
import { runInference } from "@/lib/inference";
import { CATEGORIES, CATEGORY_ENUM, CATEGORY_RULES } from "@/lib/growth-categories";
import { FIELD_LABEL, REQUIRED_FIELDS } from "@/lib/bulk-import";
import { parseModelJson } from "@/lib/model-json";
import { eq } from "drizzle-orm";
const APP="anthropic/claude-haiku-4-5";
const SYSTEM_PROMPT=`你是HFI家长成长营的美国教育探索顾问。基于孩子八项信息输出严格JSON，只包含三个学术方向及其依据：{"directions":[{"category":"${CATEGORIES.join('|')}中的一个","name":"方向中文名","nameEn":"英文领域名","reason":"引用问卷中的具体回答说明依据"}]}。必须恰好3个学术方向，每个方向category必须从${CATEGORY_ENUM}中选一个最适合的。判定规则：${CATEGORY_RULES}只输出这三个方向与依据，不要输出画像总结、特质或其他字段。梦想职业为空表示尚未提供，不得推断孩子已经有明确职业目标。建议是探索性意见，不是录取预测或能力定论。**reason 里如需引用问卷原话，一律用中文引号「」包起来，禁止在 JSON 字符串里出现英文双引号。**`;
function parse(raw:string){return parseModelJson<{directions?:unknown[]}>(raw);}
// 必填只有三项，定义在 lib/bulk-import.ts（与批量导入、页面文案同源，不许各写一份）
export async function POST(req:Request){try{const body=await req.json();const missing=REQUIRED_FIELDS.filter(k=>body[k]==null||!String(body[k]).trim());if(missing.length)return NextResponse.json({error:"请填写："+missing.map(k=>FIELD_LABEL[k]).join("、")+"（其余可以留空）"},{status:400});if(typeof body.submissionKey!=='string'||!/^[0-9a-f-]{36}$/i.test(body.submissionKey))return NextResponse.json({error:'提交标识无效，请刷新页面重试'},{status:400});
// 年龄选填：填了就必须是 1–100 的整数；没填存 null（不能存 0，0 会被下游当成"0 岁"）
const ageRaw=String(body.age??"").trim();
const age=ageRaw?Number(ageRaw):null;
if(age!==null&&(!Number.isInteger(age)||age<1||age>100))return NextResponse.json({error:'年龄请填 1 至 100 之间的整数，不填就留空'},{status:400});
const text=(v:unknown)=>String(v??"").trim();
const input={englishName:text(body.englishName),age,dreamSchool:text(body.dreamSchool),interests:text(body.interests),activities:text(body.activities),selfDescription:text(body.selfDescription),parentObservation:text(body.parentObservation),dreamCareer:text(body.dreamCareer)};
const [row]=await getDb().insert(children).values({...input,submissionKey:body.submissionKey}).onConflictDoNothing({target:children.submissionKey}).returning();
if(!row){const [existing]=await getDb().select().from(children).where(eq(children.submissionKey,body.submissionKey));return NextResponse.json({childId:existing?.id,duplicate:true,warning:'问卷已经保存，无需重复提交；画像状态请在活动全景查看。'});}
try{const task=await runInference(APP,{text:JSON.stringify(input),system_prompt:SYSTEM_PROMPT});const out=task.output as {response?:string}|null;const a=parse(out?.response||"");const [updated]=await getDb().update(children).set({aiDirections:JSON.stringify(a.directions||[])}).where(eq(children.id,row.id)).returning();return NextResponse.json(updated);}catch{return NextResponse.json({warning:"问卷已入库，但 AI 分析未完成。工作人员可在活动全景点击开始分析。",childId:row.id},{status:202});}}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"提交失败"},{status:500});}}
