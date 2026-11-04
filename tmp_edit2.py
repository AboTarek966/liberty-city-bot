p='src/interactions/modals/settingsModal.ts'
s=open(p,encoding='utf-8').read()
old="""        settings.verification.buttonLabel = vLabel.substring(0, 80) || 'توثيق';
        await settings.save();"""
new="""        settings.verification.buttonLabel = vLabel.substring(0, 80) || 'توثيق';
        try {
          const vEmoji = interaction.fields.getTextInputValue('emoji').trim();
          if (vEmoji) settings.verification.buttonEmoji = vEmoji.substring(0, 64);
        } catch {
          /* لا يوجد حقل إيموجي */
        }
        await settings.save();"""
assert old in s
s=s.replace(old,new,1)
open(p,'w',encoding='utf-8').write(s)
print("done")
