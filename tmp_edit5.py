p='src/interactions/modals/settingsModal.ts'
s=open(p,encoding='utf-8').read()
old="""        await interaction.followUp({ content: '✅ تم حفظ رسالة التوثيق', ephemeral: true });
        return;
      }"""
new="""        await interaction.followUp({ content: '✅ تم حفظ رسالة التوثيق', ephemeral: true });
        return;
      }
      case 'verification:quarantineage': {
        const days = parseInt(value, 10);
        if (isNaN(days) || days < 0 || days > 365) {
          await interaction.followUp({ content: '❌ أدخل رقماً بين 0 و 365', ephemeral: true });
          return;
        }
        if (!settings.verification) settings.verification = {};
        settings.verification.autoQuarantineMaxAccountAgeDays = days;
        await settings.save();
        const vpQa = buildVerificationPanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: vpQa.embeds, components: vpQa.components as any });
        await interaction.followUp({
          content: `✅ تم تعيين عمر الحجر: ${days === 0 ? 'جميع الحسابات' : `${days} يوم`}`,
          ephemeral: true,
        });
        return;
      }"""
assert old in s
s=s.replace(old,new,1)
open(p,'w',encoding='utf-8').write(s)
print("done")
