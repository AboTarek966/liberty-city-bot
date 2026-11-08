"use strict";
// ============================================
// Omni Bot - Security Alert Policy
// ============================================
// يسمح للمالك بتشغيل الحماية في وضع صامت: العقوبات والاستعادة تعمل،
// لكن لا تُرسل تنبيهات أمنية إلى قنوات السجلات أو الرولات.
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityAlertsSilent = securityAlertsSilent;
function securityAlertsSilent(settings) {
    return settings?.protection?.silentSecurityAlerts === true;
}
//# sourceMappingURL=securityAlerts.js.map