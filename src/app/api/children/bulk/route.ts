import {NextResponse} from 'next/server';import {getDb} from '@/lib/db';import {children} from '@/db/schema';
export async function POST(req:Request){try{
 const rows=await req.json();if(!Array.isArray(rows)||!rows.length)return NextResponse.json({error:'没有可导入的数据'},{status:400});
 const labels:Record<string,string>={englishName:'英文名',age:'年龄',dreamSchool:'梦想学校',interests:'兴趣',activities:'喜欢的活动',selfDescription:'孩子自我描述',parentObservation:'家长观察'};
 const errors:string[]=[];
 rows.forEach((r,i)=>{const missing=Object.keys(labels).filter(k=>r?.[k]==null||!String(r[k]).trim());if(missing.length)errors.push(`第 ${i+1} 条数据缺少：${missing.map(k=>labels[k]).join('、')}`);else if(!Number.isInteger(Number(r.age))||Number(r.age)<1||Number(r.age)>100)errors.push(`第 ${i+1} 条数据的年龄应为1至100的整数`)});
 if(errors.length)return NextResponse.json({error:errors.join('；')+'。本次尚未导入，请修正后重试（梦想职业为选填）。'},{status:400});
 const valid=rows.map(r=>({englishName:String(r.englishName).trim(),age:Number(r.age),dreamSchool:String(r.dreamSchool).trim(),interests:String(r.interests).trim(),activities:String(r.activities).trim(),selfDescription:String(r.selfDescription).trim(),parentObservation:String(r.parentObservation).trim(),dreamCareer:String(r.dreamCareer??'').trim()}));
 const inserted=await getDb().insert(children).values(valid).returning({id:children.id});return NextResponse.json({count:inserted.length});
 }catch{return NextResponse.json({error:'导入失败，请检查文件后重试'},{status:500})}}
