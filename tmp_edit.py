import sys
p='src/interactions/buttons/settingsBtn.ts'
s=open(p,encoding='utf-8').read()
old="""      const labelInput = new TextInputBuilder()
        .setCustomId('label')
        .setLabel('نص الزر')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(80)
        .setRequired(true)
        .setValue((v.buttonLabel || 'توثيق').substring(0, 80));

      const modal = new ModalBuilder()
        .setCustomId('settings_modal:verification:msg')
        .setTitle('رسالة التوثيق')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(labelInput)
        );"""
new="""      const labelInput = new TextInputBuilder()
        .setCustomId('label')
        .setLabel('نص الزر')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(80)
        .setRequired(true)
        .setValue((v.buttonLabel || 'توثيق').substring(0, 80));
      const emojiInput = new TextInputBuilder()
        .setCustomId('emoji')
        .setLabel('إيموجي الزر (اختياري)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(64)
        .setRequired(false)
        .setValue((v.buttonEmoji || '✅').substring(0, 64));

      const modal = new ModalBuilder()
        .setCustomId('settings_modal:verification:msg')
        .setTitle('رسالة التوثيق')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(labelInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput)
        );"""
assert old in s, "old not found"
s=s.replace(old,new,1)
open(p,'w',encoding='utf-8').write(s)
print("done")
