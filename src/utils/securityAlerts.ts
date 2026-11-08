// ============================================
// Omni Bot - Security Alert Policy
// ============================================
// يسمح للمالك بتشغيل الحماية في وضع صامت: العقوبات والاستعادة تعمل،
// لكن لا تُرسل تنبيهات أمنية إلى قنوات السجلات أو الرولات.

export function securityAlertsSilent(settings: any): boolean {
  return settings?.protection?.silentSecurityAlerts === true;
}
