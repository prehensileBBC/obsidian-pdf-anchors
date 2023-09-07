import { readFileSync, writeFileSync } from 'fs';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, loadPdfJs } from 'obsidian';
import { PDFDocument, PDFDict, asPDFName, PDFString, PDFPage, PDFPageTree, PDFArray, PDFNull } from 'pdf-lib'
import { outlinePdfFactory } from '@lillallol/outline-pdf';
import { outlinePdfDataStructure } from '@lillallol/outline-pdf-data-structure';

import * as pdfLib from "pdf-lib";
const outlinePdf = outlinePdfFactory(pdfLib);

// Electron provides file paths
interface ElectronFile extends File {
	path: string
}

interface PdfBlockItem {
	text : string,
	pageNumber : number,
	height : number
}

// Remember to rename these classes and interfaces!

interface PdfAnchorSettings {
	mySetting: string;
	maxHeadingDepth: number 
}

const DEFAULT_SETTINGS: PdfAnchorSettings = {
	mySetting: 'default',
	maxHeadingDepth: 3
}

export default class PdfAnchor extends Plugin {
	
	settings: PdfAnchorSettings;

	readonly _dummyBaseUrl = "http://dummy.link/dummy";

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

		/*
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
		*/
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
		// see https://forum.obsidian.md/t/file-open-dialog/47325
		let input = document.createElement('input');
		input.type = 'file';
		input.onchange = _ => {
			cb( input.files );
		};
		input.click();
	}

	async convertDummiesToAnchorsCommand() {
		this.openFileDialog( (files:FileList) => {
			this.convertDummiesToAnchors(
				(files[0] as ElectronFile).path );
		});
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
	
	/*
	async getOutlineForPdfBuffer( pdfBuffer:ArrayBuffer ) {
		const pdfjsLib = await loadPdfJs();
		const pdf = await pdfjsLib.getDocument( pdfBuffer ).promise;
		
		console.log( pdf.numPages );

		// TODO: make this a proper typed array
		// TODO: actually, it should be a proper tree structure
		let titles = [];

		for (let j = 1; j <= pdf.numPages; j++) {
            const page = await pdf.getPage(j);
            const textContent = await page.getTextContent();

			for (let i = 0; i < textContent.items.length; i++) {
                const item = textContent.items[i];
				// TODO: map item height to heading depth more intelligently
				if( item.height > 12 ) {
					const o : PdfBlockItem = {
						display : item.str,
						height : item.height,
						item: item,
						pageNumber : Number(j) // copy it to avoid it being a reference to a changing value
					}
					titles.push( o );
				}
			}
		}

		return titles;
		
	}*/

	constructOutlineFromTitles( titles:any ){

	}

	async getpdfBlockItemsForPdfJsDocument( pdf:any ):Promise<[Array<PdfBlockItem>, Number, Number, Set<Number>]>{
		
		let pdfBlockItems = [];

		let minHeight = Number.MAX_VALUE;
		let maxHeight = 0; 
		let heights:Set<Number> = new Set();

		for (let j = 1; j <= pdf.numPages; j++) {
			const page = await pdf.getPage(j);
            const textContent = await page.getTextContent();
			let textBuffer = "";
			let prevItem = null;
			for (let i = 0; i < textContent.items.length; i++) {
				const item = textContent.items[i];

				/*
				if( prevItem == null ){
					//noop
				} else if( item.height == prevItem.height ){
					// let's assume that this is text of the same lineheight running into a multiline block
					textBuffer += item.str;
				} else if( item.height != prevItem.height ){
					// we've run across a line item with a different lineheight, assume we're running into a different block
					// so commit the buffer & previous item
					if( textBuffer.length > 1){
						debugger;
						const h = prevItem.height;
						const o : PdfBlockItem = {
							text : textBuffer,
							height : h,
							pageNumber : Number(j) // copy it to avoid it being a reference to a changing value
						}
						maxHeight = Math.max( maxHeight, h );
						minHeight = Math.min( minHeight, h );
						heights.add( h );
						pdfBlockItems.push( o );
					}
					textBuffer = "";
				}*/

				const h = item.height;
				const t = item.str;
				if( t.length > 0  && h > 0 ){
					const o : PdfBlockItem = {
						text : t,
						height : h,
						pageNumber : Number(j) // copy it to avoid it being a reference to a changing value
					}
					maxHeight = Math.max( maxHeight, h );
					minHeight = Math.min( minHeight, h );
					heights.add( h );
					pdfBlockItems.push( o );
				}
				prevItem = item;
			}
		}
		return [pdfBlockItems,minHeight,maxHeight,heights];
	}

	async getOutlineForPdfBuffer( pdfBuffer:ArrayBuffer ):Promise<[any,string]> {
		
		const pdfjsLib = await loadPdfJs();
		const pdf = await pdfjsLib.getDocument( pdfBuffer ).promise;
	
		let [pdfBlockItems,minHeight,maxHeight,heights] = await this.getpdfBlockItemsForPdfJsDocument( pdf );
		var sortedHeights = Array.from( heights.values() ).sort((n1:number,n2:number) => n2 - n1);

		// construct a string in the format that outline-pdf expects
		let strOutline = "";
		let numItems = 0;
		let indentLevel = 0;
		let previousHeadingDepth = 0;
		for( let i=0; i<pdfBlockItems.length; i++ ){
			const pdfBlockItem = pdfBlockItems[i];
			const headingDepth = sortedHeights.indexOf( pdfBlockItem.height );
			if( (headingDepth>=0) && (headingDepth < this.settings.maxHeadingDepth) ){
				if( headingDepth > previousHeadingDepth ) indentLevel++;
				else if( headingDepth < previousHeadingDepth ) indentLevel--;
				indentLevel = Math.max( 0, indentLevel );
				const indent = "-".repeat( indentLevel );
				strOutline += `${pdfBlockItem.pageNumber}|${indent}|${pdfBlockItem.text}\n`;
				previousHeadingDepth = headingDepth;
			}
		}
		
		return [outlinePdfDataStructure( strOutline, pdf.numPages ), strOutline];
	}


	anchorReferenceForDummyUri( dummyUri: string ) {
		// example dummy uri: http://uk.co.prehensile.dummy/dummy#A%20divided%20world
		return decodeURI( new URL( dummyUri ).hash );
	}

	pageNumberForAnchorReference( anchorRef: string, titles: any ){

		//TODO: map anchor references to page numbers more intelligently

		let path = anchorRef.split( "#" );
		let leaf = path[ path.length-1 ];
		
		for( let i=0; i<titles.length; i++){
			let o:PdfBlockItem = titles[i];
			if( leaf == o.text ){
				return o.pageNumber;
			}
		}
		return -1;
	}

	pageNumberForAnchorReferenceAndOutline( anchorRef: string, outline: any ){
		let path = anchorRef.split( "#" );
		let leaf = path[ path.length-1 ];

		// console.log( outline );
		// debugger;
		
		//TODO: map anchor references to outlineItems more intelligently
		// 	e.g match the whole path, not just the leaf

		for( let outlineItem of outline.outlineItems ){
			if( leaf == outlineItem.Title ){
				return outlineItem.Dest
			}
		}

		// TODO: fallback to partial matches

		return -1;
	}

	async convertDummiesToAnchors( pdfPath:string ) {
		
		console.log( pdfPath );
		// debugger;

		let pdfFile = readFileSync( pdfPath );
		let pdfBuffer = pdfFile.buffer;

		let [outline,strOutline] = await this.getOutlineForPdfBuffer( pdfBuffer.slice(0) );
		// debugger;

		const pdfDoc = await PDFDocument.load( pdfBuffer );
		const pages = pdfDoc.getPages();

		let rewriteCount = 0;

		pages.forEach((p) => {
			p.node
			.Annots()
			?.asArray()
			.forEach((annot) => {

				const dctAnnot = pdfDoc.context.lookupMaybe( annot, PDFDict );

				//console.log( dctAnnot );
				
				const dctAction = dctAnnot?.get( asPDFName(`A`) );

				const link = pdfDoc.context.lookupMaybe( dctAction, PDFDict );
				
				const uri = link?.get( asPDFName("URI") )?.toString().slice(1, -1); // get the original link, remove parenthesis
				
				let newAction = null;

				if( uri?.startsWith(this._dummyBaseUrl) ){

					let anchor = this.anchorReferenceForDummyUri( uri );
					let pageNumber = this.pageNumberForAnchorReferenceAndOutline( anchor, outline );
					console.log( `Page number ${pageNumber} found for anchor ${anchor}` );
					
					// skip links we can't find a page number for
					if( pageNumber < 1 ) return;

					// link!.set(
					// 	asPDFName("URI"),
					// 	PDFString.of( /*Wathever value*/ )
					// );

					// construct page link
					// using info from https://github.com/Hopding/pdf-lib/issues/123
					
					// TODO: link to the correct page, don't reset zoom.
					// 	should be possible with XYZ, but I can't quite work it out
					// 	reference: https://opensource.adobe.com/dc-acrobat-sdk-docs/library/pdfmark/pdfmark_Actions.html
					newAction = pdfDoc.context.obj([
						pages[pageNumber].ref,
						'Fit'
					]);

					// newAction = pdfDoc.context.obj([
					// 	pages[pageNumber-1].ref,
					// 	'XYZ',
					// 	null,
					// 	0,
					// 	null
					// ]);

					// link!.set(
					// 	asPDFName( "Dest" ),
					// 	pdfDoc.context.obj([
					// 		pages[pageNumber].ref,
					// 		'XYZ',
					// 		null,
					// 		null,
					// 		null
					// 	])
						// PDFArray.fromArray(
						// [
						//   pages[pageNumber].ref,
						//   asPDFName('XYZ'),
						//   PDFNull.instance,
						//   PDFNull.instance,
						//   PDFNull.instance,
						// ]
					  //)

					  // console.log( link );
				}
				
				if( newAction != null ){
					// remove 'A' dict from annotation and add a 'Dest'
					dctAnnot?.delete( asPDFName(`A`) );
					dctAnnot?.set(
						asPDFName( "Dest" ),
						newAction
					)
					rewriteCount++;
				}

				// if (uri.startsWith("http"))
				// 	link!.set(asPDFName("URI"), PDFString.of( /*Wathever value*/ )); // update link value
			});
		});

		if( rewriteCount > 0 ) {
			// writeFileSync( pdfPath, await pdfDoc.save() );
			
			// get a copy of the pdf document containing an outline
			const outlinedPdf = await outlinePdf({ outline:strOutline, pdf:pdfDoc }).then((pdfDocument) => pdfDocument.save());
        	writeFileSync( pdfPath, outlinedPdf );
		}

		new Notice( `Rewrote ${rewriteCount} links in file ${pdfPath}` );
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
				let dummyLink = `${this._dummyBaseUrl}${anchor}`;
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
