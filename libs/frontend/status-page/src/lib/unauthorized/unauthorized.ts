/// <reference types="@angular/localize" />

import { Component } from '@angular/core';

import { StatusPage } from '../status-page/status-page';

@Component({
  selector: 'hiking-downward-unauthorized',
  imports: [StatusPage],
  templateUrl: './unauthorized.ng.html',
})
export class Unauthorized {
  protected readonly heading = $localize`Unauthorized`;
  protected readonly description = $localize`Please sign in to continue.`;
}
