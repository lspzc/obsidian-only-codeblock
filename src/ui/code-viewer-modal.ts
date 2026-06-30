/**
 * 代码全屏查看模态框
 *
 * 从代码块三点菜单触发，弹出大窗口展示代码内容，便于长代码阅读。
 * 支持语法高亮（复用 Prism）与一键复制。
 * 最大宽高可由用户设置控制；代码区可鼠标拖选复制。
 */

import { App, Modal, Notice } from 'obsidian';
import type { OnlyCodeblockSettings } from '../types';

/**
 * 显示代码查看模态框。
 * @param source 代码原文
 * @param title 代码块名称（作为模态框标题）
 * @param lang 语言标识
 * @param settings 插件设置（使用 viewerMaxWidth/viewerMaxHeight）
 */
export function showCodeViewerModal(
    source: string,
    title: string,
    lang: string,
    settings: OnlyCodeblockSettings,
): void {
    new CodeViewerModal(appFromWindow(), source, title, lang, settings).open();
}

/** 从全局获取 App 实例（菜单触发时无 App 引用） */
function appFromWindow(): App {
    const w = window as unknown as { app: App };
    return w.app;
}

class CodeViewerModal extends Modal {
    private readonly source: string;
    private readonly title: string;
    private readonly lang: string;
    private readonly settings: OnlyCodeblockSettings;

    constructor(
        app: App,
        source: string,
        title: string,
        lang: string,
        settings: OnlyCodeblockSettings,
    ) {
        super(app);
        this.source = source;
        this.title = title || '代码预览';
        this.lang = lang || 'text';
        this.settings = settings;
    }

    onOpen(): void {
        const { contentEl, titleEl, modalEl } = this;
        titleEl.setText(this.title);
        contentEl.empty();
        contentEl.addClass('ocbe-viewer-modal');
        modalEl.addClass('ocbe-viewer-modal');

        // 应用最大宽高设置（直接设置 style 属性，而非 CSS 变量）
        const maxW = this.settings.viewerMaxWidth;
        const maxH = this.settings.viewerMaxHeight;
        if (maxW > 0) {
            modalEl.style.setProperty('max-width', `${maxW}px`);
        }
        if (maxH > 0) {
            modalEl.style.setProperty('max-height', `${maxH}px`);
        }

        // 工具栏
        const toolbar = contentEl.createDiv({ cls: 'ocbe-viewer-toolbar' });
        const langTag = toolbar.createSpan({ cls: 'ocbe-viewer-lang' });
        langTag.textContent = this.lang;
        const copyBtn = toolbar.createEl('button', { cls: 'ocbe-viewer-copy' });
        copyBtn.type = 'button';
        copyBtn.textContent = this.settings.copyButtonText || '复制';

        // 代码区：可鼠标选择复制（user-select: text 由 CSS 保证）
        const scroller = contentEl.createDiv({ cls: 'ocbe-viewer-scroller' });
        const pre = scroller.createEl('pre', { cls: 'ocbe-viewer-code' });
        const code = pre.createEl('code');
        if (this.lang) {
            code.classList.add(`language-${this.lang}`);
        }
        // 尝试 Prism 高亮
        const prism = (
            window as unknown as {
                Prism?: {
                    languages: Record<string, unknown>;
                    highlight: (code: string, grammar: unknown, lang: string) => string;
                };
            }
        ).Prism;
        if (prism && typeof prism.highlight === 'function') {
            const grammar = prism.languages[this.lang] ?? prism.languages.clike;
            if (grammar) {
                try {
                    const template = activeDocument.createElement('template');
                    // eslint-disable-next-line no-unsanitized/property, @microsoft/sdl/no-inner-html -- Prism 可信输出
                    template.innerHTML = prism.highlight(this.source, grammar, this.lang);
                    code.appendChild(template.content.cloneNode(true));
                } catch {
                    code.textContent = this.source;
                }
            } else {
                code.textContent = this.source;
            }
        } else {
            code.textContent = this.source;
        }

        // 复制按钮
        copyBtn.addEventListener('click', () => {
            void this.handleCopy(copyBtn);
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private async handleCopy(copyBtn: HTMLButtonElement): Promise<void> {
        let ok = false;
        try {
            await navigator.clipboard.writeText(this.source);
            ok = true;
        } catch {
            ok = false;
        }
        if (ok) {
            const original = copyBtn.textContent;
            copyBtn.textContent = this.settings.copySuccessText || '已复制';
            copyBtn.dataset.copied = '1';
            if (this.settings.showCopyNotice) {
                new Notice('已复制代码');
            }
            window.setTimeout(() => {
                copyBtn.textContent = original;
                delete copyBtn.dataset.copied;
            }, 1200);
        } else {
            new Notice('复制失败');
        }
    }
}
