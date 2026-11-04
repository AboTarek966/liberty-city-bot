p='src/handlers/AITicketAssistant.ts'
s=open(p,encoding='utf-8').read()
old="""- ban_user: حظر عضو
- timeout_user: كتم عضو
- custom: إجراء مخصص"""
new="""- ban_user: حظر عضو
- timeout_user: كتم عضو
- close_ticket: إغلاق التذكرة (فقط إذا تم حل المشكلة فعلاً)
- custom: إجراء مخصص"""
assert old in s
s=s.replace(old,new,1)

old2="""- أي إجراء يعطي رول/يعدل صلاحيات/يحظر = requiresAdminApproval: true
- الإجراءات المعلوماتية (فحص، استشارة) = requiresAdminApproval: false"""
new2="""- أي إجراء يعطي رول/يعدل صلاحيات/يحظر/يغلق = requiresAdminApproval: true
- الإجراءات المعلوماتية (فحص، استشارة) = requiresAdminApproval: false
- close_ticket: أضفه فقط إذا تم حل المشكلة وليست هناك حاجة لمتابعة. requiresAdminApproval: true."""
assert old2 in s
s=s.replace(old2,new2,1)
open(p,'w',encoding='utf-8').write(s)
print("done")
