/**
 * Only Codeblock 插件入口
 *
 * 职责：
 * - 加载/保存设置
 * - 注册设置页签
 * - 注册阅读视图 MarkdownPostProcessor
 * - 注册编辑模式命令
 * - 添加侧边栏 ribbon 按钮（触发插入命令）
 * - 监听 Obsidian 主题切换，重新渲染阅读视图
 * - 暴露 rerenderReadingView 供设置页实时生效调用
 */

import { MarkdownView, Notice, Plugin } from 'obsidian';
import {
    openInsertCodeBlockModal,
    registerInsertCodeBlockCommands,
} from './commands/insert-codeblock';
import { DEFAULT_SETTINGS } from './constants';
import { registerCodeBlockPostProcessor } from './reader/post-processor';
import { OnlyCodeblockSettingTab } from './settings';
import type { OnlyCodeblockSettings } from './types';

export default class OnlyCodeblock extends Plugin {
	settings!: OnlyCodeblockSettings;
	private themeObserver: MutationObserver | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		// 设置页签
		this.addSettingTab(new OnlyCodeblockSettingTab(this.app, this));

		// 阅读视图代码块后处理器
		registerCodeBlockPostProcessor(this);

		// 编辑模式命令
		registerInsertCodeBlockCommands(this);

		// 侧边栏按钮：直接调用插入逻辑（避免依赖未公开的 executeCommandById）
		this.addRibbonIcon('code', '插入代码块', () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view || !view.editor) {
				new Notice('请在编辑模式下使用此功能');
				return;
			}
			openInsertCodeBlockModal(this, view.editor);
		});

		// 监听 Obsidian 主题切换（body class 变化），重新渲染阅读视图
		this.registerThemeObserver();
	}

	onunload(): void {
		if (this.themeObserver) {
			this.themeObserver.disconnect();
			this.themeObserver = null;
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<OnlyCodeblockSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// 设置变更后实时重新渲染阅读视图
		this.rerenderReadingView();
	}

	/** 重新渲染所有 Markdown 阅读视图，使设置变更实时生效 */
	rerenderReadingView(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				// previewMode.rerender(true) 强制完全重新渲染
				const previewMode = (
					view as unknown as {
						previewMode?: { rerender: (full?: boolean) => void };
					}
				).previewMode;
				if (previewMode && typeof previewMode.rerender === 'function') {
					previewMode.rerender(true);
				}
			}
		});
	}

	/** 监听 body class 变化以检测主题切换 */
	private registerThemeObserver(): void {
		this.themeObserver = new MutationObserver(() => {
			this.rerenderReadingView();
		});
		this.themeObserver.observe(activeDocument.body, {
			attributes: true,
			attributeFilter: ['class'],
		});
	}
}
