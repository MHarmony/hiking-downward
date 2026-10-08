import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Settings navigation and routed content, without global application chrome. */
@Component({
  selector: 'hiking-downward-account-settings',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './account-settings.ng.html',
})
export class AccountSettings {}
