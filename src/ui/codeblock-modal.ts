/**
 * 创建/编辑代码块模态框
 *
 * 用于编辑模式下辅助创建代码块。提交后通过回调将
 * {名称, 语言, 内容} 传给调用方（通常由命令负责写入 markdown 源码）。
 */

import { App, Modal, Setting } from 'obsidian';
import type { ButtonComponent } from 'obsidian';

export interface CodeBlockModalResult {
    name: string;
    lang: string;
    content: string;
}

export interface CodeBlockModalOptions {
    /** 模态框标题 */
    title?: string;
    /** 初始名称 */
    initialName?: string;
    /** 初始语言 */
    initialLang?: string;
    /** 初始内容 */
    initialContent?: string;
    /** 可选语言列表（按顺序显示） */
    languageList: string[];
    /** 提交回调 */
    onSubmit: (result: CodeBlockModalResult) => void;
    /** 取消回调（可选） */
    onCancel?: () => void;
}

export class CodeBlockModal extends Modal {
    private readonly opts: CodeBlockModalOptions;
    private name = '';
    private lang = '';
    private content = '';

    constructor(app: App, opts: CodeBlockModalOptions) {
        super(app);
        this.opts = opts;
        this.name = opts.initialName ?? '';
        const fallbackLang = opts.languageList[0] ?? 'text';
        this.lang = opts.initialLang ?? fallbackLang;
        this.content = opts.initialContent ?? '';
    }

    onOpen(): void {
        const { contentEl, titleEl } = this;
        titleEl.setText(this.opts.title ?? '创建代码块');
        contentEl.empty();
        contentEl.addClass('ocbe-modal');

        // 名称
        new Setting(contentEl)
            .setName('代码块名称')
            .setDesc('可选。留空则使用设置中的默认名称。')
            .addText((text) => {
                text
                    .setPlaceholder('请输入代码块名称')
                    .setValue(this.name)
                    .onChange((value) => {
                        this.name = value;
                    });
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.contentTextarea?.focus();
                    }
                });
            });

        // 语言
        const langSetting = new Setting(contentEl)
            .setName('代码块类型')
            .setDesc('选择代码语言。');
        langSetting.addDropdown((drop) => {
            for (const l of this.opts.languageList) {
                drop.addOption(l, l);
            }
            // 若初始语言不在列表中，追加一项
            if (this.lang && !this.opts.languageList.includes(this.lang)) {
                drop.addOption(this.lang, this.lang + ' (自定义)');
            }
            drop.setValue(this.lang).onChange((value) => {
                this.lang = value;
            });
        });
        // 也允许自由输入（覆盖下拉）
        langSetting.addText((text) => {
            text
                .setPlaceholder('或自定义语言')
                .setValue(this.lang && !this.opts.languageList.includes(this.lang) ? this.lang : '')
                .onChange((value) => {
                    const v = value.trim().toLowerCase();
                    if (v) {
                        this.lang = v;
                    }
                });
        });

        // 内容
        const contentSetting = new Setting(contentEl).setName('代码内容');
        contentSetting.controlEl.empty();
        const textarea = activeDocument.createElement('textarea');
        textarea.className = 'ocbe-modal-textarea';
        textarea.placeholder = '请输入代码内容';
        textarea.value = this.content;
        textarea.rows = 12;
        textarea.spellcheck = false;
        contentSetting.controlEl.appendChild(textarea);
        this.contentTextarea = textarea;

        textarea.addEventListener('input', () => {
            this.content = textarea.value;
        });

        // Tab 键插入 4 个空格而非切焦点
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const insert = '    ';
                textarea.value =
                    textarea.value.slice(0, start) +
                    insert +
                    textarea.value.slice(end);
                textarea.selectionStart = textarea.selectionEnd =
                    start + insert.length;
                this.content = textarea.value;
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.submit();
            }
        });

        // 按钮
        const actionSetting = new Setting(contentEl);
        actionSetting.controlEl.addClass('ocbe-modal-actions');
        actionSetting.addButton((btn: ButtonComponent) => {
            btn.setButtonText('取消').onClick(() => {
                this.close();
            });
        });
        actionSetting.addButton((btn: ButtonComponent) => {
            btn.setButtonText('插入')
                .setCta()
                .onClick(() => {
                    this.submit();
                });
        });
    }

    private contentTextarea: HTMLTextAreaElement | null = null;

    private submit(): void {
        const result: CodeBlockModalResult = {
            name: this.name.trim(),
            lang: (this.lang || 'text').trim().toLowerCase(),
            content: this.content,
        };
        this.opts.onSubmit(result);
        this.close();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
        if (this.opts.onCancel) {
            this.opts.onCancel();
        }
    }
}
