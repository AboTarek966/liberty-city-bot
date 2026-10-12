import { Client, Interaction, ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction, UserSelectMenuInteraction, RoleSelectMenuInteraction, ChannelSelectMenuInteraction } from 'discord.js';
export interface ButtonHandler {
    id: string;
    execute: (interaction: ButtonInteraction) => Promise<void>;
}
export interface ModalHandler {
    id: string;
    execute: (interaction: ModalSubmitInteraction) => Promise<void>;
}
export interface SelectMenuHandler {
    id: string;
    execute: (interaction: StringSelectMenuInteraction | UserSelectMenuInteraction | RoleSelectMenuInteraction | ChannelSelectMenuInteraction) => Promise<void>;
}
export declare class InteractionHandler {
    private client;
    private buttons;
    private modals;
    private selectMenus;
    constructor(client: Client);
    loadInteractions(): Promise<void>;
    handleInteraction(interaction: Interaction): Promise<void>;
    private handleButton;
    private handleModal;
    private handleSelectMenu;
    private handleAutocomplete;
    registerButton(handler: ButtonHandler): void;
    registerModal(handler: ModalHandler): void;
    registerSelectMenu(handler: SelectMenuHandler): void;
    getButtons(): Map<string, ButtonHandler>;
    getModals(): Map<string, ModalHandler>;
    getSelectMenus(): Map<string, SelectMenuHandler>;
}
export default InteractionHandler;
//# sourceMappingURL=InteractionHandler.d.ts.map