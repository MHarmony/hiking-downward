/// <reference types="@angular/localize" />

import { Component } from '@angular/core';

import { StatusPage } from '../status-page/status-page';

@Component({
  selector: 'hiking-downward-not-found',
  imports: [StatusPage],
  templateUrl: './not-found.ng.html',
})
export class NotFound {
  protected readonly heading = $localize`Page not found`;
  protected readonly description = $localize`Sorry, we couldn't find the page you're looking for.`;
}
