/**
 * Only Codeblock 插件设置接口、默认值与设置页签
 *
 * 每项设置都配有"重置为默认"按钮（rotate-ccw 图标）。
 * 设置变更后通过 saveSettings() 触发阅读视图实时重渲染。
 * 颜色类设置统一使用文本框输入十六进制颜色代码，带格式校验。
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

/** 十六进制颜色格式校验：支持 #RGB / #RGBA / #RRGGBB / #RRGGBBAA（不区分大小写） */
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** 校验十六进制颜色字符串 */
function isValidHexColor(s: string): boolean {
	return HEX_COLOR_REGEX.test(s.trim());
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
		this.renderExportSection(containerEl);
		this.renderViewerSection(containerEl);
		this.renderRibbonSection(containerEl);
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
					// 重置后重新渲染阅读视图，确保 DOM 结构类设置生效
					this.plugin.rerenderReadingView();
					this.display();
				});
		});
		return setting;
	}

	/**
	 * 添加十六进制颜色文本输入设置项。
	 * - 文本框输入，placeholder 为 #RRGGBB
	 * - 实时校验格式，非法时在描述区显示提示且不保存
	 * - 输入合法时保存并清除提示
	 */
	private addColorSetting(
		containerEl: HTMLElement,
		key: keyof OnlyCodeblockSettings,
		name: string,
		desc: string,
	): Setting {
		const setting = new Setting(containerEl).setName(name).setDesc(desc);
		const descEl = setting.descEl;

		setting.addText((text) => {
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- 十六进制颜色格式示例
			text.setPlaceholder('#RRGGBB')
				.setValue(String(this.plugin.settings[key]))
				.onChange(async (value) => {
					const trimmed = value.trim();
					if (!isValidHexColor(trimmed)) {
						// eslint-disable-next-line obsidianmd/ui/sentence-case -- 中文错误提示
						descEl.setText('格式错误：请输入十六进制颜色，如 #RRGGBB、#RGB、#RRGGBBAA');
						descEl.setCssProps({ color: 'var(--text-error)' });
						return;
					}
					descEl.setText(desc);
					descEl.setCssProps({ color: '' });
					(this.plugin.settings[key] as string) = trimmed;
					await this.plugin.saveSettings();
				});
			// 限制输入宽度
			text.inputEl.setCssProps({ width: '120px' });
		});
		this.addReset(setting, key);
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
						this.plugin.rerenderReadingView();
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
						this.plugin.rerenderReadingView();
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
						this.plugin.rerenderReadingView();
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
						this.plugin.rerenderReadingView();
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
						this.plugin.rerenderReadingView();
					}),
			);
		this.addReset(s4, 'showLangLabel');

		/* ----- 颜色（统一使用十六进制文本框输入 + 格式校验） ----- */

		this.addColorSetting(
			containerEl,
			'headerBgLight',
			'装饰条背景色（亮色）',
			'Obsidian 亮色主题下装饰条的背景色。格式：#RRGGBB。',
		);

		this.addColorSetting(
			containerEl,
			'headerBgDark',
			'装饰条背景色（暗色）',
			'Obsidian 暗色主题下装饰条的背景色。格式：#RRGGBB。',
		);

		this.addColorSetting(
			containerEl,
			'codeBgLight',
			'代码块背景色（亮色）',
			'Obsidian 亮色主题下代码区的背景色。格式：#RRGGBB。',
		);

		this.addColorSetting(
			containerEl,
			'codeBgDark',
			'代码块背景色（暗色）',
			'Obsidian 暗色主题下代码区的背景色。格式：#RRGGBB。',
		);

		this.addColorSetting(
			containerEl,
			'hoverBgLight',
			'按钮 hover 背景色（亮色）',
			'亮色主题下鼠标悬停按钮时的背景色。格式：#RRGGBB。',
		);

		this.addColorSetting(
			containerEl,
			'hoverBgDark',
			'按钮 hover 背景色（暗色）',
			'暗色主题下鼠标悬停按钮时的背景色。格式：#RRGGBB。',
		);

		// 选中边框颜色：toggle + 文本框
		const useCustomBorder = this.plugin.settings.selectedBorderColor !== '';
		const sBorder = new Setting(containerEl)
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
			const descEl = sBorder.descEl;
			sBorder.addText((text) => {
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- 十六进制颜色格式示例
				text.setPlaceholder('#RRGGBB')
					.setValue(this.plugin.settings.selectedBorderColor)
					.onChange(async (value) => {
						const trimmed = value.trim();
						if (!isValidHexColor(trimmed)) {
							// eslint-disable-next-line obsidianmd/ui/sentence-case -- 中文错误提示
							descEl.setText('格式错误：请输入 #RRGGBB 格式');
							descEl.setCssProps({ color: 'var(--text-error)' });
							return;
						}
						descEl.setText('点击代码区时显示的边框颜色。关闭时使用 Obsidian 主题色。');
						descEl.setCssProps({ color: '' });
						this.plugin.settings.selectedBorderColor = trimmed;
						await this.plugin.saveSettings();
					});
				text.inputEl.setCssProps({ width: '120px' });
			});
		}
		this.addReset(sBorder, 'selectedBorderColor');

		// 选中边框粗细
		const sBorderWidth = new Setting(containerEl)
			.setName('选中边框粗细 (px)')
			.setDesc('范围 0 ~ 2 px，步长 0.1。0 表示不显示选中边框。')
			.addSlider((slider) => {
				slider
					.setLimits(0, 2, 0.1)
					.setValue(this.plugin.settings.selectedBorderWidth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						// 修正浮点精度问题
						this.plugin.settings.selectedBorderWidth = Math.round(value * 10) / 10;
						await this.plugin.saveSettings();
					});
			});
		this.addReset(sBorderWidth, 'selectedBorderWidth');
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
						this.plugin.rerenderReadingView();
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

		const s2 = new Setting(containerEl)
			.setName('复制按钮文本')
			.setDesc('代码块装饰条上复制按钮显示的文本。')
			.addText((text) =>
				text
					.setPlaceholder('复制')
					.setValue(this.plugin.settings.copyButtonText)
					.onChange(async (value) => {
						this.plugin.settings.copyButtonText = value;
						await this.plugin.saveSettings();
						this.plugin.rerenderReadingView();
					}),
			);
		this.addReset(s2, 'copyButtonText');

		const s3 = new Setting(containerEl)
			.setName('复制成功文本')
			.setDesc('复制成功后按钮临时显示的文本。')
			.addText((text) =>
				text
					.setPlaceholder('已复制')
					.setValue(this.plugin.settings.copySuccessText)
					.onChange(async (value) => {
						this.plugin.settings.copySuccessText = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s3, 'copySuccessText');

		this.addColorSetting(
			containerEl,
			'copySuccessColorLight',
			'复制成功文本颜色（亮色）',
			'亮色主题下复制成功文本的颜色。格式：#RRGGBB。',
		);

		this.addColorSetting(
			containerEl,
			'copySuccessColorDark',
			'复制成功文本颜色（暗色）',
			'暗色主题下复制成功文本的颜色。格式：#RRGGBB。',
		);
	}

	/* ---------- 导出 ---------- */
	private renderExportSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('导出').setHeading();

		const s1 = new Setting(containerEl)
			.setName('默认导出文件夹')
			.setDesc(
				'移动端导出时的默认文件夹路径（vault 内相对路径，如 code-exports/）。桌面端使用系统另存为对话框，此设置仅作移动端回退。留空时导出弹框中必须手动填写。',
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- 文件夹路径示例
					.setPlaceholder('code-exports')
					.setValue(this.plugin.settings.exportPath)
					.onChange(async (value) => {
						this.plugin.settings.exportPath = value.trim();
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s1, 'exportPath');
	}

	/* ---------- 查看器 ---------- */
	private renderViewerSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('新窗口查看').setHeading();

		const s1 = new Setting(containerEl)
			.setName('最大宽度 (px)')
			.setDesc('在新窗口中查看代码时弹框的最大宽度。范围 400 ~ 2400 px。')
			.addText((text) =>
				text
					.setPlaceholder('1000')
					.setValue(String(this.plugin.settings.viewerMaxWidth))
					.onChange(async (value) => {
						const n = Number.parseInt(value, 10);
						if (Number.isFinite(n) && n >= 400 && n <= 2400) {
							this.plugin.settings.viewerMaxWidth = n;
							await this.plugin.saveSettings();
						}
					}),
			);
		this.addReset(s1, 'viewerMaxWidth');

		const s2 = new Setting(containerEl)
			.setName('最大高度 (px)')
			.setDesc('在新窗口中查看代码时弹框的最大高度。范围 300 ~ 2000 px。')
			.addText((text) =>
				text
					.setPlaceholder('700')
					.setValue(String(this.plugin.settings.viewerMaxHeight))
					.onChange(async (value) => {
						const n = Number.parseInt(value, 10);
						if (Number.isFinite(n) && n >= 300 && n <= 2000) {
							this.plugin.settings.viewerMaxHeight = n;
							await this.plugin.saveSettings();
						}
					}),
			);
		this.addReset(s2, 'viewerMaxHeight');
	}

	/* ---------- 侧边栏 ---------- */
	private renderRibbonSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('侧边栏按钮').setHeading();

		const s1 = new Setting(containerEl)
			.setName('显示"插入代码块"按钮')
			.setDesc('在左侧栏显示插入代码块的快捷按钮。')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showAddRibbon)
					.onChange(async (value) => {
						this.plugin.settings.showAddRibbon = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s1, 'showAddRibbon');

		const s2 = new Setting(containerEl)
			.setName('显示"编辑代码块"按钮')
			.setDesc('在左侧栏显示编辑当前代码块的快捷按钮。')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showEditRibbon)
					.onChange(async (value) => {
						this.plugin.settings.showEditRibbon = value;
						await this.plugin.saveSettings();
					}),
			);
		this.addReset(s2, 'showEditRibbon');
	}
}

// 引入 DEFAULT_LANGUAGE_LIST 以避免未使用导入警告（常量在 constants.ts 中导出，此处仅作类型参考）
void DEFAULT_LANGUAGE_LIST;
