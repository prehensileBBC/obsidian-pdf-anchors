import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { PDFDocument, PDFDict, asPDFName, PDFString } from 'pdf-lib'

// Electron provides file paths
interface ElectronFile extends File {
	path: string
}

// Remember to rename these classes and interfaces!

interface PdfAnchorSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: PdfAnchorSettings = {
	mySetting: 'default'
}

export default class PdfAnchor extends Plugin {
	settings: PdfAnchorSettings;

	async onload() {
		await this.loadSettings();
		
		this.addCommand({
			id: 'convert-internal-links-to-dummies',
			name: 'Convert all internal links to dummies',
			callback: () => this.convertAllInternalLinksToDummiesCommand()
		});

		this.addCommand({
			id: 'convert-dummies-to-anchors',
			name: 'Convert dummies to anchors',
			callback: () => this.convertDummiesToAnchorsCommand()
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		this.registerDomEvent(window, 'beforeprint', (evt: Event) => {
			console.log('beforeprint', evt);
			console.log( JSON.stringify(evt) );
		});

		this.registerDomEvent(window, 'afterprint', (evt: Event) => {
			console.log('afterprint', evt);
			console.log( JSON.stringify(evt) );
		});

		var t = window.require("electron").ipcRenderer;
		t.on( "print-to-pdf", (evt:Event,b:any) => {
			// debugger;
			console.log( b );
			console.log('print-to-pdf', evt);
			console.log( evt );
			console.log( JSON.stringify(evt) );
			//console.log( evt.emitter.send("print-to-pdf", {}) )
		})

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async reportError( message:string ){
		console.log( message );
		new Notice( message );
	}

	async openFileDialog( cb:Function ) {
		let input = document.createElement('input');
		input.type = 'file';
		input.onchange = _ => {
		  // you can use this method to get file and perform respective operations
				  // let files = Array.from(input.files);
				  // console.log( input.files );
				  cb( input.files );
			  };
		input.click();
	}

	async convertDummiesToAnchorsCommand() {
		// I hate javascript
		this.openFileDialog( (files:FileList) => {
			this.getContentsOfFile( files[0], (fileBuffer:ArrayBuffer) =>{
				this.convertDummiesToAnchors( fileBuffer );
			})
		} );
	}

	async getContentsOfFile( file:File, cb:Function ) {
		
		const reader = new FileReader()
		
		let fileResult: any
		
		reader.onload = () => {
			fileResult = reader.result
			cb( fileResult );
		}
		
		// reader.onerror = (error) => {
		// 	reject(error)
		// }
		// reader.onloadend = () => {
		// 	resolve(fileResult)
		// }
		reader.readAsArrayBuffer( file );
	}

	async convertDummiesToAnchors( pdfBuffer:ArrayBuffer ) {
		
		// debugger;
		const pdfDoc = await PDFDocument.load( pdfBuffer );
		const pages = pdfDoc.getPages();
		pages.forEach((p) => {
			p.node
			.Annots()
			?.asArray()
			.forEach((a) => {
				const dict = pdfDoc.context.lookupMaybe(a, PDFDict);
				const aRecord = dict?.get(asPDFName(`A`));
				const link = pdfDoc.context.lookupMaybe(aRecord, PDFDict);
				const uri = link?.get( asPDFName("URI") )?.toString();//.slice(1, -1); // get the original link, remove parenthesis
				console.log( uri );
				// if (uri.startsWith("http"))
				// 	link!.set(asPDFName("URI"), PDFString.of( /*Wathever value*/ )); // update link value
			});
		});
	}

	async convertAllInternalLinksToDummiesCommand() {
		const currentFile = this.app.workspace.getActiveFile();
		if( !currentFile ) this.reportError( "Couldn't get active file" );
		this.convertAllInternalLinksToDummies( currentFile! );
	}

	async convertAllInternalLinksToDummies( noteFile : TFile ) {
		
		/* based heavliy on https://github.com/dy-sh/obsidian-consistent-attachments-and-links */

		const links = this.app.metadataCache.getCache( noteFile.path )?.links;
		let noteText = await this.app.vault.read( noteFile );
		
		if (links) {
			for (let link of links) {

				// we're only interested in links to headings in the current note 
				if( !link.original.startsWith("[[#") )
					continue

				console.log( link );

				let anchor = encodeURI(link.link);
				let dummyLink = `http://uk.co.prehensile.dummy/dummy${anchor}`;
				console.log( dummyLink );

				let dummyMarkdown = `[${link.displayText}](${dummyLink})`;

				// rewrite link to an external dummy link
				noteText = noteText.replace( link.original, dummyMarkdown );
			}
		}

		// write noteText back to original file
		await this.app.vault.modify( noteFile, noteText );
	}
}


class SampleSettingTab extends PluginSettingTab {
	plugin: PdfAnchor;

	constructor(app: App, plugin: PdfAnchor) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
