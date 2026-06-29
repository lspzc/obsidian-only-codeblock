/**
 * Only Codeblock 插件常量
 */

import type { OnlyCodeblockSettings } from './types';

/** 默认可选语言列表（用户可在设置中重排/增删） */
export const DEFAULT_LANGUAGE_LIST: string[] = [
    'text',
    'javascript',
    'typescript',
    'java',
    'python',
    'sql',
    'html',
    'css',
    'json',
    'bash',
    'shell',
    'go',
    'rust',
    'cpp',
    'c',
    'csharp',
    'php',
    'yaml',
    'markdown',
    'xml',
];

/**
 * 默认排除的语言（Obsidian 已渲染为图形/公式，不应强化）。
 * 即使用户未在 excludeLanguages 中配置，这些语言也会自动跳过。
 */
export const ALWAYS_EXCLUDED_LANGUAGES: ReadonlySet<string> = new Set([
    'mermaid',
    'math',
    'katex',
    'flow',
    'flowchart',
    'dot',
    'graphviz',
    'chart',
    'chartjs',
    'plantuml',
    'tex',
]);

/** CSS 类名前缀，避免与其他插件冲突 */
export const CSS_PREFIX = 'ocbe';

/** 完整 CSS 类名集合 */
export const CSS_CLASS = {
    wrapper: `${CSS_PREFIX}-wrapper`,
    header: `${CSS_PREFIX}-header`,
    /** 顶部装饰条左侧操作区（折叠按钮 + 标题） */
    headerLeft: `${CSS_PREFIX}-header-left`,
    toggle: `${CSS_PREFIX}-toggle`,
    toggleIcon: `${CSS_PREFIX}-toggle-icon`,
    title: `${CSS_PREFIX}-title`,
    titleText: `${CSS_PREFIX}-title-text`,
    langLabel: `${CSS_PREFIX}-lang`,
    /** 顶部装饰条右侧操作区（复制 + 菜单） */
    headerRight: `${CSS_PREFIX}-header-right`,
    copy: `${CSS_PREFIX}-copy`,
    copyIcon: `${CSS_PREFIX}-copy-icon`,
    /** 三点菜单按钮 */
    menu: `${CSS_PREFIX}-menu`,
    menuIcon: `${CSS_PREFIX}-menu-icon`,
    /** 弹出菜单面板 */
    menuPanel: `${CSS_PREFIX}-menu-panel`,
    menuItem: `${CSS_PREFIX}-menu-item`,
    body: `${CSS_PREFIX}-body`,
    gutter: `${CSS_PREFIX}-gutter`,
    codeScroller: `${CSS_PREFIX}-scroller`,
    code: `${CSS_PREFIX}-code`,
    codeLine: `${CSS_PREFIX}-line`,
    /** 已选中（点击代码区后） */
    selected: `${CSS_PREFIX}-selected`,
    /** 折叠状态 */
    collapsed: `${CSS_PREFIX}-collapsed`,
    /** 亮色主题标记 */
    themeLight: `${CSS_PREFIX}-theme-light`,
    /** 暗色主题标记 */
    themeDark: `${CSS_PREFIX}-theme-dark`,
} as const;

/** 默认设置 */
export const DEFAULT_SETTINGS: OnlyCodeblockSettings = {
    // 命名与折叠
    defaultName: 'Code',
    defaultFolded: false,

    // 语言
    languageList: [...DEFAULT_LANGUAGE_LIST],
    excludeLanguages: [],

    // 外观
    fontSizeMode: 'custom',
    customFontSize: 14,
    showLineNumbers: true,
    showLangLabel: true,
    headerBgLight: '#f6f8fa',
    headerBgDark: '#1e2227',
    codeBgLight: '#ffffff',
    codeBgDark: '#16181c',
    selectedBorderColor: '',

    // 滚动条
    scrollbarMode: 'hover',
    heightLimitMode: 'px',
    maxBlockHeightPx: 400,
    maxBlockHeightLines: 30,

    // 复制
    showCopyNotice: true,
};
