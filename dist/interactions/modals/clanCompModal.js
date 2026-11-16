"use strict";
// ============================================
// Omni Bot - ⚔️ نموذج بدء مسابقة العشائر
//    customId: clancomp:startmodal
//    يقرأ أسماء العشائر + عدد الأيام + اسم المسابقة ويُنشئ ClanBattle.
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const clanPerms_1 = require("../../utils/clanPerms");
const models_1 = require("../../models");
const helpers_1 = require("../../utils/helpers");
const logger = (0, helpers_1.createLogger)('ClanCompModal');
const DEFAULT_COLOR = 0x3498db;
const handler = {
    id: 'clancomp',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        const guild = interaction.guild;
        const userId = interaction.user.id;
        const allowed = await (0, clanPerms_1.canManageClans)(guild, userId, interaction.member, interaction.client).catch(() => false);
        if (!allowed) {
            await interaction.reply({ content: (0, clanPerms_1.clanAccessDeniedMessage)(), ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: false });
        const clansStr = (interaction.fields.getTextInputValue('clans') || '').trim();
        const daysRaw = (interaction.fields.getTextInputValue('days') || '').trim();
        const nameInput = (interaction.fields.getTextInputValue('name') || '').trim();
        const days = parseInt(daysRaw, 10);
        if (Number.isNaN(days) || days < 1 || days > 30) {
            await interaction.editReply({ content: '❌ عدد الأيام غير صالح — اكتب رقم بين 1 و 30' });
            return;
        }
        const rawNames = clansStr.split(/[,،]\s*/).map((s) => s.trim()).filter(Boolean);
        if (rawNames.length < 2) {
            await interaction.editReply({ content: '❌ اكتب عشيرتين على الأقل مفصولة بفاصلة' });
            return;
        }
        const allClans = await models_1.Clan.find({ guildId: guild.id, active: true }).lean();
        const picked = [];
        const missing = [];
        for (const n of rawNames) {
            const found = allClans.find((c) => c.name.toLowerCase() === n.toLowerCase());
            if (found)
                picked.push(found);
            else
                missing.push(n);
        }
        if (missing.length) {
            await interaction.editReply({ content: `❌ لم أجد العشائر: ${missing.map((m) => `«${m}»`).join('، ')}` });
            return;
        }
        const clanIds = picked.map((p) => String(p._id));
        const active = await models_1.ClanBattle.findOne({ guildId: guild.id, status: 'active' });
        if (active) {
            await interaction.editReply({ content: '❌ هناك مسابقة نشطة حالياً — ألغها أولاً (🛑 إلغاء المسابقة)' });
            return;
        }
        // القناة: من الإعدادات أولاً، وإلا قناة اللوحة/القناة الحالية
        let channelId;
        try {
            const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('../../models')));
            const settings = await getGuildSettings(guild.id);
            channelId = settings?.clans?.battleChannelId;
        }
        catch {
            channelId = undefined;
        }
        if (!channelId) {
            channelId = interaction.channel?.id;
        }
        const startsAt = new Date();
        const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
        const battle = await models_1.ClanBattle.create({
            guildId: guild.id,
            name: nameInput || 'مسابقة عشائرية',
            clanIds,
            durationDays: days,
            startsAt,
            endsAt,
            channelId,
            status: 'active',
        });
        const mentions = picked.map((p) => `**${p.name}** (${p.members.length} عضو)`).join('\n');
        const desc = `⚔️ بدأت «${battle.name}»!\n\nالعشائر المتنافسة:\n${mentions}\n\n` +
            `⏰ المدة: ${days} يوم\n` +
            `📅 تنتهي: ${endsAt.toLocaleString('ar')}\n` +
            (channelId ? `📣 إعلان الفائز في: <#${channelId}>` : '📣 أخبرنا بقناة إعلان الفائز عبر /clan settings');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(DEFAULT_COLOR)
            .setTitle('⚔️ انطلقت المسابقة!')
            .setDescription(desc.slice(0, 4096))
            .setTimestamp();
        logger.info(`Clan battle started: ${battle.name} (${clanIds.length} clans) by ${userId}`);
        await interaction.editReply({ embeds: [embed] });
    },
};
exports.default = handler;
//# sourceMappingURL=clanCompModal.js.map