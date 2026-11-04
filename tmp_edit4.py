p='src/interactions/buttons/settingsBtn.ts'
s=open(p,encoding='utf-8').read()
old="      'tickets:types', 'tickets:panel', 'tickets:max', 'tickets:welcomeMsg', 'verification:msg', 'verification:age', 'verification:log', 'verification:emoji', 'levels:msg',"
new="      'tickets:types', 'tickets:panel', 'tickets:max', 'tickets:welcomeMsg', 'verification:msg', 'verification:age', 'verification:log', 'verification:emoji', 'verification:quarantineage', 'levels:msg',"
assert old in s
s=s.replace(old,new,1)
# add modal block after verification:emoji block? Insert before // الإجراءات التي تفتح مودال
anchor="    // الإجراءات التي تفتح مودال → ترجع فوراً (showModal هو الرد)"
block="""    if (`${section}:${action}` === 'verification:quarantineage') {
      const v = settings.verification || {};
      return openModal(
        '⏳ عمر الحجر (بالأيام)',
        '0 = حجر جميع الأعضاء، >0 = حجر الحسابات الأصغر من X يوم',
        TextInputStyle.Short,
        3,
        String(v.autoQuarantineMaxAccountAgeDays ?? 7)
      );
    }

"""
assert anchor in s
s=s.replace(anchor, block+anchor,1)
open(p,'w',encoding='utf-8').write(s)
print("done")
