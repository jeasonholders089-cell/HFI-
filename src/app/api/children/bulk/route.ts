import {NextResponse} from 'next/server';import {getDb} from '@/lib/db';import {children} from '@/db/schema';
import {checkBulkRows} from '@/lib/bulk-import';
export async function POST(req:Request){try{
 const raw=await req.json();
 if(!Array.isArray(raw))return NextResponse.json({error:'没有可导入的数据'},{status:400});
 // 列名归位与校验在 lib/bulk-import.ts：**中文表头也认**（Excel 通道此前就是在这里断的）
 const checked=checkBulkRows(raw as Record<string,unknown>[]);
 if(!checked.ok)return NextResponse.json({error:checked.error},{status:400});
 const valid=checked.rows.map(r=>({englishName:r.englishName,age:Number(r.age),dreamSchool:r.dreamSchool,interests:r.interests,activities:r.activities,selfDescription:r.selfDescription,parentObservation:r.parentObservation,dreamCareer:r.dreamCareer}));
 const inserted=await getDb().insert(children).values(valid).returning({id:children.id});return NextResponse.json({count:inserted.length});
 }catch{return NextResponse.json({error:'导入失败，请检查文件后重试'},{status:500})}}
