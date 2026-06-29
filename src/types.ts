/**
 * Only Codeblock 插件类型定义
 */

/** 字号模式 */
export type FontSizeMode = 'follow' | 'custom';

/** 滚动条显示策略 */
export type ScrollbarMode = 'always' | 'hover';

/** 折叠状态 */
export type CollapseState = 'expanded' | 'collapsed';

/** 高度限制方案（与具体数值互斥） */
export type HeightLimitMode = 'px' | 'lines' | 'none';

/** 代码块元信息（从 fence 解析得到） */
export interface CodeFenceMeta {
	/** 语言标识（小写，空时为 'text'） */
	lang: string;
	/** 代码块名称（来自 title="xxx" 属性） */
	title: string;
	/** 原始 fence 首行（如 ```js title="demo"） */
	rawFirstLine: string;
	/** 原始代码内容 */
	source: string;
}

/** 阅读视图代码块构建上下文 */
export interface BuildCodeBlockContext {
	/** 设置引用 */
	settings: OnlyCodeblockSettings;
	/** 当前是否为暗色（已根据 Obsidian 主题计算） */
	isDark: boolean;
	/** 点击复制时的回调（用于 Notice 反馈） */
	onCopy?: () => void;
}

/** 插件设置接口 */
export interface OnlyCodeblockSettings {
	/* ---------- 命名与折叠 ---------- */
	/** 空名称时的默认显示名 */
	defaultName: string;
	/** 阅读模式默认折叠 */
	defaultFolded: boolean;

	/* ---------- 语言 ---------- */
	/** 可选语言列表（带顺序，用于模态框选择） */
	languageList: string[];
	/** 跳过强化的语言列表（mermaid/math 等会自动跳过） */
	excludeLanguages: string[];

	/* ---------- 外观 ---------- */
	/** 字号模式 */
	fontSizeMode: FontSizeMode;
	/** 自定义字号 px（fontSizeMode='custom' 时生效） */
	customFontSize: number;
	/** 显示行号 */
	showLineNumbers: boolean;
	/** 装饰条显示语言标签 */
	showLangLabel: boolean;
	/** 装饰条背景色（亮色，十六进制） */
	headerBgLight: string;
	/** 装饰条背景色（暗色，十六进制） */
	headerBgDark: string;
	/** 代码区背景色（亮色，十六进制） */
	codeBgLight: string;
	/** 代码区背景色（暗色，十六进制） */
	codeBgDark: string;
	/** 选中边框颜色（十六进制，留空使用 Obsidian 主题色） */
	selectedBorderColor: string;

	/* ---------- 滚动条 ---------- */
	/** 滚动条显示策略 */
	scrollbarMode: ScrollbarMode;
	/** 高度限制方案 */
	heightLimitMode: HeightLimitMode;
	/** 按 px 限制时的最大高度（超出后纵向滚动，0 表示不限制） */
	maxBlockHeightPx: number;
	/** 按行数限制时的最大行数（超出后纵向滚动，0 表示不限制） */
	maxBlockHeightLines: number;

	/* ---------- 复制 ---------- */
	/** 复制成功显示 Notice */
	showCopyNotice: boolean;
}
