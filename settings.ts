import { App, PluginSettingTab, Setting } from 'obsidian';
import PdfAnchor from 'main'

export interface PdfAnchorSettings {
	maxHeadingDepth: number; 
	generateOutline: boolean;
	advancedMode: boolean;
}

export const DEFAULT_SETTINGS: PdfAnchorSettings = {
	maxHeadingDepth: 3,
	generateOutline: true,
	advancedMode : false
}

export class PdfAnchorSettingTab extends PluginSettingTab {
	plugin: PdfAnchor;

	constructor(app: App, plugin: PdfAnchor) {
		super(app, plugin);
		this.plugin = plugin;
	}

	reloadPlugin():void {
		// @ts-ignore
		this.app.plugins.disablePlugin( this.plugin.manifest.id );
		// @ts-ignore
		this.app.plugins.enablePlugin( this.plugin.manifest.id );
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName( 'Generate document outline' )
			.setDesc( 'Generates an outline view while post-processing a saved PDF file' )
			.addToggle( val => val
				.setValue( this.plugin.settings.generateOutline )
				.onChange(async (value) => {
					this.plugin.settings.generateOutline = value;
					await this.plugin.saveSettings();
				}
			)
		);

		new Setting(containerEl)
			.setName( 'Advanced mode' )
			.setDesc( 'Enables commands for subsections of the export and conversion process' )
			.addToggle( val => val
				.setValue( this.plugin.settings.advancedMode )
				.onChange(async (value) => {
					this.plugin.settings.advancedMode = value;
					await this.plugin.saveSettings();
					//this.reloadPlugin();
				}
			)
		);

		new Setting(containerEl)
			.setName( 'Maximum header depth' )
			.setDesc( 'Headings deeper than this level will not be included in a generated outline view' )
			.addSlider( val => val 
				.setValue( this.plugin.settings.maxHeadingDepth )
				.setDynamicTooltip()
				.setLimits(1,6,1)
				.onChange(async (value) => {
					this.plugin.settings.maxHeadingDepth = value;
					await this.plugin.saveSettings();
				}
			)
		);
	}
}
