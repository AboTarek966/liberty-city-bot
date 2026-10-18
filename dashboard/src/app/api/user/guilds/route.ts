import { NextRequest, NextResponse } from 'next/server';

const DISCORD_API = 'https://discord.com/api/v10';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ guilds: [] }, { status: 401 });
  }

  try {
    const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json({ guilds: [] }, { status: 401 });
      }
      throw new Error('Failed to fetch guilds');
    }

    const guilds = await res.json();
    
    // Filter guilds where user has admin permissions or is owner
    const adminGuilds = guilds
      .filter((guild: any) => 
        (guild.permissions & 0x8) === 0x8 || guild.owner
      )
      .map((guild: any) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
        owner: guild.owner,
        permissions: guild.permissions,
      }));

    return NextResponse.json({ guilds: adminGuilds });
  } catch (error) {
    console.error('Failed to fetch guilds:', error);
    return NextResponse.json({ guilds: [] }, { status: 500 });
  }
}