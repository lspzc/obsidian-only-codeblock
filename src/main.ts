/**
 * Only Codeblock 插件入口
 *
 * 职责：
 * - 加载/保存设置
 * - 注册设置页签
 * - 注册阅读视图 MarkdownPostProcessor
 * - 注册编辑模式命令
 * - 添加侧边栏 ribbon 按钮（新增/编辑，可独立开关）
 * - 监听 Obsidian 主题切换，重新渲染阅读视图
 * - 暴露 rerenderReadingView 供设置页实时生效调用
 */

import { MarkdownView, Notice, Plugin } from 'obsidian';
import {
	openEditCurrentCodeBlockModal,
	openInsertCodeBlockModal,
	registerInsertCodeBlockCommands,
} from './commands/insert-codeblock';
import { DEFAULT_SETTINGS } from './constants';
import { applyCssVariables } from './reader/codeblock-builder';
import { registerCodeBlockPostProcessor } from './reader/post-processor';
import { OnlyCodeblockSettingTab } from './settings';
import type { OnlyCodeblockSettings } from './types';
import { CODE_VIEWER_VIEW_TYPE, CodeViewerView } from './ui/code-viewer-view';

export default class OnlyCodeblock extends Plugin {
	settings!: OnlyCodeblockSettings;
	private themeObserver: MutationObserver | null = null;
	private addRibbonEl: HTMLElement | null = null;
	private editRibbonEl: HTMLElement | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		// 设置页签
		this.addSettingTab(new OnlyCodeblockSettingTab(this.app, this));

		// 注册代码查看页签视图
		this.registerView(CODE_VIEWER_VIEW_TYPE, (leaf) => new CodeViewerView(leaf, this.settings));

		// 阅读视图代码块后处理器
		registerCodeBlockPostProcessor(this);

		// 编辑模式命令
		registerInsertCodeBlockCommands(this);

		// 侧边栏按钮（根据设置添加）
		this.refreshRibbonButtons();

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
		// 更新已存在代码块的 CSS 变量（保留选中状态，避免边框消失）
		this.updateWrappersCssVars();
		// 侧边栏按钮可能变化，重新刷新
		this.refreshRibbonButtons();
	}

	/**
	 * 更新所有已存在代码块的 CSS 变量。
	 * 仅更新内联 CSS 变量，不重建 DOM，因此选中状态（.ocbe-selected）得以保留。
	 * 适用于颜色、粗细、字号、高度等通过 CSS 变量控制的设置变更。
	 */
	updateWrappersCssVars(): void {
		const isDark = activeDocument.body.classList.contains('theme-dark');
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				const wrappers = view.contentEl.querySelectorAll<HTMLElement>('.ocbe-wrapper');
				wrappers.forEach((wrapper) => {
					applyCssVariables(wrapper, this.settings, isDark);
				});
			}
		});
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

	/** 根据当前设置刷新侧边栏按钮 */
	refreshRibbonButtons(): void {
		// 移除旧的
		this.addRibbonEl?.remove();
		this.addRibbonEl = null;
		this.editRibbonEl?.remove();
		this.editRibbonEl = null;

		// 添加"新增代码块"按钮
		if (this.settings.showAddRibbon) {
			this.addRibbonEl = this.addRibbonIcon('code', '插入代码块', () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view || !view.editor) {
					new Notice('请在编辑模式下使用此功能');
					return;
				}
				openInsertCodeBlockModal(this, view.editor);
			});
		}

		// 添加"编辑代码块"按钮
		if (this.settings.showEditRibbon) {
			this.editRibbonEl = this.addRibbonIcon('pencil', '编辑当前代码块', () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view || !view.editor) {
					new Notice('请在编辑模式下使用此功能');
					return;
				}
				openEditCurrentCodeBlockModal(this, view.editor);
			});
		}
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
