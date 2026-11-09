export declare class DashboardCommandWorker {
    private client;
    private intervalRef;
    private running;
    constructor(client: any);
    start(): void;
    stop(): void;
    /** تنفيذ فوري لأمر (تستخدمه واجهة اللوحة المدمجة داخل نفس العملية) */
    executeNow(command: string, guildId: string, payload?: Record<string, any>): Promise<any>;
    private poll;
    private execute;
    private findTicket;
}
//# sourceMappingURL=DashboardCommandWorker.d.ts.map