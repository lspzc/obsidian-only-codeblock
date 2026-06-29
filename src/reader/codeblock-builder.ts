/**
 * 阅读视图代码块 DOM 构建器
 *
 * 负责将源码 + 元信息转换为带装饰条、行号、滚动条的完整代码块 DOM。
 * 不直接读取 Obsidian 状态，所有依赖通过参数传入，便于测试与复用。
 */

import { CSS_CLASS } from '../constants';
import type { OnlyCodeblockSettings } from '../types';
import { showCodeViewerModal } from '../ui/code-viewer-modal';
import { showExportModal } from '../ui/export-modal';

export interface BuildCodeBlockOptions {
    /** 代码源文本（原始，可能含 \t 与 \r\n） */
    source: string;
    /** 语言标识（小写） */
    lang: string;
    /** 代码块名称（已从 title 属性解析） */
    title: string;
    /** 插件设置 */
    settings: OnlyCodeblockSettings;
    /** 当前是否为暗色（已根据 Obsidian 主题计算） */
    isDark: boolean;
    /** 复制成功时的回调（用于 Notice 反馈） */
    onCopy?: () => void;
}

/** 安全转义 HTML，作为 Prism 不可用时的回退 */
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 处理源码：统一换行符为 \n，去除末尾多余换行。
 * 不再替换 Tab（保留原始缩进，由 Obsidian/CSS 的 tab-size 控制）。
 */
function processSource(source: string): string {
    let s = source.replace(/\r\n?/g, '\n');
    // 去除末尾所有换行（避免渲染多余空行）
    s = s.replace(/\n+$/, '');
    return s;
}

/** 调用 Obsidian 内置 Prism 进行语法高亮，回退到纯文本 */
function highlightCode(processedSource: string, lang: string): string {
    const prism = (
        window as unknown as {
            Prism?: {
                languages: Record<string, unknown>;
                highlight: (code: string, grammar: unknown, lang: string) => string;
            };
        }
    ).Prism;
    if (!prism || typeof prism.highlight !== 'function') {
        return escapeHtml(processedSource);
    }
    const grammar = prism.languages[lang] ?? prism.languages.clike;
    if (!grammar) {
        return escapeHtml(processedSource);
    }
    try {
        return prism.highlight(processedSource, grammar, lang);
    } catch {
        return escapeHtml(processedSource);
    }
}

/** 将用户设置写入 wrapper 的内联 CSS 变量 */
function applyCssVariables(
    wrapper: HTMLElement,
    settings: OnlyCodeblockSettings,
    isDark: boolean,
): void {
    const headerBg = isDark ? settings.headerBgDark : settings.headerBgLight;
    const codeBg = isDark ? settings.codeBgDark : settings.codeBgLight;
    const fontSize =
        settings.fontSizeMode === 'custom'
            ? `${settings.customFontSize}px`
            : 'inherit';
    wrapper.style.setProperty('--ocbe-header-bg', headerBg);
    wrapper.style.setProperty('--ocbe-code-bg', codeBg);
    wrapper.style.setProperty('--ocbe-font-size', fontSize);
    // 高度限制：根据方案计算 max-height
    const maxLineHeight = '1.6';
    let maxHeight = 'none';
    if (settings.heightLimitMode === 'px' && settings.maxBlockHeightPx > 0) {
        maxHeight = `${settings.maxBlockHeightPx}px`;
    } else if (
        settings.heightLimitMode === 'lines' &&
        settings.maxBlockHeightLines > 0
    ) {
        // 行高 1.6em + 上下 padding 24px，估算最大高度
        const linePx = settings.maxBlockHeightLines * 1.6 * (settings.customFontSize || 14);
        maxHeight = `${linePx + 24}px`;
        wrapper.style.setProperty('--ocbe-line-height', maxLineHeight);
    }
    wrapper.style.setProperty('--ocbe-max-height', maxHeight);
    if (settings.selectedBorderColor) {
        wrapper.style.setProperty(
            '--ocbe-selected-border',
            settings.selectedBorderColor,
        );
    }
}

/**
 * 构建单个代码块的完整 DOM。
 * 返回的元素结构：
 *   <div.ocbe-wrapper data-state="expanded|collapsed">
 *     <div.ocbe-header>
 *       <div.ocbe-header-left>
 *         <button.ocbe-toggle><span.ocbe-toggle-icon></span></button>
 *         <span.ocbe-title><span.ocbe-title-text>名称</span></span>
 *         <span.ocbe-lang>js</span>
 *       </div>
 *       <div.ocbe-header-right>
 *         <button.ocbe-copy><span.ocbe-copy-icon></span></button>
 *         <button.ocbe-menu><span.ocbe-menu-icon></span></button>
 *       </div>
 *     </div>
 *     <div.ocbe-body>
 *       <div.ocbe-gutter>1 2 3 ...</div>
 *       <div.ocbe-scroller><pre.ocbe-code><code>...</code></pre></div>
 *     </div>
 *   </div>
 */
export function buildCodeBlockWrapper(opts: BuildCodeBlockOptions): HTMLElement {
    const { source, lang, title, settings, isDark, onCopy } = opts;

    const processedSource = processSource(source);
    const lineCount = processedSource === '' ? 1 : processedSource.split('\n').length;

    /* ---------- 外层 wrapper ---------- */
    const wrapper = activeDocument.createElement('div');
    wrapper.classList.add(CSS_CLASS.wrapper);
    wrapper.classList.add(isDark ? CSS_CLASS.themeDark : CSS_CLASS.themeLight);
    wrapper.dataset.state = settings.defaultFolded ? 'collapsed' : 'expanded';
    wrapper.dataset.scroll = settings.scrollbarMode;
    wrapper.dataset.lang = lang;
    wrapper.dataset.ocbe = '1';

    applyCssVariables(wrapper, settings, isDark);

    /* ---------- 装饰条 header ---------- */
    const header = activeDocument.createElement('div');
    header.classList.add(CSS_CLASS.header);
    wrapper.appendChild(header);

    // 左侧：折叠 + 标题 + 语言
    const headerLeft = activeDocument.createElement('div');
    headerLeft.classList.add(CSS_CLASS.headerLeft);
    header.appendChild(headerLeft);

    const toggle = activeDocument.createElement('button');
    toggle.type = 'button';
    toggle.classList.add(CSS_CLASS.toggle);
    toggle.setAttribute('aria-label', '折叠/展开代码块');
    toggle.setAttribute('title', '折叠/展开');
    toggle.setAttribute('aria-expanded', String(!settings.defaultFolded));
    const toggleIcon = activeDocument.createElement('span');
    toggleIcon.classList.add(CSS_CLASS.toggleIcon);
    toggle.appendChild(toggleIcon);
    headerLeft.appendChild(toggle);

    const titleEl = activeDocument.createElement('span');
    titleEl.classList.add(CSS_CLASS.title);
    const titleText = activeDocument.createElement('span');
    titleText.classList.add(CSS_CLASS.titleText);
    const displayTitle = title || settings.defaultName;
    titleText.textContent = displayTitle;
    titleEl.appendChild(titleText);
    if (title) {
        titleEl.setAttribute('title', title);
    }
    headerLeft.appendChild(titleEl);

    if (settings.showLangLabel && lang) {
        const langEl = activeDocument.createElement('span');
        langEl.classList.add(CSS_CLASS.langLabel);
        langEl.textContent = lang;
        headerLeft.appendChild(langEl);
    }

    // 右侧：复制 + 菜单
    const headerRight = activeDocument.createElement('div');
    headerRight.classList.add(CSS_CLASS.headerRight);
    header.appendChild(headerRight);

    const copyBtn = activeDocument.createElement('button');
    copyBtn.type = 'button';
    copyBtn.classList.add(CSS_CLASS.copy);
    copyBtn.setAttribute('aria-label', '复制代码');
    copyBtn.setAttribute('title', '复制代码');
    const copyIcon = activeDocument.createElement('span');
    copyIcon.classList.add(CSS_CLASS.copyIcon);
    copyIcon.textContent = '复制';
    copyBtn.appendChild(copyIcon);
    headerRight.appendChild(copyBtn);

    const menuBtn = activeDocument.createElement('button');
    menuBtn.type = 'button';
    menuBtn.classList.add(CSS_CLASS.menu);
    menuBtn.setAttribute('aria-label', '更多操作');
    menuBtn.setAttribute('title', '更多操作');
    const menuIcon = activeDocument.createElement('span');
    menuIcon.classList.add(CSS_CLASS.menuIcon);
    menuBtn.appendChild(menuIcon);
    headerRight.appendChild(menuBtn);

    /* ---------- 代码区 body ---------- */
    const body = activeDocument.createElement('div');
    body.classList.add(CSS_CLASS.body);
    wrapper.appendChild(body);

    let gutter: HTMLElement | null = null;
    if (settings.showLineNumbers) {
        gutter = activeDocument.createElement('div');
        gutter.classList.add(CSS_CLASS.gutter);
        body.appendChild(gutter);
    }

    const scroller = activeDocument.createElement('div');
    scroller.classList.add(CSS_CLASS.codeScroller);
    body.appendChild(scroller);

    const pre = activeDocument.createElement('pre');
    pre.classList.add(CSS_CLASS.code);
    const code = activeDocument.createElement('code');
    if (lang) {
        code.classList.add(`language-${lang}`);
    }
    pre.appendChild(code);
    scroller.appendChild(pre);

    // 行号 gutter：根据源码行数生成
    if (gutter) {
        const gutterFrag = activeDocument.createDocumentFragment();
        for (let i = 1; i <= lineCount; i++) {
            const num = activeDocument.createElement('span');
            num.textContent = String(i);
            gutterFrag.appendChild(num);
        }
        gutter.appendChild(gutterFrag);
    }

    // 代码内容：直接使用 Prism 高亮输出，依靠 white-space: pre 渲染换行
    const highlighted = highlightCode(processedSource, lang);
    const template = activeDocument.createElement('template');
    // eslint-disable-next-line no-unsanitized/property, @microsoft/sdl/no-inner-html -- Prism 可信输出，回退路径已 escapeHtml
    template.innerHTML = highlighted;
    code.appendChild(template.content.cloneNode(true));

    /* ---------- 交互 ---------- */
    wireInteractions(wrapper, toggle, copyBtn, menuBtn, processedSource, title, settings, onCopy);

    return wrapper;
}

/** 绑定折叠、复制、选中等交互 */
function wireInteractions(
    wrapper: HTMLElement,
    toggle: HTMLButtonElement,
    copyBtn: HTMLButtonElement,
    menuBtn: HTMLButtonElement,
    source: string,
    title: string,
    settings: OnlyCodeblockSettings,
    onCopy?: () => void,
): void {
    // 折叠/展开
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCollapse(wrapper, toggle);
    });

    // 复制
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        void handleCopy(copyBtn, source, onCopy);
    });

    // 三点菜单
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenu(wrapper, menuBtn, source, title, settings, onCopy);
    });

    // 点击代码区切换"选中"状态（互斥：同一时间只有一个代码块高亮）
    const bodyEl = wrapper.querySelector('.' + CSS_CLASS.body);
    if (bodyEl instanceof HTMLElement) {
        bodyEl.addEventListener('click', (e) => {
            const sel = window.getSelection?.();
            if (sel && sel.toString().length > 0) {
                return;
            }
            // 互斥：先清除其他选中
            clearAllSelected(wrapper);
            wrapper.classList.toggle(CSS_CLASS.selected);
            e.stopPropagation();
        });
    }

    // 点击 wrapper 外部时取消选中
    const docClickHandler = (e: MouseEvent): void => {
        if (!wrapper.contains(e.target as Node)) {
            wrapper.classList.remove(CSS_CLASS.selected);
        }
    };
    activeDocument.addEventListener('click', docClickHandler);
    const cleanup = (): void => {
        activeDocument.removeEventListener('click', docClickHandler);
        wrapper.removeEventListener('DOMNodeRemoved', cleanup);
    };
    wrapper.addEventListener('DOMNodeRemoved', cleanup);
}

/** 切换折叠状态 */
function toggleCollapse(wrapper: HTMLElement, toggle: HTMLButtonElement): void {
    const isCollapsed = wrapper.dataset.state === 'collapsed';
    wrapper.dataset.state = isCollapsed ? 'expanded' : 'collapsed';
    toggle.setAttribute('aria-expanded', String(isCollapsed));
}

/** 清除同一笔记视图内所有代码块的选中状态（互斥高亮） */
function clearAllSelected(currentWrapper: HTMLElement): void {
    // 向上找到最近的阅读视图容器
    const root =
        currentWrapper.closest('.markdown-reading-view') ||
        currentWrapper.closest('.markdown-preview-section') ||
        currentWrapper.closest('.markdown-rendered') ||
        activeDocument;
    const selected = root.querySelectorAll('.' + CSS_CLASS.selected);
    selected.forEach((el) => el.classList.remove(CSS_CLASS.selected));
}

/** 异步复制逻辑：优先使用 Clipboard API，失败时回退到 execCommand */
async function handleCopy(
    copyBtn: HTMLButtonElement,
    source: string,
    onCopy?: () => void,
): Promise<void> {
    let ok = false;
    try {
        await navigator.clipboard.writeText(source);
        ok = true;
    } catch {
        try {
            const ta = activeDocument.createElement('textarea');
            ta.value = source;
            ta.setCssProps({ position: 'fixed', opacity: '0' });
            activeDocument.body.appendChild(ta);
            ta.select();
            // eslint-disable-next-line @typescript-eslint/no-deprecated -- 兼容性回退，仅在 Clipboard API 不可用时触发
            ok = activeDocument.execCommand('copy');
            activeDocument.body.removeChild(ta);
        } catch {
            ok = false;
        }
    }
    if (ok && onCopy) {
        onCopy();
    }
    if (ok) {
        const icon = copyBtn.querySelector('.' + CSS_CLASS.copyIcon);
        if (icon) {
            const original = icon.textContent;
            icon.textContent = '已复制';
            window.setTimeout(() => {
                icon.textContent = original;
            }, 1200);
        }
    }
}

/** 打开三点菜单 */
function openMenu(
    wrapper: HTMLElement,
    menuBtn: HTMLButtonElement,
    source: string,
    title: string,
    settings: OnlyCodeblockSettings,
    onCopy?: () => void,
): void {
    // 已存在则关闭
    const existing = wrapper.querySelector('.' + CSS_CLASS.menuPanel);
    if (existing) {
        existing.remove();
        return;
    }

    const panel = activeDocument.createElement('div');
    panel.classList.add(CSS_CLASS.menuPanel);

    // 全部折叠
    const collapseAll = createMenuItem('全部折叠', () => {
        setAllCollapseState(wrapper, 'collapsed');
        panel.remove();
    });
    panel.appendChild(collapseAll);

    // 全部展开
    const expandAll = createMenuItem('全部展开', () => {
        setAllCollapseState(wrapper, 'expanded');
        panel.remove();
    });
    panel.appendChild(expandAll);

    // 分隔线
    panel.appendChild(createMenuDivider());

    // 在新窗格中打开代码
    const openViewer = createMenuItem('在新窗口中查看', () => {
        showCodeViewerModal(source, title, wrapper.dataset.lang || 'text');
        panel.remove();
    });
    panel.appendChild(openViewer);

    // 导出为文件
    const exportItem = createMenuItem('导出为文件', () => {
        showExportModal(source, title, wrapper.dataset.lang || 'text');
        panel.remove();
    });
    panel.appendChild(exportItem);

    // 分隔线
    panel.appendChild(createMenuDivider());

    // 复制代码（菜单内入口）
    const copyItem = createMenuItem('复制代码', () => {
        void handleCopy(
            menuBtn.parentElement?.querySelector('.' + CSS_CLASS.copy) as HTMLButtonElement,
            source,
            onCopy,
        );
        panel.remove();
    });
    panel.appendChild(copyItem);

    menuBtn.parentElement?.appendChild(panel);

    // 点击外部关闭
    window.setTimeout(() => {
        const closeHandler = (e: MouseEvent): void => {
            if (!panel.contains(e.target as Node) && e.target !== menuBtn) {
                panel.remove();
                activeDocument.removeEventListener('click', closeHandler, true);
            }
        };
        activeDocument.addEventListener('click', closeHandler, true);
    }, 0);
}

/** 创建菜单项 */
function createMenuItem(label: string, onClick: () => void): HTMLElement {
    const item = activeDocument.createElement('button');
    item.type = 'button';
    item.classList.add(CSS_CLASS.menuItem);
    item.textContent = label;
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
    });
    return item;
}

/** 创建菜单分隔线 */
function createMenuDivider(): HTMLElement {
    const divider = activeDocument.createElement('div');
    divider.classList.add('ocbe-menu-divider');
    return divider;
}

/** 设置当前笔记内所有代码块的折叠状态 */
function setAllCollapseState(
    currentWrapper: HTMLElement,
    state: 'expanded' | 'collapsed',
): void {
    const root =
        currentWrapper.closest('.markdown-reading-view') ||
        currentWrapper.closest('.markdown-preview-section') ||
        currentWrapper.closest('.markdown-rendered') ||
        activeDocument;
    const wrappers = root.querySelectorAll('.' + CSS_CLASS.wrapper);
    wrappers.forEach((w) => {
        const el = w as HTMLElement;
        el.dataset.state = state;
        const t = el.querySelector('.' + CSS_CLASS.toggle);
        if (t) {
            t.setAttribute('aria-expanded', String(state === 'expanded'));
        }
    });
}
