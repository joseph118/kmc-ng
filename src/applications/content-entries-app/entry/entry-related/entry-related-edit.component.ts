import { Component, Input, AfterViewInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';

import { ISubscription } from 'rxjs/Subscription';
import { ConfirmationService } from 'primeng/primeng';

import { KalturaAttachmentAsset } from 'kaltura-typescript-client/types/all';
import { AppLocalization } from '@kaltura-ng2/kaltura-common';
import { PopupWidgetComponent, PopupWidgetStates } from '@kaltura-ng2/kaltura-ui/popup-widget/popup-widget.component';

@Component({
    selector: 'kEntryRelatedEdit',
    templateUrl: './entry-related-edit.component.html',
    styleUrls: ['./entry-related-edit.component.scss']
})
export class EntryRelatedEdit implements  AfterViewInit, OnDestroy{

	@Input() currentFile: KalturaAttachmentAsset;
	@Input() parentPopupWidget: PopupWidgetComponent;

	public relatedEditForm: FormGroup;

	private _parentPopupStateChangeSubscribe : ISubscription;
	private _confirmClose: boolean = true;

    constructor(private _appLocalization: AppLocalization, private _fb: FormBuilder, private _confirmationService: ConfirmationService) {
	    this._createForm();
    }

	ngAfterViewInit(){
		if (this.parentPopupWidget) {
			this._parentPopupStateChangeSubscribe = this.parentPopupWidget.state$
				.subscribe(event => {
					if (event.state === PopupWidgetStates.Open) {
						this._resetForm();
						this._confirmClose = true;
						this.relatedEditForm.get("title").setValue(this.currentFile.title);
						this.relatedEditForm.get("description").setValue(this.currentFile.partnerDescription);
					}
					if (event.state === PopupWidgetStates.BeforeClose) {
						if (event.context && event.context.allowClose) {
							if (this.relatedEditForm.dirty && this._confirmClose) {
								event.context.allowClose = false;
								this._confirmationService.confirm({
									message: this._appLocalization.get('applications.content.entryDetails.captions.discard'),
									accept: () => {
										this._confirmClose = false;
										this.parentPopupWidget.close();
									}
								});
							}
						}
					}
				});
		}
	}

	ngOnDestroy(){
		this._parentPopupStateChangeSubscribe.unsubscribe();
	}

	public _saveAndClose(): void{
		if (this.relatedEditForm.dirty){
			this.currentFile.title = this.relatedEditForm.get("title").value;
			this.currentFile.partnerDescription = this.relatedEditForm.get("description").value;
		}
		this._confirmClose = false;
		this.parentPopupWidget.close();
	}


	private _createForm(): void{
		this.relatedEditForm = this._fb.group({
			title: '',
			description: ''
		});
	}

	private _resetForm(): void{
		this.relatedEditForm.reset({
			title: '',
			description: ''
		});
	}

}
