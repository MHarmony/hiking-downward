/// <reference types="@angular/localize" />

import { Component } from '@angular/core';

import { StatusPage } from '../status-page/status-page';

@Component({
  selector: 'hiking-downward-forbidden',
  imports: [StatusPage],
  templateUrl: './forbidden.ng.html',
})
export class Forbidden {
  private readonly heading = $localize`Forbidden`;
  private readonly description = $localize`You do not have permission to view this page.`;
}
