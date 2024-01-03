import { readFileSync, writeFileSync } from 'fs';

import { App, MarkdownFileInfo, Modal, Notice, Plugin, TFile, loadPdfJs, Editor, MarkdownView, WorkspaceLeaf, LinkCache } from 'obsidian';

import { PDFDocument, PDFDict, PDFPage, asPDFName } from 'pdf-lib'

import { outlinePdfFactory } from '@lillallol/outline-pdf';
import { outlinePdfDataStructure } from '@lillallol/outline-pdf-data-structure';

import {walk, Break} from 'walkjs';

import { PdfAnchorSettings, PdfAnchorSettingTab, DEFAULT_SETTINGS } from 'settings'
import { PdfProcessingModal, PdfSelectModal } from 'ui';

import * as strings from 'strings.json';

import * as pdfLib from "pdf-lib";
import * as path from 'path';
const outlinePdf = outlinePdfFactory(pdfLib);


// Electron provides file paths, declare that here so we can use it
interface ElectronFile extends File {
	path: string
}

interface PdfBlockItem {
	text : string,
	pageNumber : number,
	height : number
}

// MarkdownViews have an undocumented printToPdf function, declare it here so we can use it
interface PrintableMarkdownView extends MarkdownView {
	printToPdf: Function
}



export default class PdfAnchor extends Plugin {
	
	settings: PdfAnchorSettings;

	readonly _dummyBaseUrl = strings.DummyBaseURL;
	private _currentModal:Modal;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'full-export',
			name: strings.CommandPDFExport,
			editorCallback: ( editor: Editor, view: MarkdownView ) => {
				this.fullExportCommand( editor, view );
			},
		});

		if( this.settings.advancedMode ){
			this.addCommand({
				id: 'convert-internal-links-to-dummies',
				name: strings.CommandAdvancedToDummies,
				editorCallback: ( editor: Editor, view: MarkdownView ) => {
					this.convertAllInternalLinksToDummies( view.file! )
				},
			});
			this.addCommand({
				id: 'convert-dummies-to-anchors',
				name: strings.CommandAdvancedFromDummies,
				callback: () => this.convertDummiesToAnchorsCommand()
			});
		}

		this.addSettingTab(new PdfAnchorSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}


	/*
	 * UTILITY FUNCTIONS
	 */

	async reportError( message:string ){
		console.log( message );
		new Notice( message );
	}

	async getContentsOfFile( file:File, cb:Function ) {
		
		const reader = new FileReader()
		
		let fileResult: any
		
		reader.onload = () => {
			fileResult = reader.result
			cb( fileResult );
		}
		// TODO: error handling :D
		// reader.onerror = (error) => {
		// 	reject(error)
		// }
		// reader.onloadend = () => {
		// 	resolve(fileResult)
		// }
		reader.readAsArrayBuffer( file );
	}

	async openFileDialog( cb:Function ) {
		// see https://forum.obsidian.md/t/file-open-dialog/47325
		let input = document.createElement('input');
		input.type = 'file';
		input.onchange = _ => {
			cb( input.files );
			input.remove();
		};
		input.click();
	}


	/* 
	 * FULL EXPORT
	 */

	async fullExportCommand( editor: Editor, view: MarkdownView ){

		const currentFile = view.file!;
		
		// make a copy of the current note and operate on the copy
		let parsed = path.parse( currentFile.path );
		let name = `${parsed.name}.anchors`
		let fmt = { ...parsed, name: name, base: `${name}${parsed.ext}` }
		this.app.vault.copy(
			currentFile,
			path.format( fmt )
		).then( (tempNote) => {
			this.onTempNoteCreated( tempNote, currentFile, view );
		})
	}

	async onTempNoteCreated( tempNote: TFile, originalNote: TFile, view: MarkdownView ) {
		
		// used cached links from original file since the cache won't contain any for the temp copy yet
		const cachedLinks = this.app.metadataCache.getCache( originalNote.path )?.links;
		await this.convertAllInternalLinksToDummies( tempNote, cachedLinks );

		// open the temp copy of the note in a new tab
		const openState = { active: false, eState: { active: false, focus: false } };
		const leaf = this.app.workspace.getLeaf( 'tab' );
		leaf.openFile( tempNote, openState ).then( ()=>{
			this.onTempFileOpenComplete( tempNote, leaf );
		});
	}

	onTempFileOpenComplete( tempNote: TFile, openedLeaf:WorkspaceLeaf ){

		// listen for the PDF export completion message
		this.registerDomEvent(window, 'afterprint', (evt: Event) => {
			this.onPDFSaveComplete( tempNote );
		},{
			once: true
		});

		// export PDF
		const v = openedLeaf.view as MarkdownView;
		(v as PrintableMarkdownView).printToPdf();
	}

	onPDFSaveComplete( tempFile:TFile ){

		// PDF has been saved, so we can delete the temp copy of the original note file
		this.app.vault.delete( tempFile );

		// create a modal which tells the user what's happening next
		this._currentModal = new PdfSelectModal(
			this.app,
			this.manifest.name,
			() => {
				this.convertDummiesToAnchorsCommand();
			}
		)
		this._currentModal.open();
	}


	/* 
	 * Convert header / anchor links in the same document to dummy links
	 */

	/*
	async convertAllInternalLinksToDummiesCommand() {
		const currentFile = this.app.workspace.getActiveFile();
		if( !currentFile ) this.reportError( "Couldn't get active file" );
		this.convertAllInternalLinksToDummies( currentFile! );
	}*/

	async convertAllInternalLinksToDummies( noteFile : TFile, cachedLinks?:LinkCache[] ) {

		/* based heavliy on https://github.com/dy-sh/obsidian-consistent-attachments-and-links */
		let noteText = await this.app.vault.read( noteFile );
		
		if (cachedLinks) {
			for (let link of cachedLinks) {

				// we're only interested in links to headings in the current note 
				if( !link.original.startsWith("[[#") )
					continue

				let anchor = encodeURI(link.link);
				let dummyLink = `${this._dummyBaseUrl}${anchor}`;
				let dummyMarkdown = `[${link.displayText}](${dummyLink})`;

				// rewrite link to an external dummy link
				noteText = noteText.replace( link.original, dummyMarkdown );
			}
		} else {
			this.reportError( `No cached links found for file ${noteFile}` );
			debugger;
		}

		debugger;

		// write modified noteText to file
		await this.app.vault.modify( noteFile, noteText );
	}


	/* 
	 * Convert dummy links in a PDF back to header / anchor links in the same document
	 */

	async convertDummiesToAnchorsCommand() {
		if( this._currentModal ){
			this._currentModal.close();
		}
		this.openFileDialog( (files:FileList) => {
			this.convertDummiesToAnchors(
				(files[0] as ElectronFile).path )
		});
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

				// this commented block was an attempt at catching headers that run on to >1 line
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

	readonly _maxHeadingDepthForOutline = 4

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
			if( (headingDepth>=0) && (headingDepth < this._maxHeadingDepthForOutline) ){
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
		// example dummy uri: http://dummy.link/dummy#A%20divided%20world
		return decodeURI( new URL( dummyUri ).hash );
	}

	normalise( str:string ) {
		// sometimes non-alphas in dummy links get munged along the way
		return str.toLowerCase().replace( /[^a-z]/g, "" );
	}

	pageNumberForAnchorReferenceAndOutline( anchorRef: string, outline: any ){
		let path = anchorRef.split( "#" );
		let leaf = this.normalise( path[ path.length-1 ] );

		//TODO: map anchor references to outlineItems more intelligently
		// 	e.g match the whole path, not just the leaf

		for( let outlineItem of outline.outlineItems ){
			if( leaf == this.normalise(outlineItem.Title) ){
				return outlineItem.Dest
			}
		}

		// fallback to partial matches, but only if we haven't had a full match
		for( let outlineItem of outline.outlineItems ){
			if( leaf.indexOf( this.normalise(outlineItem.Title) ) > 0 ){
				return outlineItem.Dest
			}
		}
		return -1;
	}

	async convertDummiesToAnchors( pdfPath:string, notePath?:string ) {
		
		// TODO: use cachedHeadings to reconstruct headers which have broken across lines in the PDF 
		// if( !notePath ) notePath =  this.app.workspace.getActiveFile()!.path;
		// const cachedHeadings = this.app.metadataCache.getCache( notePath )?.headings;
		// console.log( cachedHeadings );

		const modalProcessing = new PdfProcessingModal(
			this.app,
			this.manifest.name
		);
		modalProcessing.open();

		let pdfFile = readFileSync( pdfPath );
		let pdfBuffer = pdfFile.buffer;

		let [outline,strOutline] = await this.getOutlineForPdfBuffer( pdfBuffer.slice(0) );

		const pdfDoc = await PDFDocument.load( pdfBuffer );
		const pages = pdfDoc.getPages();

		let rewriteCount = 0;
		let numPage = 0;

		pages.forEach((p:PDFPage
			) => {
			numPage++;
			p.node
			.Annots()
			?.asArray()
			.forEach((annot) => {

				const dctAnnot = pdfDoc.context.lookupMaybe( annot, PDFDict );
				const dctAction = dctAnnot?.get( asPDFName(`A`) );
				const link = pdfDoc.context.lookupMaybe( dctAction, PDFDict );
				const uri = link?.get( asPDFName("URI") )?.toString().slice(1, -1); // get the original link, remove parenthesis
				
				let newAction = null;

				if( uri?.startsWith(this._dummyBaseUrl) ){

					let anchor = this.anchorReferenceForDummyUri( uri );
					let pageNumber = this.pageNumberForAnchorReferenceAndOutline( anchor, outline );
					// console.log( `Page number ${pageNumber} found for anchor ${anchor}` );
					
					// skip links we can't find a page number for
					if( pageNumber < 1 ) return;

					// construct page link
					// using info from https://github.com/Hopding/pdf-lib/issues/123
					
					// TODO: link to the correct page, don't reset zoom.
					// 	should be possible with XYZ, but I can't quite work it out
					// 	reference: https://opensource.adobe.com/dc-acrobat-sdk-docs/library/pdfmark/pdfmark_Actions.html
					newAction = pdfDoc.context.obj([
						pages[pageNumber].ref,
						'Fit'
					]);

				}
				
				if( newAction != null ){
					// remove 'A' dict from annotation (a URL) and add a 'Dest' (page destination in PDF)
					dctAnnot?.delete( asPDFName(`A`) );
					dctAnnot?.set(
						asPDFName( "Dest" ),
						newAction
					)
					rewriteCount++;
				}
			});
		});

		let message = "";

		if( rewriteCount > 0 ) {

			// TODO: make this prettier when displayed in the modal
			message = `✅ Complete! Restored ${rewriteCount} anchor links in file: ${pdfPath}`;

			if( this.settings.generateOutline ){
				// get a copy of the pdf document containing an outline
				// TODO: cull the outline according to this.settings.maxHeadlineDepth
				// 	but only for generating the display outline
				
				try {
					const outlinedPdf = await outlinePdf({ outline:strOutline, pdf:pdfDoc })
						.then((pdfDocument) => pdfDocument.save())
					writeFileSync( pdfPath, outlinedPdf );
					
				} catch (error) {

					message = `⚠ ${error}`;
				}

			} else {
				writeFileSync( pdfPath, await pdfDoc.save() );
			}
			
		} else {
			// TODO: make this prettier when displayed in the modal
			message = `⚠ Couldn't find any anchor links to restore in PDF file ${pdfPath}. This probably means something went wrong :(`
		}

		console.log( message );

		if( modalProcessing.isOpen() ){

			modalProcessing.setCloseButtonEnabled( true );
			modalProcessing.setProcessingComplete( true, message );

		} else {
			// if the user's already closed the modal, show a Notice instead
			new Notice( message );
		}
	}
}
