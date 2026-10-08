import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Confirms that an account deletion has completed. */
@Component({
  imports: [RouterLink],
  templateUrl: './account-deleted.ng.html',
})
export class AccountDeleted {}
