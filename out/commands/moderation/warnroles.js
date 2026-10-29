"use strict";
// ============================================
// Liberty City Bot - WarnRoles Debug Command
// تشخيص إعدادات رولات التحذير التسلسلية
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
const models_1 = require("../../models");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('warnroles')
        .setDescription('تشخيص وإدارة رولات التحذير التسلسلية')
        .addSubcommand(sub => sub
        .setName('debug')
        .setDescription('فحص إعدادات رولات التحذير التسلسلية في قاعدة البيانات'))
        .addSubcommand(sub => sub
        .setName('refresh')
        .setDescription('إعادة تحميل إعدادات رولات التحذير من قاعدة البيانات'))
        .addSubcommand(sub => sub
        .setName('test')
        .setDescription('اختبار إعطاء رول تحذير تسلسلي لإداري')
        .addUserOption(opt => opt.setName('target').setDescription('الإداري المراد تحذيره').setRequired(true))
        .addIntegerOption(opt => opt.setName('level').setDescription('مستوى التحذير (1/2/3)').setRequired(true).setMinValue(1).setMaxValue(3)))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),
    async execute(interaction) {
        const client = interaction.client;
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        await interaction.deferReply({ ephemeral: true });
        try {
            if (subcommand === 'debug') {
                // إبطال الكاش وجلب بيانات طازجة
                (0, models_1.invalidateGuildSettings)(guild.id);
                const settings = await (0, models_1.getGuildSettings)(guild.id);
                const sequential = settings.warnRoles?.adminSequential || {};
                const embed = {
                    title: '🔍 تشخيص رولات التحذير التسلسلية',
                    color: 0x00D4FF,
                    fields: [
                        {
                            name: '📊 البيانات من قاعدة البيانات',
                            value: [
                                `**role1Id:** ${sequential.role1Id || '❌ غير مضبوط'}`,
                                `**role2Id:** ${sequential.role2Id || '❌ غير مضبوط'}`,
                                `**role3Id:** ${sequential.role3Id || '❌ غير مضبوط'}`,
                            ].join('\n'),
                            inline: false,
                        },
                        {
                            name: '🔍 تحقق من وجود الرولات في السيرفر',
                            value: [
                                `role1Id: ${sequential.role1Id ? (interaction.guild.roles.cache.has(sequential.role1Id) ? '✅ موجود' : '❌ غير موجود في السيرفر') : '❌ غير مضبوط'}`,
                                `role2Id: ${sequential.role2Id ? (interaction.guild.roles.cache.has(sequential.role2Id) ? '✅ موجود' : '❌ غير موجود في السيرفر') : '❌ غير مضبوط'}`,
                                `role3Id: ${sequential.role3Id ? (interaction.guild.roles.cache.has(sequential.role3Id) ? '✅ موجود' : '❌ غير موجود في السيرفر') : '❌ غير مضبوط'}`,
                            ].join('\n'),
                            inline: false,
                        },
                        {
                            name: '📦 الكاش',
                            value: `TTL: 30 ثانية\nاستخدم \`/warnroles refresh\` لمسح الكاش`,
                            inline: false,
                        },
                    ],
                    timestamp: new Date().toISOString(),
                };
                await interaction.editReply({ embeds: [embed] });
            }
            else if (subcommand === 'refresh') {
                (0, models_1.invalidateGuildSettings)(guild.id);
                const freshSettings = await (0, models_1.getGuildSettings)(guild.id);
                await interaction.editReply({
                    content: `✅ تم تحديث الإعدادات من قاعدة البيانات\n\n**البيانات الحالية:**\n1️⃣ ${freshSettings.warnRoles?.adminSequential?.role1Id ? `<@&${freshSettings.warnRoles.adminSequential.role1Id}>` : '❌'}\n2️⃣ ${freshSettings.warnRoles?.adminSequential?.role2Id ? `<@&${freshSettings.warnRoles.adminSequential.role2Id}>` : '❌'}\n3️⃣ ${freshSettings.warnRoles?.adminSequential?.role3Id ? `<@&${freshSettings.warnRoles.adminSequential.role3Id}>` : '❌'}`,
                });
            }
            else if (subcommand === 'test') {
                const target = interaction.options.getUser('target', true);
                const level = interaction.options.getInteger('level', true);
                const member = await guild.members.fetch(target.id).catch(() => null);
                if (!member) {
                    await interaction.editReply({ content: '❌ العضو غير موجود في السيرفر' });
                    return;
                }
                (0, models_1.invalidateGuildSettings)(guild.id);
                const settings = await (0, models_1.getGuildSettings)(guild.id);
                // محاكاة التحذير التسلسلي
                const { applySequentialAdminWarnRoles } = await Promise.resolve().then(() => __importStar(require('../../utils/warnRoles')));
                const result = await applySequentialAdminWarnRoles({
                    settings,
                    guild,
                    executor: interaction.member,
                    target: member,
                    reason: `اختبار تحذير تسلسلي رقم ${level}`,
                });
                if (result) {
                    await interaction.editReply({ content: `✅ ${result}` });
                }
                else {
                    await interaction.editReply({ content: `❌ فشل: لا يوجد رول تحذير رقم ${level} مُعد أو العضو مش إداري` });
                }
            }
        }
        catch (error) {
            await interaction.editReply({ content: `❌ خطأ: ${error.message}` });
        }
    },
};
exports.default = command;
//# sourceMappingURL=warnroles.js.map