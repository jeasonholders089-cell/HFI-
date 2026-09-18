import {NextResponse} from 'next/server';import {getDb} from '@/lib/db';import {children} from '@/db/schema';
import {checkBulkRows} from '@/lib/bulk-import';
export async function POST(req:Request){try{
 const raw=await req.json();
 if(!Array.isArray(raw))return NextResponse.json({error:'没有可导入的数据'},{status:400});
 // 列名归位与校验在 lib/bulk-import.ts：**中文表头也认**（Excel 通道此前就是在这里断的）
 const checked=checkBulkRows(raw as Record<string,unknown>[]);
 if(!checked.ok)return NextResponse.json({error:checked.error},{status:400});
 // 年龄选填：空字符串存 null（0 会被下游当成"0 岁"读出去）
 const valid=checked.rows.map(r=>({englishName:r.englishName,age:r.age?Number(r.age):null,dreamSchool:r.dreamSchool,interests:r.interests,activities:r.activities,selfDescription:r.selfDescription,parentObservation:r.parentObservation,dreamCareer:r.dreamCareer}));
 // 返回 id 列表：前端要拿它**就地**给这批孩子跑画像（不用再跑去大屏点一次）
 const inserted=await getDb().insert(children).values(valid).returning({id:children.id});
 return NextResponse.json({count:inserted.length,ids:inserted.map(r=>r.id)});
 }catch{return NextResponse.json({error:'导入失败，请检查文件后重试'},{status:500})}}
