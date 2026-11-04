p='src/handlers/ProtectionHandler.ts'
s=open(p,encoding='utf-8').read()
old="""    // Raid detected!
    this.raidTracker.delete(guildId);
    globalThreat.add(guildId, 12, 'raid detected');

    const action: ProtectionAction = {"""
new="""    // Raid detected!
    this.raidTracker.delete(guildId);
    globalThreat.add(guildId, 12, 'raid detected');

    void this.sendAIRaidSummary(member.guild, settings, {
      recentJoins,
      suspicionPoints,
      threshold,
      timeWindow,
      accountAgeDays: (Date.now() - (member.user.createdTimestamp || Date.now())) / 86400000,
    });

    const action: ProtectionAction = {"""
assert old in s
s=s.replace(old,new,1)

# add method before cleanup
anchor="  cleanup(): void {"
method='''  // --------------------------------------------
  // AI Raid Summary — تحليل هجوم بالذكاء الاصطناعي (اختياري)
  // --------------------------------------------
  private async sendAIRaidSummary(
    guild: any,
    settings: any,
    data: { recentJoins: number; suspicionPoints: number; threshold: number; timeWindow: number; accountAgeDays: number }
  ): Promise<void> {
    try {
      if (!settings?.ai?.enabled) return;
      const prompt = `أنت محلل أمن سيرفر Discord. تم رصد هجوم/raid.
بيانات:
- انضمامات حديثة: ${data.recentJoins}
- نقاط اشتباه: ${data.suspicionPoints}
- العتبة: ${data.threshold}
- نافذة الوقت (ms): ${data.timeWindow}
- عمر حساب آخر منضم (أيام): ${data.accountAgeDays.toFixed(1)}

أجب بـ 3-5 نقاط مختصرة بالعربية:
1) تقييم الخطورة (منخفض/متوسط/مرتفع/حرج)
2) السبب المحتمل
3) إجراء مقترح (kicks/bans/lockdown/monitor)
4) نصيحة وقائية (1 جملة)`;

      const response = await (this.client as any).aiHandler?.generateResponse(
        `protection:raid:${guild.id}`,
        guild.id,
        settings?.protection?.logChannel || settings?.logging?.channelId || '',
        prompt,
        [],
        false,
        false,
        { fromCommand: true }
      );
      const content = response?.content?.trim();
      if (!content) return;

      const logId = settings?.protection?.logChannel || settings?.logging?.channelId;
      const logChannel = logId ? guild.channels.cache.get(logId) : null;
      if (!logChannel || !logChannel.isTextBased()) return;

      const { EmbedBuilder } = await import('discord.js');
      const embed = new EmbedBuilder()
        .setTitle('🤖 AI Raid Analysis')
        .setDescription(content.slice(0, 4000))
        .setColor(0xe74c3c)
        .setFooter({ text: `${guild.name} • Protection` })
        .setTimestamp();
      await (logChannel as any).send({ embeds: [embed] }).catch(() => {});
    } catch (error: any) {
      logger.debug(`AI raid summary failed: ${error.message}`);
    }
  }

'''
assert anchor in s
s=s.replace(anchor, method+anchor,1)
open(p,'w',encoding='utf-8').write(s)
print("done")
