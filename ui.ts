import { Modal, App, ButtonComponent } from "obsidian";
export class PdfSelectModal extends Modal {
	
	private _onOkay?:Function;
	private _onCancel?:Function;
	private _windowTitle:string;
	
	constructor(app: App, windowTitle:string, onOkay?:Function, onCancel?:Function ) {
	  super(app);
	  this._windowTitle = windowTitle;
	  this._onOkay = onOkay;
	  this._onCancel = onCancel;
	}

	private createButton(
		container: HTMLElement,
		text: string,
		callback: (evt: MouseEvent) => unknown
	) {
		const btn = new ButtonComponent(container);
		btn.setButtonText(text).onClick(callback);

		return btn;
	}

	private createButtonBar(mainContentContainer: HTMLDivElement) {
		const buttonBarContainer: HTMLDivElement =
			mainContentContainer.createDiv();
		this.createButton(
			buttonBarContainer,
			"Select",
			(evt:MouseEvent) =>{
				this.onOkay(evt);
			}
		).setCta().buttonEl.style.marginLeft = "0.3rem";
		this.createButton(
			buttonBarContainer,
			"Cancel",
			() =>{
				this.onCancel();
			}
		);

		buttonBarContainer.style.display = "flex";
		buttonBarContainer.style.flexDirection = "row-reverse";
		buttonBarContainer.style.justifyContent = "flex-start";
		buttonBarContainer.style.marginTop = "1rem";
	}

	onOpen(): void {
		
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("div", { text: this._windowTitle }).addClass( "modal-title" );
		contentEl.createEl("div", { text: "Now, please select the exported PDF" });

		this.createButtonBar(
			contentEl.createDiv()
		);
	}

	onOkay(evt:MouseEvent){
		// debugger;
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
