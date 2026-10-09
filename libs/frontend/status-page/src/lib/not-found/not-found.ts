/// <reference types="@angular/localize" />

import { Component } from '@angular/core';

import { StatusPage } from '../status-page/status-page';

@Component({
  selector: 'hiking-downward-not-found',
  imports: [StatusPage],
  templateUrl: './not-found.ng.html',
})
export class NotFound {
  private readonly heading = $localize`Page not found`;
  private readonly description = $localize`Sorry, we couldn't find the page you're looking for.`;
}
