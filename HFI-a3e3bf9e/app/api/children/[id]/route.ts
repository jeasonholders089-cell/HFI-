import {NextResponse} from 'next/server';
import {getDb} from '@/lib/db';
import {children} from '@/db/schema';
import {eq} from 'drizzle-orm';
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
 const origin=request.headers.get('origin');
 const host=request.headers.get('x-forwarded-host')||request.headers.get('host');
 if(!origin||(origin!==new URL(request.url).origin&&new URL(origin).host!==host))return NextResponse.json({error:'不允许跨站删除请求'},{status:403});
 const {id:raw}=await params;const id=Number(raw);
 if(!/^\d+$/.test(raw)||!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'孩子 ID 无效'},{status:400});
 const deleted=await getDb().delete(children).where(eq(children.id,id)).returning({id:children.id});
 if(!deleted.length)return NextResponse.json({error:'记录不存在或已经删除，请刷新列表'},{status:404});
 return NextResponse.json({deleted:deleted[0].id});
 }catch{return NextResponse.json({error:'删除失败，请稍后重试'},{status:500})}
}
