import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { children } from '@/db/schema';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) {
      // Reverse proxies may rewrite request.url; compare the forwarded public host too.
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
      if (!origin || new URL(origin).host !== host) return NextResponse.json({error:'不允许跨站删除请求'}, {status:403});
    }
    const body = await request.json();
    if (body.confirmation !== '清空孩子数据') return NextResponse.json({error:'确认文字不正确'}, {status:400});
    const deleted = await getDb().delete(children).returning({id:children.id});
    return NextResponse.json({deleted:deleted.length});
  } catch {
    return NextResponse.json({error:'清空失败，请稍后重试'}, {status:500});
  }
}
