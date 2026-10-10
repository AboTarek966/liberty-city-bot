// ============================================
// Type declarations for moment-duration-format
// ============================================

import 'moment';

declare module 'moment' {
  interface Duration {
    format(format: string, options?: any): string;
  }
}

declare module 'moment-duration-format';