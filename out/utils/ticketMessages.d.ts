export declare const DEFAULT_TICKET_WELCOME_MESSAGE: string;
export interface TicketWelcomeVars {
    user: string;
    ticket: string;
    type: string;
    server: string;
}
export declare function renderTicketWelcome(template: string, vars: TicketWelcomeVars): string;
//# sourceMappingURL=ticketMessages.d.ts.map