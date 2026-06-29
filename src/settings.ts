/**
 * Only Codeblock 插件设置接口、默认值与设置页签
 *
 * 每项设置都配有"重置为默认"按钮（rotate-ccw 图标）。
 * 设置变更后通过 saveSettings() 触发阅读视图实时重渲染。
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import OnlyCodeblock from './main';
import { DEFAULT_LANGUAGE_LIST, DEFAULT_SETTINGS } from './constants';
import type {
	FontSizeMode,
	HeightLimitMode,
	OnlyCodeblockSettings,
	ScrollbarMode,
} from './types';

export type { OnlyCodeblockSettings };

export { DEFAULT_SETTINGS };
  
/** 设置项键名（用于重置按钮） */
type SettingKey = keyof OnlyCodeblockSettings;

/**
 * 将字符串（每行一个语言）解析为数组。
 * 容忍空白、逗号、重复项。
 */
function parseLanguageList(text: string): string[] {
	return text
		.split(/[\n,]+/)
		.map((s) => s.trim().toLowerCase())
		.filter((s) => s.length > 0)
		.filter((s, i, arr) => arr.indexOf(s) === i);
}

function languageListToText(list: string[]): string {
	return list.join('\n');
}

/** 深拷贝默认值（处理数组） */
function cloneDefault<K extends SettingKey>(key: K): OnlyCodeblockSettings[K] {
	const val = DEFAULT_SETTINGS[key];
	if (Array.isArray(val)) {
		return [...val] as OnlyCodeblockSettings[K];
	}
	return val;
}

export class OnlyCodeblockSettingTab extends PluginSettingTab {
	plugin: OnlyCodeblock;

	constructor(app: App, plugin: OnlyCodeblock) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderNamingSection(containerEl);
		this.renderLanguageSection(containerEl);
		this.renderAppearanceSection(containerEl);
		this.renderScrollbarSection(containerEl);
		this.renderCopySection(containerEl);
	}

	/** 为 Setting 添加"重置为默认"按钮 */
	private addReset<K extends SettingKey>(
		setting: Setting,
		key: K,
		label?: string,
	): Setting {
		setting.addExtraButton((btn) => {
			btn.setIcon('rotate-ccw')
				.setTooltip(label ?? '重置为默认')
				.onClick(async () => {
					this.plugin.settings[key] = cloneDefault(key);
					await this.plugin.saveSettings();
					this.display();
				});
		});
		return setting;
	}

	/* ---------- 命名与折叠 ---------- */
	private renderNamingSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('命名与折叠').setHeading();

		const s1 = new Setting(containerEl)
			.setName('默认代码块名称')
			.setDesc('当代码块未设置 title 时显示的占位名称。')
			.addText((text) =>
				text
					.setPlaceholder('Code')
					.setValue(this.plugin.settings.defaultName)
					.onChange(async (value) => {
						this.plugin.settings.defaultName = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s1, 'defaultName');

		const s2 = new Setting(containerEl)
			.setName('阅读模式默认折叠')
			.setDesc('打开阅读视图时，代码块默认折叠为装饰条。')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.defaultFolded)
					.onChange(async (value) => {
						this.plugin.settings.defaultFolded = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s2, 'defaultFolded');
	}

	/* ---------- 语言 ---------- */
	private renderLanguageSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('语言').setHeading();

		const s1 = new Setting(containerEl)
			.setName('可选语言列表')
			.setDesc(
				'创建代码块模态框中可选择的语言，每行一个（也允许用逗号分隔）。顺序即显示顺序。',
			)
			.addTextArea((text) => {
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- 多行示例列表，非英文句子
					.setPlaceholder('javascript\ntypescript\njava\n...')
					.setValue(languageListToText(this.plugin.settings.languageList))
					.onChange(async (value) => {
						this.plugin.settings.languageList = parseLanguageList(value);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 8;
				text.inputEl.setCssProps({ width: '100%' });
			});
		this.addReset(s1, 'languageList');

		const s2 = new Setting(containerEl)
			.setName('排除语言列表')
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- 中文描述
				'这些语言将保留 Obsidian 原生渲染（除 mermaid/math/flow/dot 等已自动跳过外）。每行一个。',
			)
			.addTextArea((text) => {
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- 多行示例列表，非英文句子
					.setPlaceholder('eval\ntext')
					.setValue(languageListToText(this.plugin.settings.excludeLanguages))
					.onChange(async (value) => {
						this.plugin.settings.excludeLanguages = parseLanguageList(value);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 4;
				text.inputEl.setCssProps({ width: '100%' });
			});
		this.addReset(s2, 'excludeLanguages');
	}

	/* ---------- 外观 ---------- */
	private renderAppearanceSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('外观').setHeading();

		// 字号模式
		const s1 = new Setting(containerEl)
			.setName('字号')
			.setDesc('代码字号：跟随正文或自定义。Obsidian 默认正文字号为 16px。')
			.addDropdown((drop) =>
				drop
					.addOption('follow', '跟随正文')
					.addOption('custom', '自定义')
					.setValue(this.plugin.settings.fontSizeMode)
					.onChange(async (value) => {
						this.plugin.settings.fontSizeMode = value as FontSizeMode;
						await this.plugin.saveSettings();
						this.display();
					}),
			);
		this.addReset(s1, 'fontSizeMode');

		// 自定义字号（仅 fontSizeMode='custom' 时显示）
		if (this.plugin.settings.fontSizeMode === 'custom') {
			const s2 = new Setting(containerEl)
				.setName('自定义字号 (px)')
				.setDesc('范围 8 ~ 48 px。')
				.addText((text) =>
					text
						.setPlaceholder('14')
						.setValue(String(this.plugin.settings.customFontSize))
						.onChange(async (value) => {
							const n = Number.parseInt(value, 10);
							if (Number.isFinite(n) && n >= 8 && n <= 48) {
								this.plugin.settings.customFontSize = n;
								await this.plugin.saveSettings();
							}
						}),
				);
			this.addReset(s2, 'customFontSize');
		}

		// 显示行号
		const s3 = new Setting(containerEl)
			.setName('显示行号')
			.setDesc('在代码区左侧显示行号。')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showLineNumbers)
					.onChange(async (value) => {
						this.plugin.settings.showLineNumbers = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s3, 'showLineNumbers');

		// 装饰条显示语言标签
		const s4 = new Setting(containerEl)
			.setName('装饰条显示语言标签')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showLangLabel)
					.onChange(async (value) => {
						this.plugin.settings.showLangLabel = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s4, 'showLangLabel');

		/* ----- 颜色（统一使用十六进制 ColorPicker） ----- */

		const s5 = new Setting(containerEl)
			.setName('装饰条背景色（亮色）')
			.setDesc('Obsidian 亮色主题下装饰条的背景色。')
			.addColorPicker((pick) =>
				pick
					.setValue(this.plugin.settings.headerBgLight)
					.onChange(async (value) => {
						this.plugin.settings.headerBgLight = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s5, 'headerBgLight');

		const s6 = new Setting(containerEl)
			.setName('装饰条背景色（暗色）')
			.setDesc('Obsidian 暗色主题下装饰条的背景色。')
			.addColorPicker((pick) =>
				pick
					.setValue(this.plugin.settings.headerBgDark)
					.onChange(async (value) => {
						this.plugin.settings.headerBgDark = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s6, 'headerBgDark');

		const s7 = new Setting(containerEl)
			.setName('代码区背景色（亮色）')
			.setDesc('Obsidian 亮色主题下代码区的背景色。')
			.addColorPicker((pick) =>
				pick
					.setValue(this.plugin.settings.codeBgLight)
					.onChange(async (value) => {
						this.plugin.settings.codeBgLight = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s7, 'codeBgLight');

		const s8 = new Setting(containerEl)
			.setName('代码区背景色（暗色）')
			.setDesc('Obsidian 暗色主题下代码区的背景色。')
			.addColorPicker((pick) =>
				pick
					.setValue(this.plugin.settings.codeBgDark)
					.onChange(async (value) => {
						this.plugin.settings.codeBgDark = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s8, 'codeBgDark');

		// 选中边框颜色：toggle + colorpicker
		const useCustomBorder = this.plugin.settings.selectedBorderColor !== '';
		const s9 = new Setting(containerEl)
			.setName('选中边框颜色')
			.setDesc('点击代码区时显示的边框颜色。关闭时使用 Obsidian 主题色。')
			.addToggle((toggle) =>
				toggle
					.setValue(useCustomBorder)
					.onChange(async (value) => {
						this.plugin.settings.selectedBorderColor = value
							? '#505050'
							: '';
						await this.plugin.saveSettings();
						this.display();
					}),
			);
		if (useCustomBorder) {
			s9.addColorPicker((pick) =>
				pick
					.setValue(this.plugin.settings.selectedBorderColor)
					.onChange(async (value) => {
						this.plugin.settings.selectedBorderColor = value;
						await this.plugin.saveSettings();
					}),
			);
		}
		this.addReset(s9, 'selectedBorderColor');
	}

	/* ---------- 滚动条 ---------- */
	private renderScrollbarSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('滚动条与高度').setHeading();

		// 滚动条显示策略
		const s1 = new Setting(containerEl)
			.setName('滚动条显示策略')
			.addDropdown((drop) =>
				drop
					.addOption('hover', '鼠标悬停时显示')
					.addOption('always', '常显')
					.setValue(this.plugin.settings.scrollbarMode)
					.onChange(async (value) => {
						this.plugin.settings.scrollbarMode = value as ScrollbarMode;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s1, 'scrollbarMode');

		// 高度限制方案（互斥）
		const s2 = new Setting(containerEl)
			.setName('高度限制方案')
			.setDesc('选择代码区高度限制方式。三种方案互斥。')
			.addDropdown((drop) =>
				drop
					.addOption('px', '按像素 (px) 限制')
					.addOption('lines', '按行数限制')
					.addOption('none', '不限制')
					.setValue(this.plugin.settings.heightLimitMode)
					.onChange(async (value) => {
						this.plugin.settings.heightLimitMode = value as HeightLimitMode;
						await this.plugin.saveSettings();
						this.display();
					}),
			);
		this.addReset(s2, 'heightLimitMode');

		// 按 px 限制
		if (this.plugin.settings.heightLimitMode === 'px') {
			const s3 = new Setting(containerEl)
				.setName('最大高度 (px)')
				.setDesc('超出此高度后纵向滚动。0 表示不限制。')
				.addText((text) =>
					text
						.setPlaceholder('400')
						.setValue(String(this.plugin.settings.maxBlockHeightPx))
						.onChange(async (value) => {
							const n = Number.parseInt(value, 10);
							if (Number.isFinite(n) && n >= 0) {
								this.plugin.settings.maxBlockHeightPx = n;
								await this.plugin.saveSettings();
							}
						}),
				);
			this.addReset(s3, 'maxBlockHeightPx');
		}

		// 按行数限制
		if (this.plugin.settings.heightLimitMode === 'lines') {
			const s4 = new Setting(containerEl)
				.setName('最大行数')
				.setDesc('超出此行数后纵向滚动。0 表示不限制。')
				.addText((text) =>
					text
						.setPlaceholder('30')
						.setValue(String(this.plugin.settings.maxBlockHeightLines))
						.onChange(async (value) => {
							const n = Number.parseInt(value, 10);
							if (Number.isFinite(n) && n >= 0) {
								this.plugin.settings.maxBlockHeightLines = n;
								await this.plugin.saveSettings();
							}
						}),
				);
			this.addReset(s4, 'maxBlockHeightLines');
		}
	}

	/* ---------- 复制 ---------- */
	private renderCopySection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('复制').setHeading();

		const s1 = new Setting(containerEl)
			.setName('复制成功提示')
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- 中文描述
			.setDesc('复制代码后显示 Notice 提示。')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showCopyNotice)
					.onChange(async (value) => {
						this.plugin.settings.showCopyNotice = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s1, 'showCopyNotice');
	}
}

// 引入 DEFAULT_LANGUAGE_LIST 以避免未使用导入警告（常量在 constants.ts 中导出，此处仅作类型参考）
void DEFAULT_LANGUAGE_LIST;
