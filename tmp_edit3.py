p='src/utils/settingsPanel.ts'
s=open(p,encoding='utf-8').read()
old="""  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_btn:verification:age', 'عمر الحساب', ButtonStyle.Secondary, '🕰️'),
    btn('settings_btn:verification:log', 'قناة السجل', ButtonStyle.Secondary, '📋'),
    toggleBtn(
      'verification',
      'autoquarantine',
      'حجر تلقائي',
      '🚧',
      v.autoQuarantine !== false
    ),
    btn('settings_btn:verification:emoji', 'إيموجي الزر', ButtonStyle.Secondary, '😀'),
    btn('settings_cat:protection', 'رجوع', ButtonStyle.Secondary, '↩️')
  );"""
new="""  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_btn:verification:age', 'عمر الحساب', ButtonStyle.Secondary, '🕰️'),
    btn('settings_btn:verification:log', 'قناة السجل', ButtonStyle.Secondary, '📋'),
    toggleBtn(
      'verification',
      'autoquarantine',
      'حجر تلقائي',
      '🚧',
      v.autoQuarantine !== false
    ),
    btn('settings_btn:verification:quarantineage', 'عمر الحجر', ButtonStyle.Secondary, '⏳'),
    btn('settings_cat:protection', 'رجوع', ButtonStyle.Secondary, '↩️')
  );"""
assert old in s
s=s.replace(old,new,1)
# embed: add auto quarantine age line after auto quarantine line
old2 = "        `> 🚧 **حجر تلقائي عند الدخول:** ${v.autoQuarantine !== false ? '🟢 نعم' : '🔴 لا'}\\n` +\n"
new2 = old2 + "        `> ⏳ **حجر الحسابات الأصغر من:** ${v.autoQuarantineMaxAccountAgeDays ? `\\`${v.autoQuarantineMaxAccountAgeDays}\\` يوم` : 'جميع الحسابات'}\\n` +\n"
assert old2 in s
s=s.replace(old2,new2,1)
open(p,'w',encoding='utf-8').write(s)
print("done")
