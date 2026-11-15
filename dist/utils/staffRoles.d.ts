import { Guild } from 'discord.js';
export interface StaffRoleDef {
    name: string;
    color: number;
    perms: bigint[];
    hoist: boolean;
    mentionable: boolean;
    tier: 'high' | 'middle' | 'junior' | 'separator';
}
export declare const STAFF_ROLES: readonly [{
    readonly name: "『👑』・𝐎𝐰𝐧𝐞𝐫";
    readonly color: 15844367;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "high";
}, {
    readonly name: "『💎』・𝐂𝐨-𝐎𝐰𝐧𝐞𝐫";
    readonly color: 15105570;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "high";
}, {
    readonly name: "『⚜️』・𝐅𝐨𝐮𝐧𝐝𝐞𝐫";
    readonly color: 10181046;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "high";
}, {
    readonly name: "『⚡』・𝐇𝐢𝐠𝐡 𝐌𝐚𝐧𝐚𝐠𝐞𝐦𝐞𝐧𝐭";
    readonly color: 15158332;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "high";
}, {
    readonly name: "『💼』・𝐄𝐱𝐞𝐜𝐮𝐭𝐢𝐯𝐞 𝐃𝐢𝐫𝐞𝐜𝐭𝐨𝐫";
    readonly color: 15277667;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "high";
}, {
    readonly name: "══════ 👑 𝐇𝐢𝐠𝐡 𝐒𝐭𝐚𝐟𝐟 👑 ══════";
    readonly color: 3092790;
    readonly perms: bigint[];
    readonly hoist: false;
    readonly mentionable: false;
    readonly tier: "separator";
}, {
    readonly name: "『🔥』・𝐇𝐞𝐚𝐝 𝐀𝐝𝐦𝐢𝐧";
    readonly color: 15158332;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "middle";
}, {
    readonly name: "『🔱』・𝐒𝐞𝐧𝐢𝐨𝐫 𝐀𝐝𝐦𝐢𝐧";
    readonly color: 15965202;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "middle";
}, {
    readonly name: "『🛡️』・𝐀𝐝𝐦𝐢𝐧";
    readonly color: 9807270;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "middle";
}, {
    readonly name: "『⚙️』・𝐒𝐮𝐩𝐞𝐫𝐯𝐢𝐬𝐨𝐫";
    readonly color: 3066993;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "middle";
}, {
    readonly name: "『⚔️』・𝐇𝐞𝐚𝐝 𝐌𝐨𝐝";
    readonly color: 3426654;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "middle";
}, {
    readonly name: "══════ 🛡️ 𝐌𝐢𝐝𝐝𝐥𝐞 𝐒𝐭𝐚𝐟𝐟 🛡️ ══════";
    readonly color: 3092790;
    readonly perms: bigint[];
    readonly hoist: false;
    readonly mentionable: false;
    readonly tier: "separator";
}, {
    readonly name: "『🔰』・𝐒𝐞𝐧𝐢𝐨𝐫 𝐌𝐨𝐝";
    readonly color: 1752220;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "junior";
}, {
    readonly name: "『🔨』・𝐌𝐨𝐝𝐞𝐫𝐚𝐭𝐨𝐫";
    readonly color: 2600544;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "junior";
}, {
    readonly name: "『🎧』・𝐒𝐮𝐩𝐩𝐨𝐫𝐭 𝐓𝐞𝐚𝐦";
    readonly color: 3447003;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "junior";
}, {
    readonly name: "『🌟』・𝐇𝐞𝐥𝐩𝐞𝐫";
    readonly color: 16243823;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "junior";
}, {
    readonly name: "『📝』・𝐓𝐫𝐢𝐚𝐥 𝐒𝐭𝐚𝐟𝐟";
    readonly color: 8359053;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "junior";
}, {
    readonly name: "══════ 🔰 𝐉𝐮𝐧𝐢𝐨𝐫 𝐒𝐭𝐚𝐟𝐟 🔰 ══════";
    readonly color: 3092790;
    readonly perms: bigint[];
    readonly hoist: false;
    readonly mentionable: false;
    readonly tier: "separator";
}];
export interface StaffRolesResult {
    /** true = كل الرتب موجودة بالفعل → لم يُغيّر شيء */
    skipped: boolean;
    created: string[];
    reused: string[];
    failed: string[];
    botHighestName: string;
    botHighestPosition: number;
    finalOrder: Array<{
        position: number;
        roleId: string;
        name: string;
    }>;
}
export declare function ensureStaffRoles(guild: Guild): Promise<StaffRolesResult>;
//# sourceMappingURL=staffRoles.d.ts.map