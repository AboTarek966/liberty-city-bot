// ============================================
// Liberty City Bot - Embed Builder (State + UI)
// ============================================

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { Colors } from './embeds';

// --------------------------------------------
// Types
// --------------------------------------------
export interface EmbedFieldData {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedBuilderData {
  title?: string;
  description?: string;
  color: number;
  image?: string;
  thumbnail?: string;
  fields: EmbedFieldData[];
}

export interface EmbedBuilderSession {
  data: EmbedBuilderData;
  /** القناة المستهدفة من خيار /embed channel (اختياري) */
  channelId?: string;
  expiresAt: number;
}

export interface BuilderView {
  content: string;
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

// --------------------------------------------
// Constants
// --------------------------------------------
const SESSION_TTL = 10 * 60 * 1000; // ⏳ مدة صلاحية الجلسة: 10 دقائق

export const EB_BUTTON_PREFIX = 'eb|';
export const EB_MODAL_PREFIX = 'ebm|';
export const EB_MAX_FIELDS = 25;

export const EB_PLACEHOLDER_TITLE = '✨ منشئ الإمبد';
export const EB_PLACEHOLDER_DESCRIPTION = '💡 ابدأ بإضافة العنوان أو الوصف';
export const EB_FOOTER_TEXT = 'Liberty City Embed Builder';
export const EB_MAIN_CONTENT = '🛠️ لوحة إنشاء الإمبد — استخدم الأزرار أدناه';

export interface ColorPreset {
  label: string;
  emoji: string;
  hex: string;
}

export const EB_COLOR_PRESETS: ColorPreset[] = [
  { label: 'أسود', emoji: '⚫', hex: '#000000' },
  { label: 'أبيض', emoji: '⚪', hex: '#FFFFFF' },
  { label: 'أزرق ديسكورد', emoji: '🟣', hex: '#5865F2' },
  { label: 'أزرق البوت', emoji: '🔵', hex: '#00D4FF' },
  { label: 'أخضر', emoji: '🟢', hex: '#57F287' },
  { label: 'أحمر', emoji: '🔴', hex: '#ED4245' },
  { label: 'برتقالي', emoji: '🟠', hex: '#FAA61A' },
  { label: 'ذهبي', emoji: '🟡', hex: '#FEE75C' },
  { label: 'بنفسجي', emoji: '🟪', hex: '#9B59B6' },
  { label: 'وردي', emoji: '🌸', hex: '#EB459E' },
];

// --------------------------------------------
// Color Helpers
// --------------------------------------------
export function parseHexColor(input: string): number | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
  if (!match) return null;
  return parseInt(match[1], 16);
}

const DEFAULT_COLOR: number =
  parseHexColor(String(Colors.primary ?? '')) ?? 0x00d4ff;

export function getDefaultColor(): number {
  return DEFAULT_COLOR;
}

// --------------------------------------------
// State Store (In-Memory, TTL + Lazy Cleanup)
// --------------------------------------------
const sessions = new Map<string, EmbedBuilderSession>();

export function createSession(userId: string, channelId?: string): EmbedBuilderSession {
  const session: EmbedBuilderSession = {
    data: { color: DEFAULT_COLOR, fields: [] },
    expiresAt: Date.now() + SESSION_TTL,
  };
  if (channelId) session.channelId = channelId;
  sessions.set(userId, session);
  return session;
}

export function getSession(userId: string): EmbedBuilderSession | null {
  const session = sessions.get(userId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(userId); // ⏳ تنظيف كسول للجلسة منتهية الصلاحية
    return null;
  }
  return session;
}

export function touchSession(userId: string): void {
  const session = sessions.get(userId);
  if (session) session.expiresAt = Date.now() + SESSION_TTL;
}

export function deleteSession(userId: string): void {
  sessions.delete(userId);
}

// --------------------------------------------
// Preview Builder
// --------------------------------------------
export function buildPreviewEmbed(data: EmbedBuilderData): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(data.color)
    .setTitle(data.title?.trim() || EB_PLACEHOLDER_TITLE)
    .setDescription(data.description?.trim() || EB_PLACEHOLDER_DESCRIPTION)
    .setFooter({ text: EB_FOOTER_TEXT });

  if (data.thumbnail) embed.setThumbnail(data.thumbnail);
  if (data.image) embed.setImage(data.image);
  if (data.fields.length > 0) {
    embed.addFields(
      data.fields.map(field => ({
        name: field.name,
        value: field.value,
        inline: field.inline,
      })),
    );
  }

  return embed;
}

// --------------------------------------------
// Components
// --------------------------------------------
type BuilderRow = ActionRowBuilder<MessageActionRowComponentBuilder>;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function builderButton(
  id: string,
  emoji: string,
  label: string,
  style: ButtonStyle,
): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`${EB_BUTTON_PREFIX}${id}`)
    .setEmoji(emoji)
    .setLabel(label)
    .setStyle(style);
}

function backButton(): ButtonBuilder {
  return builderButton('back', '↩️', 'رجوع', ButtonStyle.Secondary);
}

function row(...components: MessageActionRowComponentBuilder[]): BuilderRow {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...components);
}

export function buildMainComponents(): BuilderRow[] {
  return [
    row(
      builderButton('title', '📝', 'العنوان', ButtonStyle.Primary),
      builderButton('description', '📄', 'الوصف', ButtonStyle.Primary),
      builderButton('color', '🎨', 'اللون', ButtonStyle.Secondary),
    ),
    row(
      builderButton('image', '🖼️', 'الصورة', ButtonStyle.Secondary),
      builderButton('thumbnail', '🔍', 'الصورة المصغّرة', ButtonStyle.Secondary),
      builderButton('addfield', '➕', 'إضافة حقل', ButtonStyle.Success),
    ),
    row(
      builderButton('delfield', '🗑️', 'حذف حقل', ButtonStyle.Danger),
      builderButton('refresh', '👁️', 'تحديث المعاينة', ButtonStyle.Secondary),
      builderButton('send', '📤', 'إرسال للقناة', ButtonStyle.Success),
      builderButton('cancel', '🗑️', 'إلغاء', ButtonStyle.Danger),
    ),
  ];
}

// --------------------------------------------
// Views
// --------------------------------------------
export function renderMain(data: EmbedBuilderData, status?: string): BuilderView {
  return {
    content: status || EB_MAIN_CONTENT,
    embeds: [buildPreviewEmbed(data)],
    components: buildMainComponents(),
  };
}

export function renderColorView(data: EmbedBuilderData): BuilderView {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${EB_BUTTON_PREFIX}color-select`)
    .setPlaceholder('🎨 اختر لون الإمبد...')
    .addOptions(
      ...EB_COLOR_PRESETS.map(preset => ({
        label: `${preset.emoji} ${preset.label}`,
        description: preset.hex,
        value: preset.hex,
      })),
      {
        label: '🔢 لون مخصص (HEX)',
        description: 'أدخل قيمة HEX يدوياً مثل #5865F2',
        value: 'custom',
      },
    );

  return {
    content: '🎨 اختر لون الإمبد من القائمة:',
    embeds: [buildPreviewEmbed(data)],
    components: [row(select), row(backButton())],
  };
}

export function renderFieldDeleteView(data: EmbedBuilderData): BuilderView {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${EB_BUTTON_PREFIX}field-select`)
    .setPlaceholder('🗑️ اختر الحقل المراد حذفه...')
    .addOptions(
      ...data.fields.map((field, index) => {
        const option: { label: string; value: string; description?: string } = {
          label: truncate(`${index + 1}. ${field.name}`, 100),
          value: String(index),
        };
        if (field.value) option.description = truncate(field.value, 100);
        return option;
      }),
    );

  return {
    content: `🗑️ اختر الحقل المراد حذفه (${data.fields.length}/${EB_MAX_FIELDS}):`,
    embeds: [buildPreviewEmbed(data)],
    components: [row(select), row(backButton())],
  };
}
