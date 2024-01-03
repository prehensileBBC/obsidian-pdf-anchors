import { debug, timeStamp } from "console";
import { Modal, App, ButtonComponent } from "obsidian";
import * as strings from 'strings.json';


export class ButtonBarModal extends Modal {

	constructor(app: App ) {
		super(app);
	}
	
	protected createButton(
		container: HTMLElement,
		text: string,
		callback: (evt: MouseEvent) => unknown
	):ButtonComponent{
		const btn = new ButtonComponent(container);
		btn.setButtonText(text).onClick(callback);

		return btn;
	}

	protected createButtonBar( mainContentContainer: HTMLElement ): HTMLDivElement {
		
		const buttonBarContainer: HTMLDivElement =
			mainContentContainer.createDiv();
		
		buttonBarContainer.style.display = "flex";
		buttonBarContainer.style.flexDirection = "row-reverse";
		buttonBarContainer.style.justifyContent = "flex-start";
		buttonBarContainer.style.marginTop = "1rem";

		return buttonBarContainer;
	}

}

export class PdfSelectModal extends ButtonBarModal {
	
	private _onOkay?:Function;
	private _onCancel?:Function;
	private _windowTitle:string;
	
	constructor(app: App, windowTitle:string, onOkay?:Function, onCancel?:Function ) {
	  super(app);
	  this._windowTitle = windowTitle;
	  this._onOkay = onOkay;
	  this._onCancel = onCancel;
	}

	onOpen(): void {
		
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("div", { text: this._windowTitle }).addClass( "modal-title" );
		contentEl.createEl("div", { text: strings.SelectPDF });

		const buttonBarContainer = this.createButtonBar( contentEl );

		this.createButton(
			buttonBarContainer,
			strings.SelectPDFOkay,
			(evt:MouseEvent) =>{
				this.onOkay(evt);
			}
		).setCta().buttonEl.style.marginLeft = "0.3rem";
		
		this.createButton(
			buttonBarContainer,
			strings.SelectPDFCancel,
			() =>{
				this.onCancel();
			}
		);
	}

	onOkay(evt:MouseEvent){
		if( this._onOkay ) this._onOkay(evt);
		this.close();
	}	
	
	onCancel(){
		if( this._onCancel ) this._onCancel();
		this.close()
	}

	onClose() {
	  let { contentEl } = this;
	  contentEl.empty();
	}
}


export class PdfProcessingModal extends ButtonBarModal {
	
	private _windowTitle:string;
    private _messageEl:HTMLParagraphElement;
	private _closeButton:ButtonComponent;
	private _isOpen:boolean;
	private _barFill:HTMLDivElement;
	private _openCallback?: (modal:PdfProcessingModal) => any;

	constructor( app: App, windowTitle:string, openCallback?:(modal:PdfProcessingModal) => any ) {
	  super(app);
      this._windowTitle = windowTitle;
	  this._isOpen = false;
	  this._openCallback = openCallback;
	}

	onOpen(): void {
		
		this._isOpen = true;

		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("div", { text: this._windowTitle }).addClass( "modal-title" );
		this._messageEl = contentEl.createEl("p", { text: strings.PDFFixing });
		
		const progressBarContainer = contentEl.createEl("div")
        progressBarContainer.addClass("pdf-anchors-bar-container");
        this._barFill = progressBarContainer.createEl("div")
		this._barFill.addClasses([
			"pdf-anchors-bar-fill",
			"pdf-anchors-bar-fill-anim"
		]);

		const buttonBarContainer = this.createButtonBar( contentEl );

		this._closeButton = this.createButton(
			buttonBarContainer,
			strings.PDFFixingClose,
			(evt:MouseEvent) =>{
				// debugger;
				this.close();
			}
		)
		
		this.setCloseButtonEnabled( false );

		if( this._openCallback ){
			this._openCallback( this );
		}
	}

	onClose() {
		this._isOpen = false;
		let { contentEl } = this;
		contentEl.empty();
	}

    setMessage( message: string ) {
        this._messageEl.setText( message );
    }

	setCloseButtonEnabled( enabled:boolean ){
		this._closeButton.setDisabled( !enabled );
		if( enabled ){
			this._closeButton.setCta();
			this._closeButton.buttonEl.removeAttribute( "disabled" );
			this._closeButton.buttonEl.removeClass( "pdf-anchors-button-disabled");
		}
		else{ 
			this._closeButton.buttonEl.addClass( "pdf-anchors-button-disabled");
			this._closeButton.buttonEl.setAttribute( "disabled", "true" );
			this._closeButton.removeCta();
		}
	}

	setProcessingComplete( complete:boolean, passedMessage?:string ){
		if( complete ){
			let message = strings.PDFFixingComplete;
			if( passedMessage ) message = passedMessage;
			this.setMessage(  message );
			this._barFill.removeClass( "pdf-anchors-bar-fill-anim" );
		}
	}

	isOpen():boolean{
		return this._isOpen;
	}

}
