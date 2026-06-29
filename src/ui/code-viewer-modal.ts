/**
 * 代码全屏查看模态框
 *
 * 从代码块三点菜单触发，弹出大窗口展示代码内容，便于长代码阅读。
 * 支持语法高亮（复用 Prism）与一键复制。
 */

import { App, Modal, Notice } from 'obsidian';

/**
 * 显示代码查看模态框。
 * @param source 代码原文
 * @param title 代码块名称（作为模态框标题）
 * @param lang 语言标识
 */
export function showCodeViewerModal(
    source: string,
    title: string,
    lang: string,
): void {
    new CodeViewerModal(appFromWindow(), source, title, lang).open();
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

    constructor(app: App, source: string, title: string, lang: string) {
        super(app);
        this.source = source;
        this.title = title || '代码预览';
        this.lang = lang || 'text';
    }

    onOpen(): void {
        const { contentEl, titleEl } = this;
        titleEl.setText(this.title);
        contentEl.empty();
        contentEl.addClass('ocbe-viewer-modal');

        // 工具栏
        const toolbar = contentEl.createDiv({ cls: 'ocbe-viewer-toolbar' });
        const langTag = toolbar.createSpan({ cls: 'ocbe-viewer-lang' });
        langTag.textContent = this.lang;
        const copyBtn = toolbar.createEl('button', { cls: 'ocbe-viewer-copy' });
        copyBtn.type = 'button';
        copyBtn.textContent = '复制';

        // 代码区
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
        try {
            await navigator.clipboard.writeText(this.source);
            const original = copyBtn.textContent;
            copyBtn.textContent = '已复制';
            window.setTimeout(() => {
                copyBtn.textContent = original;
            }, 1200);
        } catch {
            new Notice('复制失败');
        }
    }
}
