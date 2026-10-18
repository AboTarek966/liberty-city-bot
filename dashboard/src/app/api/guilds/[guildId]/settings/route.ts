import { NextRequest, NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3000';

export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  const accessToken = request.cookies.get('access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify user has access to this guild
    const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!guildsRes.ok) {
      return NextResponse.json({ error: 'Failed to verify guild access' }, { status: 401 });
    }

    const guilds = await guildsRes.json();
    const guild = guilds.find((g: any) => g.id === params.guildId);
    
    if (!guild || !((guild.permissions & 0x8) === 0x8 || guild.owner)) {
      return NextResponse.json({ error: 'No access to this guild' }, { status: 403 });
    }

    // Fetch settings from bot API
    try {
      const res = await fetch(`${BOT_API_URL}/api/guilds/${params.guildId}/settings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {}

    // Return mock settings if bot API unavailable
    return NextResponse.json({
      prefix: 'lc!',
      language: 'ar',
      protection: {
        antiRaid: { enabled: true, threshold: 5, timeWindow: 60000, action: 'kick' },
        antiSpam: { enabled: true, maxMessages: 5, timeWindow: 5000, action: 'mute' },
        antiLink: { enabled: true, whitelist: [], action: 'delete' },
        antiInvite: { enabled: true, action: 'delete' },
        antiMention: { enabled: true, max: 5, action: 'mute' },
        antiCaps: { enabled: true, minLength: 10, percentage: 70, action: 'delete' },
        antiEmoji: { enabled: true, max: 10, action: 'delete' },
        antiNuke: { enabled: true, threshold: 3, timeWindow: 10000, action: 'kick', autoRestore: true },
        antiBot: { enabled: false, whitelist: [] },
        antiAdmin: { enabled: true, action: 'alert' },
        autoBackup: { enabled: true, interval: 6, keep: 5 },
        autoScan: { enabled: true, interval: 6 },
        scamFilter: { enabled: true },
        lockdown: false,
        antiAlt: { enabled: false, action: 'quarantine', maxAccountsPerIP: 3, checkCreationDays: 30 },
        inviteTracker: { enabled: true, trackJoins: true, trackLeaves: true },
        messageScanner: { enabled: false, scanLinks: true, scanAttachments: true },
        aiAutoMod: { enabled: false, sensitivity: 7 },
        aiTicketAssistant: { enabled: false, autoClaim: false, analyzeOnCreate: true },
        aiTranslator: { enabled: false, defaultTargetLang: 'ar' },
      },
      ai: {
        enabled: true,
        responseLanguage: 'ar',
        cooldown: 3,
        temperature: 0.7,
        maxTokens: 500,
      },
      tickets: {
        categoryId: null,
        logChannelId: null,
        supportRoleIds: [],
        maxPerUser: 3,
        autoCloseHours: 24,
        panels: [],
        autoMessageEnabled: false,
        lockUntilClaim: false,
        welcomeEnabled: false,
        surveyEnabled: true,
        adminRoleIds: [],
        lockUntilClaim: false,
        welcomeEnabled: false,
      },
    });
  } catch (error) {
    console.error('Failed to fetch guild settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  const accessToken = request.cookies.get('access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Update settings via bot API
    try {
      const res = await fetch(`${BOT_API_URL}/api/guilds/${params.guildId}/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {}

    return NextResponse.json({ success: true, message: 'Settings updated (mock)' });
  } catch (error) {
    console.error('Failed to update guild settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}