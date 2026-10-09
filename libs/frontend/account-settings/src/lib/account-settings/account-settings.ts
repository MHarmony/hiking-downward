import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Settings navigation and routed content, without global application chrome. */
@Component({
  selector: 'hiking-downward-account-settings',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './account-settings.ng.html',
})
/* v8 ignore start */
export class AccountSettings {}
/* v8 ignore stop */
