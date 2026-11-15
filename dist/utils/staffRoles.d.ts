import { Guild } from 'discord.js';
export interface StaffRoleDef {
    name: string;
    color: number;
    perms: bigint[];
    hoist: boolean;
    mentionable: boolean;
    tier: 'high' | 'middle' | 'junior' | 'separator';
}
export declare const LEGACY_STAFF_ROLE_NAMES: readonly ["『👑』・𝐎𝐰𝐧𝐞𝐫", "『💎』・𝐂𝐨-𝐎𝐰𝐧𝐞𝐫", "『⚜️』・𝐅𝐨𝐮𝐧𝐝𝐞𝐫", "『⚡』・𝐇𝐢𝐠𝐡 𝐌𝐚𝐧𝐚𝐠𝐞𝐦𝐞𝐧𝐭", "『💼』・𝐄𝐱𝐞𝐜𝐮𝐭𝐢𝐯𝐞 𝐃𝐢𝐫𝐞𝐜𝐭𝐨𝐫", "══════ 👑 𝐇𝐢𝐠𝐡 𝐒𝐭𝐚𝐟𝐟 👑 ══════", "『🔥』・𝐇𝐞𝐚𝐝 𝐀𝐝𝐦𝐢𝐧", "『🔱』・𝐒𝐞𝐧𝐢𝐨𝐫 𝐀𝐝𝐦𝐢𝐧", "『🛡️』・𝐀𝐝𝐦𝐢𝐧", "『⚙️』・𝐒𝐮𝐩𝐞𝐫𝐯𝐢𝐬𝐨𝐫", "『⚔️』・𝐇𝐞𝐚𝐝 𝐌𝐨𝐝", "══════ 🛡️ 𝐌𝐢𝐝𝐝𝐥𝐞 𝐒𝐭𝐚𝐟𝐟 🛡️ ══════", "『🔰』・𝐒𝐞𝐧𝐢𝐨𝐫 𝐌𝐨𝐝", "『🔨』・𝐌𝐨𝐝𝐞𝐫𝐚𝐭𝐨𝐫", "『🎧』・𝐒𝐮𝐩𝐩𝐨𝐫𝐭 𝐓𝐞𝐚𝐦", "『🌟』・𝐇𝐞𝐥𝐩𝐞𝐫", "『📝』・𝐓𝐫𝐢𝐚𝐥 𝐒𝐭𝐚𝐟𝐟", "══════ 🔰 𝐉𝐮𝐧𝐢𝐨𝐫 𝐒𝐭𝐚𝐟𝐟 🔰 ══════"];
export declare const STAFF_ROLES: readonly [{
    readonly name: "『👑』・المالك";
    readonly color: 15844367;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "high";
}, {
    readonly name: "『💎』・نائب المالك";
    readonly color: 15105570;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "high";
}, {
    readonly name: "『⚜️』・المؤسس";
    readonly color: 10181046;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "high";
}, {
    readonly name: "『⚡』・الإدارة العليا";
    readonly color: 15158332;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "high";
}, {
    readonly name: "『💼』・المدير التنفيذي";
    readonly color: 15277667;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "high";
}, {
    readonly name: "══════ 👑 الإدارة العليا ══════";
    readonly color: 3092790;
    readonly perms: bigint[];
    readonly hoist: false;
    readonly mentionable: false;
    readonly tier: "separator";
}, {
    readonly name: "『🔥』・رئيس الإداريين";
    readonly color: 15158332;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "middle";
}, {
    readonly name: "『🔱』・إداري خبير";
    readonly color: 15965202;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "middle";
}, {
    readonly name: "『🛡️』・إداري عام";
    readonly color: 9807270;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "middle";
}, {
    readonly name: "『⚙️』・مشرف عام";
    readonly color: 3066993;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "middle";
}, {
    readonly name: "『⚔️』・رئيس المراقبين";
    readonly color: 3426654;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "middle";
}, {
    readonly name: "══════ 🛡️ الإدارة الوسطى ══════";
    readonly color: 3092790;
    readonly perms: bigint[];
    readonly hoist: false;
    readonly mentionable: false;
    readonly tier: "separator";
}, {
    readonly name: "『🔰』・مراقب أول";
    readonly color: 1752220;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "junior";
}, {
    readonly name: "『🔨』・مراقب";
    readonly color: 2600544;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "junior";
}, {
    readonly name: "『🎧』・فريق الدعم";
    readonly color: 3447003;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "junior";
}, {
    readonly name: "『🌟』・مساعد";
    readonly color: 16243823;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "junior";
}, {
    readonly name: "『📝』・إداري تحت التجربة";
    readonly color: 8359053;
    readonly perms: bigint[];
    readonly hoist: true;
    readonly mentionable: true;
    readonly tier: "junior";
}, {
    readonly name: "══════ 🔰 الإدارة الصغرى ══════";
    readonly color: 3092790;
    readonly perms: bigint[];
    readonly hoist: false;
    readonly mentionable: false;
    readonly tier: "separator";
}];
export interface StaffRolesResult {
    /** true = الرتب الـ18 موجودة والترتيب صحيح بالفعل */
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