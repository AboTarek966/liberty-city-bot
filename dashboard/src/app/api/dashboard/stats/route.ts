import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;
  const guildId = request.nextUrl.searchParams.get('guild_id');
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Mock stats - in production, fetch from bot API
  const stats = {
    'السيرفرات': 5,
    'الرسائل المحمية': 12543,
    'التذاكر المفتوحة': 3,
    'المستخدمين النشطين': 1247,
  };

  // If guild_id provided, fetch specific guild stats
  if (guildId) {
    // Fetch from bot API
    try {
      // const res = await fetch(`${process.env.BOT_API_URL}/api/guilds/${guildId}/stats`, {
      //   headers: { Authorization: `Bearer ${accessToken}` },
      // });
      // if (res.ok) return NextResponse.json(await res.json());
    } catch {}
  }

  return NextResponse.json(stats);
}